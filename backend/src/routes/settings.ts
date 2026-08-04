import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dbQuery } from '../db/pool.js';

const themeTabSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  color: z.string().min(1),
  gradient: z.tuple([z.string(), z.string()]),
});

const themeSchema = z.object({
  brand: z.string().min(1),
  primaryGradient: z.tuple([z.string(), z.string()]),
  tabs: z.array(themeTabSchema),
}).passthrough();

const contentSchema = z.object({
  kind: z.enum(['text', 'article', 'image', 'file', 'embed']),
  title: z.string().min(1),
  body: z.string().optional(),
  url: z.string().optional(),
  dataUrl: z.string().optional(),
  position: z.number().int().default(0),
  published: z.boolean().default(true),
});

async function getThemeValue(): Promise<unknown> {
  const rows = await dbQuery<{ value: unknown }>("SELECT value FROM app_settings WHERE key = 'theme' LIMIT 1");
  return rows[0]?.value ?? null;
}

async function setThemeValue(value: unknown): Promise<void> {
  await dbQuery(
    "INSERT INTO app_settings (key, value, updated_at) VALUES ('theme', $1::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
    [JSON.stringify(value)],
  );
}

export async function registerSettingsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/settings/theme', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => {
    const value = await getThemeValue();
    return value ?? {};
  });

  fastify.get('/api/admin/settings/theme', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => {
    const value = await getThemeValue();
    return value ?? {};
  });

  fastify.patch('/api/admin/settings/theme', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = themeSchema.parse(request.body);
    await setThemeValue(body);
    return reply.send(body);
  });

  fastify.get('/api/content', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => {
    return dbQuery(
      'SELECT id, kind, title, body, url, position, published, created_at, updated_at FROM content_blocks WHERE published = true ORDER BY position, created_at',
    );
  });

  fastify.get('/api/admin/content', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => {
    return dbQuery(
      'SELECT id, kind, title, body, url, position, published, created_at, updated_at FROM content_blocks ORDER BY position, created_at',
    );
  });

  fastify.post('/api/admin/content', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = contentSchema.parse(request.body);
    const url = body.dataUrl || body.url || null;
    const rows = await dbQuery<{ id: string; created_at: string; updated_at: string }>(
      'INSERT INTO content_blocks (kind, title, body, url, position, published) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at, updated_at',
      [body.kind, body.title, body.body ?? null, url, body.position, body.published],
    );
    return reply.code(201).send({ ...rows[0], ...body, url });
  });

  fastify.patch('/api/admin/content/:id', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const body = contentSchema.partial().parse(request.body);
    const url =
      body.dataUrl !== undefined
        ? body.dataUrl || null
        : body.url !== undefined
          ? body.url || null
          : undefined;
    const rows = await dbQuery(
      `
        UPDATE content_blocks
        SET kind = COALESCE($2, kind),
            title = COALESCE($3, title),
            body = COALESCE($4, body),
            url = COALESCE($5, url),
            position = COALESCE($6, position),
            published = COALESCE($7, published),
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [id, body.kind ?? null, body.title ?? null, body.body ?? null, url ?? null, body.position ?? null, body.published ?? null],
    );
    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Content not found' });
    }
    return rows[0];
  });

  fastify.delete('/api/admin/content/:id', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const rows = await dbQuery<{ id: string }>('DELETE FROM content_blocks WHERE id = $1 RETURNING id', [id]);
    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Content not found' });
    }
    return { deleted: true };
  });
}
