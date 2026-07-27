import { dbQuery } from './db.ts';
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
     VALUES ($1, $2, $3, $4, COALESCE($5, 0), COALESCE($6, true))
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
  brand: '#2563eb',
  primaryGradient: ['#2563eb', '#16a34a'],
  // Keys match the app's tab route names so each tab can look up its style.
  tabs: [
    { key: 'vendors', label: 'Deals', color: '#2563eb', gradient: ['#3b82f6', '#1d4ed8'] },
    { key: 'index', label: 'Browse', color: '#dc2626', gradient: ['#ef4444', '#b91c1c'] },
    { key: 'discover', label: 'Discover', color: '#16a34a', gradient: ['#22c55e', '#15803d'] },
    { key: 'passes', label: 'My Pass', color: '#2563eb', gradient: ['#3b82f6', '#1d4ed8'] },
    { key: 'profile', label: 'Profile', color: '#16a34a', gradient: ['#22c55e', '#15803d'] },
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

export async function getTheme(): Promise<ThemeSettings> {
  const stored = await getSetting<Partial<ThemeSettings>>('theme', DEFAULT_THEME);
  return {
    brand: stored.brand ?? DEFAULT_THEME.brand,
    primaryGradient: stored.primaryGradient ?? DEFAULT_THEME.primaryGradient,
    tabs: Array.isArray(stored.tabs) && stored.tabs.length > 0 ? stored.tabs : DEFAULT_THEME.tabs,
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
