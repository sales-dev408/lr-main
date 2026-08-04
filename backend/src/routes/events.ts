import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dbQuery } from '../db/pool.js';

export interface RssEvent {
  id: string;
  title: string;
  description: string | null;
  link: string | null;
  pubDate: string | null;
  sourceName: string | null;
}

export interface AdminEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: string | null;
  createdAt: string;
}

const adminEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  eventDate: z.string().optional(),
});

async function getEventsRssUrls(): Promise<string[]> {
  const rows = await dbQuery<{ value: unknown }>("SELECT value FROM app_settings WHERE key = 'events_rss_urls' LIMIT 1");
  const value = rows[0]?.value;
  return Array.isArray(value) ? value.filter((url): url is string => typeof url === 'string' && url.length > 0) : [];
}

async function saveEventsRssUrls(urls: string[]): Promise<string[]> {
  const clean = urls.map((url) => url.trim()).filter(Boolean);
  await dbQuery(
    "INSERT INTO app_settings (key, value, updated_at) VALUES ('events_rss_urls', $1::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
    [JSON.stringify(clean)],
  );
  return clean;
}

async function listAdminEvents(): Promise<AdminEvent[]> {
  const rows = await dbQuery<{ id: string; title: string; description: string | null; event_date: string | null; created_at: string }>(
    'SELECT id, title, description, event_date, created_at FROM admin_events ORDER BY event_date DESC NULLS LAST, created_at DESC',
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    eventDate: row.event_date ? new Date(row.event_date).toISOString().slice(0, 10) : null,
    createdAt: row.created_at,
  }));
}

async function createAdminEvent(input: { title: string; description?: string | undefined; eventDate?: string | undefined }): Promise<AdminEvent> {
  const rows = await dbQuery<{ id: string; title: string; description: string | null; event_date: string | null; created_at: string }>(
    'INSERT INTO admin_events (title, description, event_date) VALUES ($1, $2, $3) RETURNING id, title, description, event_date, created_at',
    [input.title, input.description ?? null, input.eventDate ?? null],
  );
  const row = rows[0]!;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eventDate: row.event_date ? new Date(row.event_date).toISOString().slice(0, 10) : null,
    createdAt: row.created_at,
  };
}

async function updateAdminEvent(
  id: string,
  input: Partial<{ title: string | undefined; description: string | null | undefined; eventDate: string | null | undefined }>,
): Promise<AdminEvent | null> {
  const rows = await dbQuery<{ id: string; title: string; description: string | null; event_date: string | null; created_at: string }>(
    `UPDATE admin_events
     SET title = COALESCE($2, title),
         description = COALESCE($3, description),
         event_date = COALESCE($4, event_date),
         updated_at = now()
     WHERE id = $1
     RETURNING id, title, description, event_date, created_at`,
    [id, input.title ?? null, input.description ?? null, input.eventDate ?? null],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eventDate: row.event_date ? new Date(row.event_date).toISOString().slice(0, 10) : null,
    createdAt: row.created_at,
  };
}

async function deleteAdminEvent(id: string): Promise<boolean> {
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
  return match ? decodeXmlEntities(stripHtml((match[1] ?? '').trim())) || null : null;
}

function extractAtomLink(entry: string): string | null {
  const linkMatch = /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/is.exec(entry);
  if (linkMatch) return (linkMatch[1] ?? '').trim();
  const altMatch = /<link[^>]*>([^<]+)<\/link>/is.exec(entry);
  return altMatch ? (altMatch[1] ?? '').trim() : null;
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

  return items.sort((a, b) => {
    const aTime = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const bTime = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    if (aTime && bTime) return bTime - aTime;
    if (aTime) return -1;
    if (bTime) return 1;
    return a.title.localeCompare(b.title);
  });
}

export async function fetchPublicEvents(): Promise<RssEvent[]> {
  const [rssEvents, adminEvents] = await Promise.all([fetchEventsFromRss(), listAdminEvents()]);
  const customEvents: RssEvent[] = adminEvents.map((event) => ({
    id: `custom::${event.id}`,
    title: event.title,
    description: event.description,
    link: null,
    pubDate: event.eventDate,
    sourceName: 'Manual',
  }));
  const all = [...rssEvents, ...customEvents];
  return all.sort((a, b) => {
    const aTime = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const bTime = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    if (aTime && bTime) return bTime - aTime;
    if (aTime) return -1;
    if (bTime) return 1;
    return a.title.localeCompare(b.title);
  });
}

export async function registerEventsRoutes(fastify: FastifyInstance): Promise<void> {
  // lgtm[js/missing-rate-limit]
  fastify.get('/api/events', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async () => fetchPublicEvents());

  // lgtm[js/missing-rate-limit]
  fastify.get('/api/admin/events', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async () => ({
    urls: await getEventsRssUrls(),
    events: await listAdminEvents(),
  }));

  // lgtm[js/missing-rate-limit]
  fastify.patch(
    '/api/admin/events',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = request.body as { urls?: unknown };
      const urls = Array.isArray(body.urls)
        ? body.urls.filter((url): url is string => typeof url === 'string' && url.length > 0)
        : [];
      return reply.send({ urls: await saveEventsRssUrls(urls) });
    },
  );

  fastify.post(
    '/api/admin/events/custom',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = adminEventSchema.parse(request.body);
      return reply.code(201).send(await createAdminEvent(body));
    },
  );

  fastify.patch(
    '/api/admin/events/custom/:id',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const body = adminEventSchema.partial().parse(request.body);
      const updated = await updateAdminEvent(id, body);
      if (!updated) return reply.code(404).send({ error: 'Event not found' });
      return reply.send(updated);
    },
  );

  fastify.delete(
    '/api/admin/events/custom/:id',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const deleted = await deleteAdminEvent(id);
      return reply.code(deleted ? 204 : 404).send();
    },
  );
}
