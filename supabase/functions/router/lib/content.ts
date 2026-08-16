import { dbQuery, withDbClient } from './db.ts';
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

export async function listContentBlocks(opts: { publishedOnly: boolean }): Promise<ContentBlock[]> {
  if (opts.publishedOnly) {
    return dbQuery<ContentBlock>(
      `SELECT ${CONTENT_COLUMNS} FROM content_blocks WHERE published = true ORDER BY position ASC, created_at DESC`,
    );
  }
  return dbQuery<ContentBlock>(`SELECT ${CONTENT_COLUMNS} FROM content_blocks ORDER BY position ASC, created_at DESC`);
}

export async function getLatestPublishedSnapshot(): Promise<{ version: number; published_at: string; content: ContentBlock[] } | null> {
  const rows = await dbQuery<{ version: number; published_at: string; content: ContentBlock[] }>(
    'SELECT version, published_at, content FROM content_published ORDER BY version DESC LIMIT 1',
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
  return withDbClient(async (client) => {
    const allPublished = await client.query<ContentBlock>(
      `SELECT ${CONTENT_COLUMNS} FROM content_blocks WHERE published = true ORDER BY position ASC, created_at DESC`,
    );
    const currentRow = (await client.query<{ max: number | null }>('SELECT COALESCE(MAX(version), 0) AS max FROM content_published'))[0];
    const nextVersion = (currentRow?.max ?? 0) + 1;
    const publishedAt = new Date().toISOString();
    await client.query(
      'INSERT INTO content_published (version, published_at, content) VALUES ($1, $2, $3::jsonb)',
      [nextVersion, publishedAt, JSON.stringify(allPublished)],
    );
    return { version: nextVersion, publishedAt };
  });
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
}

export const DEFAULT_THEME: ThemeSettings = {
  brand: '#0d9488',
  primaryGradient: ['#0d9488', '#6366f1'],
  tabs: [
    { key: 'index', label: 'Home', color: '#0d9488', gradient: ['#14b8a6', '#0d9488'] },
    { key: 'live', label: 'Train Schedule', color: '#f59e0b', gradient: ['#fbbf24', '#d97706'] },
    { key: 'browse', label: 'Browse', color: '#f43f5e', gradient: ['#fb7185', '#e11d48'] },
    { key: 'events', label: 'Events', color: '#8b5cf6', gradient: ['#a78bfa', '#7c3aed'] },
    { key: 'apartments', label: 'Apartments', color: '#f59e0b', gradient: ['#fbbf24', '#d97706'] },
    { key: 'discover', label: 'Discover', color: '#10b981', gradient: ['#34d399', '#059669'] },
    { key: 'deals', label: 'Deals', color: '#f97316', gradient: ['#fb923c', '#ea580c'] },
    { key: 'profile', label: 'Profile', color: '#0ea5e9', gradient: ['#38bdf8', '#0284c7'] },
  ],
};

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const rows = await dbQuery<{ value: T }>('SELECT value FROM app_settings WHERE key = $1 LIMIT 1', [key]);
    return rows[0]?.value ?? fallback;
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
  };
}

export async function saveTheme(theme: ThemeSettings): Promise<ThemeSettings> {
  await dbQuery(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('theme', $1::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(theme)],
  );
  return theme;
}
