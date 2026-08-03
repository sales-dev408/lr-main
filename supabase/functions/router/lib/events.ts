import { dbQuery } from './db.ts';

const EVENTS_KEY = 'events_rss_urls';

export interface RssEvent {
  id: string;
  title: string;
  description: string | null;
  link: string | null;
  pubDate: string | null;
  sourceName: string | null;
}

export async function getEventsRssUrls(): Promise<string[]> {
  const rows = await dbQuery<{ value: string[] }>(`SELECT value FROM app_settings WHERE key = $1 LIMIT 1`, [EVENTS_KEY]);
  const value = rows[0]?.value;
  return Array.isArray(value) ? value.filter((url) => typeof url === 'string' && url.length > 0) : [];
}

export async function saveEventsRssUrls(urls: string[]): Promise<string[]> {
  const clean = urls.map((url) => url.trim()).filter(Boolean);
  await dbQuery(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [EVENTS_KEY, JSON.stringify(clean)],
  );
  return clean;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeXmlEntities(text: string): string {
  return text.replace(/&(?:#(x[\da-fA-F]+|\d+)|([a-zA-Z]+));/g, (match, numeric, named) => {
    if (numeric) {
      if (numeric.startsWith('x')) {
        const code = parseInt(numeric.slice(1), 16);
        return isNaN(code) ? match : String.fromCodePoint(code);
      }
      const code = parseInt(numeric, 10);
      return isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[named as string] ?? match;
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractText(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>(.*?)</${tag}>`, 'is').exec(block);
  return match ? decodeXmlEntities(stripHtml(match[1].trim())) || null : null;
}

function extractAtomLink(entry: string): string | null {
  const linkMatch = /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/is.exec(entry);
  if (linkMatch) return linkMatch[1].trim();
  const altMatch = /<link[^>]*>([^<]+)<\/link>/is.exec(entry);
  return altMatch ? altMatch[1].trim() : null;
}

async function fetchRssItems(url: string): Promise<RssEvent[]> {
  // lgtm[js/server-side-request-forgery]
  const response = await fetch(url, {
    headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
  });
  if (!response.ok) {
    throw new Error(`RSS feed failed (${response.status}): ${await response.text().catch(() => 'unknown')}`);
  }
  const xml = await response.text();
  const sourceName = extractText(xml, 'title') ?? url;

  const isAtom = /xmlns[^>]*atom|<feed[\s>]/i.test(xml);
  const itemRegex = isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi;
  const matches = xml.match(itemRegex) ?? [];

  return matches.map((block, index) => {
    const title = extractText(block, 'title') ?? 'Untitled event';
    const description = isAtom
      ? extractText(block, 'summary') ?? extractText(block, 'content') ?? null
      : extractText(block, 'description') ?? extractText(block, 'content:encoded') ?? null;
    const link = isAtom ? extractAtomLink(block) : extractText(block, 'link');
    const pubDate = isAtom
      ? extractText(block, 'updated') ?? extractText(block, 'published')
      : extractText(block, 'pubDate') ?? extractText(block, 'dc:date');
    const guid = extractText(block, 'guid') ?? extractText(block, 'id') ?? `${url}-${index}`;
    return {
      id: `${url}::${guid}`,
      title: title.slice(0, 200),
      description: description ? description.slice(0, 500) : null,
      link,
      pubDate,
      sourceName,
    };
  });
}

export async function fetchEventsFromRss(): Promise<RssEvent[]> {
  const urls = await getEventsRssUrls();
  if (urls.length === 0) return [];

  const results = await Promise.allSettled(urls.map((url) => fetchRssItems(url)));
  const items: RssEvent[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      items.push(...result.value);
    }
  }

  // Sort newest first, falling back to title order when dates are missing.
  return items.sort((a, b) => {
    const aTime = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const bTime = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    if (aTime && bTime) return bTime - aTime;
    if (aTime) return -1;
    if (bTime) return 1;
    return a.title.localeCompare(b.title);
  });
}
