import { dbQuery } from './db.ts';
import { z } from 'npm:zod';

const adminEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  eventDate: z.string().nullable().optional(),
  eventTime: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  eventLink: z.string().nullable().optional(),
  sport: z.string().nullable().optional(),
  eventType: z.string().nullable().optional(),
});

export { adminEventSchema };

export interface RssEvent {
  id: string;
  title: string;
  description: string | null;
  link: string | null;
  pubDate: string | null;
  sourceName: string | null;
  imageUrl?: string | null;
  city?: string | null;
  phone?: string | null;
  sport?: string | null;
  eventType?: string | null;
}

export interface AdminEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: string | null;
  eventTime: string | null;
  imageUrl: string | null;
  city: string | null;
  phone: string | null;
  eventLink: string | null;
  sport: string | null;
  eventType: string | null;
  createdAt: string;
}

// An event is considered "past" once its date (and time, when known) has
// elapsed. Date-only events remain visible through the end of their day.
function isEventPast(dateStr: string | null, timeStr?: string | null): boolean {
  if (!dateStr) return false;
  const timePart = timeStr && /^\d{1,2}:\d{2}/.test(timeStr) ? timeStr.slice(0, 5) : '23:59';
  const d = new Date(`${dateStr.slice(0, 10)}T${timePart}:00`);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

async function getEventsRssUrls(): Promise<string[]> {
  const rows = await dbQuery<{ value: string[] }>(`SELECT value FROM app_settings WHERE key = $1 LIMIT 1`, ['events_rss_urls']);
  const value = rows[0]?.value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as string[];
      return Array.isArray(parsed) ? parsed.filter((url) => typeof url === 'string' && url.length > 0) : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value.filter((url) => typeof url === 'string' && url.length > 0) : [];
}

async function saveEventsRssUrls(urls: string[]): Promise<string[]> {
  const clean = urls.map((url) => url.trim()).filter(Boolean);
  await dbQuery(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    ['events_rss_urls', clean],
  );
  return clean;
}

interface AdminEventRow {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  event_time: string | null;
  image_url: string | null;
  city: string | null;
  phone: string | null;
  event_link: string | null;
  sport: string | null;
  event_type: string | null;
  created_at: string;
}

const ADMIN_EVENT_COLUMNS =
  'id, title, description, event_date, event_time, image_url, city, phone, event_link, sport, event_type, created_at';

function mapAdminEventRow(row: AdminEventRow): AdminEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eventDate: row.event_date ? new Date(row.event_date).toISOString().slice(0, 10) : null,
    eventTime: row.event_time,
    imageUrl: row.image_url,
    city: row.city,
    phone: row.phone,
    eventLink: row.event_link,
    sport: row.sport,
    eventType: row.event_type,
    createdAt: row.created_at,
  };
}

// Only list events that haven't happened yet, ordered soonest first, so
// past events "disappear" from the admin console once their date passes.
export async function listAdminEvents(): Promise<AdminEvent[]> {
  const rows = await dbQuery<AdminEventRow>(
    `SELECT ${ADMIN_EVENT_COLUMNS} FROM admin_events ORDER BY event_date ASC NULLS LAST, event_time ASC NULLS LAST, created_at ASC`,
  );
  return rows.map(mapAdminEventRow).filter((event) => !isEventPast(event.eventDate, event.eventTime));
}

export async function createAdminEvent(input: {
  title: string;
  description?: string | null | undefined;
  eventDate?: string | null | undefined;
  eventTime?: string | null | undefined;
  imageUrl?: string | null | undefined;
  city?: string | null | undefined;
  phone?: string | null | undefined;
  eventLink?: string | null | undefined;
  sport?: string | null | undefined;
  eventType?: string | null | undefined;
}): Promise<AdminEvent> {
  const rows = await dbQuery<AdminEventRow>(
    `INSERT INTO admin_events (title, description, event_date, event_time, image_url, city, phone, event_link, sport, event_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${ADMIN_EVENT_COLUMNS}`,
    [
      input.title,
      input.description ?? null,
      input.eventDate ?? null,
      input.eventTime ?? null,
      input.imageUrl ?? null,
      input.city ?? null,
      input.phone ?? null,
      input.eventLink ?? null,
      input.sport ?? null,
      input.eventType ?? null,
    ],
  );
  return mapAdminEventRow(rows[0]!);
}

