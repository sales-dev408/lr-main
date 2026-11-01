import { dbQuery, restQuery, restWrite } from './db.ts';
import { uploadImageDataUrl } from './storage.ts';
import { generateOpaqueToken } from './ids.ts';

export type ContentKind = 'text' | 'article' | 'image' | 'file' | 'embed';

export interface ContentBlock {
  id: string;
  kind: ContentKind;
  title: string;
  body: string | null;
  url: string | null;
  position: number;
  published: boolean;
  created_at: string;
  updated_at: string;
}

const CONTENT_COLUMNS = 'id, kind, title, body, url, position, published, created_at, updated_at';

export async function getContentBlock(id: string): Promise<ContentBlock | null> {
  const rows = await dbQuery<ContentBlock>(
    `SELECT ${CONTENT_COLUMNS} FROM content_blocks WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function listContentBlocks(opts: { publishedOnly: boolean }): Promise<ContentBlock[]> {
  // Read via PostgREST: the direct pg connection dies mid-transfer on
  // multi-KB result sets from edge isolates (CONNECTION_CLOSED / 546).
  const params: Array<[string, string]> = [
    ['select', CONTENT_COLUMNS.replace(/\s/g, '')],
    ['order', 'position.asc,created_at.desc'],
  ];
  if (opts.publishedOnly) params.push(['published', 'eq.true']);
  return restQuery<ContentBlock>('content_blocks', params);
}

export async function getLatestPublishedSnapshot(): Promise<{ version: number; published_at: string; content: ContentBlock[] } | null> {
  const rows = await restQuery<{ version: number; published_at: string; content: ContentBlock[] }>(
    'content_published',
    [
      ['select', 'version,published_at,content'],
      ['order', 'version.desc,published_at.desc'],
      ['limit', '1'],
    ],
  );
  return rows[0] ?? null;
}

export async function getPublishedContent(): Promise<ContentBlock[]> {
  const snapshot = await getLatestPublishedSnapshot();
  if (snapshot?.content && Array.isArray(snapshot.content)) {
    return snapshot.content as ContentBlock[];
  }
  return listContentBlocks({ publishedOnly: true });
}

export async function getContentVersion(): Promise<{ version: number; publishedAt: string | null }> {
  const snapshot = await getLatestPublishedSnapshot();
  return { version: snapshot?.version ?? 0, publishedAt: snapshot?.published_at ?? null };
}

export async function getContentStatus(): Promise<{ currentVersion: number; publishedAt: string | null; publishedCount: number; draftCount: number }> {
  const snapshot = await getLatestPublishedSnapshot();
  const publishedRow = (await dbQuery<{ count: number }>("SELECT COUNT(*)::int AS count FROM content_blocks WHERE published = true"))[0];
  const draftRow = (await dbQuery<{ count: number }>("SELECT COUNT(*)::int AS count FROM content_blocks WHERE published = false"))[0];
  return {
    currentVersion: snapshot?.version ?? 0,
    publishedAt: snapshot?.published_at ?? null,
    publishedCount: publishedRow?.count ?? 0,
    draftCount: draftRow?.count ?? 0,
  };
}

export async function publishContent(): Promise<{ version: number; publishedAt: string }> {
  // Read + write via PostgREST: the snapshot JSONB is too big for the direct
  // pg socket from edge isolates.
  const allPublished = await listContentBlocks({ publishedOnly: true });
  const latest = await restQuery<{ version: number | null }>('content_published', [
    ['select', 'version'],
    ['order', 'version.desc'],
    ['limit', '1'],
  ]);
  const nextVersion = (latest[0]?.version ?? 0) + 1;
  const publishedAt = new Date().toISOString();
  await restWrite('content_published', {
    body: { version: nextVersion, published_at: publishedAt, content: allPublished },
  });
  return { version: nextVersion, publishedAt };
}

// Uploads an inline data URL to storage and returns a public URL, falling back
// to the provided url when there is nothing to upload or storage is unset.
async function resolveAssetUrl(dataUrl: string | null | undefined, url: string | null | undefined): Promise<string | null> {
  if (dataUrl) {
    const uploaded = await uploadImageDataUrl(`content/${generateOpaqueToken(8)}${extensionFor(dataUrl)}`, dataUrl);
    if (uploaded) return uploaded;
  }
  return url ?? null;
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/csv': '.csv',
};

function extensionFor(dataUrl: string): string {
  const mime = dataUrl.match(/^data:([^;]+);base64,/)?.[1] ?? '';
  return MIME_EXTENSIONS[mime] ?? '.bin';
}

export async function createContentBlock(input: {
  kind: ContentKind;
  title: string;
  body?: string | null;
  url?: string | null;
  dataUrl?: string | null;
  position?: number;
  published?: boolean;
}): Promise<ContentBlock> {
  const url = await resolveAssetUrl(input.dataUrl, input.url);
  const rows = await dbQuery<ContentBlock>(
    `INSERT INTO content_blocks (kind, title, body, url, position, published)
     VALUES ($1, $2, $3, $4, COALESCE($5, 0), COALESCE($6, false))
     RETURNING ${CONTENT_COLUMNS}`,
    [input.kind, input.title, input.body ?? null, url, input.position ?? null, input.published ?? null],
  );
  return rows[0]!;
}

export async function updateContentBlock(
  id: string,
  input: { kind?: ContentKind; title?: string; body?: string | null; url?: string | null; dataUrl?: string | null; position?: number; published?: boolean },
): Promise<ContentBlock | null> {
  const url = input.dataUrl ? await resolveAssetUrl(input.dataUrl, input.url) : (input.url ?? null);
  const rows = await dbQuery<ContentBlock>(
    `UPDATE content_blocks SET
       kind = COALESCE($2, kind),
       title = COALESCE($3, title),
       body = COALESCE($4, body),
       url = COALESCE($5, url),
       position = COALESCE($6, position),
       published = COALESCE($7, published),
       updated_at = now()
     WHERE id = $1
     RETURNING ${CONTENT_COLUMNS}`,
    [id, input.kind ?? null, input.title ?? null, input.body ?? null, url, input.position ?? null, input.published ?? null],
  );
  return rows[0] ?? null;
}

export async function deleteContentBlock(id: string): Promise<boolean> {
  const rows = await dbQuery<{ id: string }>('DELETE FROM content_blocks WHERE id = $1 RETURNING id', [id]);
  return rows.length > 0;
}

// ---- Theme / app settings -------------------------------------------------

export interface ThemeTab {
  key: string;
  label: string;
  color: string;
  gradient: [string, string];
}

export interface ThemeSettings {
  brand: string;
  primaryGradient: [string, string];
  tabs: ThemeTab[];
  /** 'nba-allstar' flips the whole app + admin site to the basketball theme. */
  mode?: 'nba-allstar';
}

export const DEFAULT_THEME: ThemeSettings = {
  brand: '#0e7490',
  primaryGradient: ['#0e7490', '#ea580c'],
  tabs: [
    { key: 'index', label: 'Home', color: '#0e7490', gradient: ['#06b6d4', '#0e7490'] },
    { key: 'events', label: 'Events', color: '#e11d48', gradient: ['#fb7185', '#e11d48'] },
    { key: 'sports', label: 'Sports', color: '#059669', gradient: ['#34d399', '#059669'] },
    { key: 'restaurants', label: 'Restaurants & Bars', color: '#ea580c', gradient: ['#fb923c', '#ea580c'] },
    { key: 'shopping', label: 'Shopping', color: '#7c3aed', gradient: ['#a78bfa', '#7c3aed'] },
    { key: 'beauty', label: 'Health & Beauty', color: '#db2777', gradient: ['#f472b6', '#db2777'] },
    { key: 'live', label: 'Train Times', color: '#4f46e5', gradient: ['#818cf8', '#4f46e5'] },
    { key: 'hotels', label: 'Hotels', color: '#0284c7', gradient: ['#38bdf8', '#0284c7'] },
    { key: 'apartments', label: 'Apartments', color: '#f59e0b', gradient: ['#fbbf24', '#d97706'] },
    { key: 'real-estate', label: 'Real Estate', color: '#0d9488', gradient: ['#2dd4bf', '#0d9488'] },
    { key: 'discover', label: 'Discover Articles', color: '#0d9488', gradient: ['#2dd4bf', '#0d9488'] },
    { key: 'az-events', label: 'Events Around Arizona', color: '#d97706', gradient: ['#fbbf24', '#d97706'] },
    { key: 'settings', label: 'Settings', color: '#57534e', gradient: ['#a8a29e', '#57534e'] },
    { key: 'notifications', label: 'Notifications', color: '#57534e', gradient: ['#a8a29e', '#57534e'] },
  ],
};

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const rows = await dbQuery<{ value: T }>('SELECT value FROM app_settings WHERE key = $1 LIMIT 1', [key]);
    const value = rows[0]?.value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    }
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function mergeTabs(storedTabs: ThemeTab[] | undefined): ThemeTab[] {
  const defaultsByKey = new Map(DEFAULT_THEME.tabs.map((tab) => [tab.key, tab]));
  const stored = Array.isArray(storedTabs) ? storedTabs : [];
  const storedByKey = new Map(stored.map((tab) => [tab.key, tab]));
  return DEFAULT_THEME.tabs.map((tab) => storedByKey.get(tab.key) ?? tab);
}

export async function getTheme(): Promise<ThemeSettings> {
  const stored = await getSetting<Partial<ThemeSettings>>('theme', DEFAULT_THEME);
  return {
    brand: stored.brand ?? DEFAULT_THEME.brand,
    primaryGradient: stored.primaryGradient ?? DEFAULT_THEME.primaryGradient,
    tabs: mergeTabs(stored.tabs),
    ...(stored.mode === 'nba-allstar' ? { mode: 'nba-allstar' as const } : {}),
  };
}

export async function saveTheme(theme: ThemeSettings): Promise<ThemeSettings> {
  await dbQuery(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('theme', $1::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [theme],
  );
  return theme;
}