// Maps request field names to their DB columns. Only fields that are
// actually present in `input` (i.e. not `undefined`) are updated, so a
// `null` value explicitly clears a column while an omitted key leaves the
// existing value untouched. (A plain COALESCE-based UPDATE can't tell the
// difference between "not provided" and "explicitly cleared".)
const UPDATE_COLUMN_MAP: Record<string, string> = {
  title: 'title',
  description: 'description',
  eventDate: 'event_date',
  eventTime: 'event_time',
  imageUrl: 'image_url',
  city: 'city',
  phone: 'phone',
  eventLink: 'event_link',
  sport: 'sport',
  eventType: 'event_type',
};

export async function updateAdminEvent(
  id: string,
  input: Partial<{
    title: string | null | undefined;
    description: string | null | undefined;
    eventDate: string | null | undefined;
    eventTime: string | null | undefined;
    imageUrl: string | null | undefined;
    city: string | null | undefined;
    phone: string | null | undefined;
    eventLink: string | null | undefined;
    sport: string | null | undefined;
    eventType: string | null | undefined;
  }>,
): Promise<AdminEvent | null> {
  const entries = Object.entries(input).filter(([, value]) => value !== undefined) as [keyof typeof input, string | null][];
  if (entries.length === 0) {
    const rows = await dbQuery<AdminEventRow>(`SELECT ${ADMIN_EVENT_COLUMNS} FROM admin_events WHERE id = $1`, [id]);
    return rows[0] ? mapAdminEventRow(rows[0]) : null;
  }
  const setClauses = entries.map(([key], index) => `${UPDATE_COLUMN_MAP[key as string]} = $${index + 2}`);
  const values = entries.map(([, value]) => value);
  const rows = await dbQuery<AdminEventRow>(
    `UPDATE admin_events SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $1 RETURNING ${ADMIN_EVENT_COLUMNS}`,
    [id, ...values],
  );
  const row = rows[0];
  return row ? mapAdminEventRow(row) : null;
}

export async function deleteAdminEvent(id: string): Promise<boolean> {
  const rows = await dbQuery<{ id: string }>('DELETE FROM admin_events WHERE id = $1 RETURNING id', [id]);
  return rows.length > 0;
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
      imageUrl: null,
    };
  });
}

// Sort soonest-first so the Events tab shows the events closest in time at
// the top; events without a known date sort to the bottom.
function sortEventsByTime(events: RssEvent[]): RssEvent[] {
  return [...events].sort((a, b) => {
    const aTime = a.pubDate ? new Date(a.pubDate).getTime() : NaN;
    const bTime = b.pubDate ? new Date(b.pubDate).getTime() : NaN;
    const aValid = !Number.isNaN(aTime);
    const bValid = !Number.isNaN(bTime);
    if (aValid && bValid) return aTime - bTime;
    if (aValid) return -1;
    if (bValid) return 1;
    return a.title.localeCompare(b.title);
  });
}

async function fetchEventsFromRss(): Promise<RssEvent[]> {
  const urls = await getEventsRssUrls();
  if (urls.length === 0) return [];

  const results = await Promise.allSettled(urls.map((url) => fetchRssItems(url)));
  const items: RssEvent[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      items.push(...result.value);
    }
  }

  return sortEventsByTime(items);
}

export async function fetchPublicEvents(): Promise<RssEvent[]> {
  const [rssEvents, adminEvents] = await Promise.all([fetchEventsFromRss(), listAdminEvents()]);
  // listAdminEvents() already excludes past events; also drop any RSS items
  // whose full event date/time has passed so past events disappear everywhere.
  const upcomingRss = rssEvents.filter((event) => {
    if (!event.pubDate) return true;
    const time = new Date(event.pubDate).getTime();
    return Number.isNaN(time) || time >= Date.now();
  });
  const customEvents: RssEvent[] = adminEvents.map((event) => ({
    id: `custom::${event.id}`,
    title: event.title,
    description: event.description,
    link: event.eventLink,
    // Only attach a time-of-day when the admin explicitly set one; otherwise
    // keep a date-only value so clients treat the event as visible through
    // the end of its day rather than expiring at midnight.
    pubDate: event.eventDate
      ? event.eventTime && /^\d{1,2}:\d{2}/.test(event.eventTime)
        ? `${event.eventDate}T${event.eventTime.slice(0, 5)}:00`
        : event.eventDate
      : null,
    sourceName: null,
    imageUrl: event.imageUrl,
    city: event.city,
    phone: event.phone,
    sport: event.sport,
    eventType: event.eventType,
  }));
  return sortEventsByTime([...upcomingRss, ...customEvents]);
}

export { getEventsRssUrls, saveEventsRssUrls };
