import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { dbQuery, withDbClient } from '../db/pool.js';

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

const adminSettingsSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  location: z.string().optional(),
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

interface PublishedSnapshot {
  id: string;
  version: number;
  published_at: string;
  published_by: string | null;
  content: unknown[];
}

async function getLatestPublishedSnapshot(): Promise<PublishedSnapshot | null> {
  const rows = await dbQuery<PublishedSnapshot>(
    'SELECT id, version, published_at, published_by, content FROM content_published ORDER BY version DESC LIMIT 1',
  );
  return rows[0] ?? null;
}

async function getPublishedContentBlocks(): Promise<unknown[]> {
  return dbQuery(
    'SELECT id, kind, title, body, url, position, published, created_at, updated_at FROM content_blocks WHERE published = true ORDER BY position, created_at',
  );
}

async function publishContent(adminId?: string | null): Promise<PublishedSnapshot> {
  const content = await getPublishedContentBlocks();
  return withDbClient(async (client) => {
    const result = await client.query<{ version: number }>('SELECT COALESCE(MAX(version), 0) + 1 AS version FROM content_published');
    const version = result.rows[0]!.version;
    const insert = await client.query<PublishedSnapshot>(
      'INSERT INTO content_published (version, published_by, content) VALUES ($1, $2, $3::jsonb) RETURNING *',
      [version, adminId ?? null, JSON.stringify(content)],
    );
    return insert.rows[0]!;
  });
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

  fastify.get('/api/content', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const snapshot = await getLatestPublishedSnapshot();
    if (snapshot) {
      reply.header('X-Content-Version', snapshot.version);
      return snapshot.content;
    }
    const fallback = await getPublishedContentBlocks();
    reply.header('X-Content-Version', 0);
    return fallback;
  });

  fastify.get('/api/content/version', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => {
    const snapshot = await getLatestPublishedSnapshot();
    return {
      version: snapshot?.version ?? 0,
      publishedAt: snapshot?.published_at ?? null,
    };
  });

  fastify.get('/api/admin/content', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => {
    return dbQuery(
      'SELECT id, kind, title, body, url, position, published, created_at, updated_at FROM content_blocks ORDER BY position, created_at',
    );
  });

  fastify.get('/api/admin/content/status', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => {
    const snapshot = await getLatestPublishedSnapshot();
    const draftRow = (await dbQuery<{ count: number }>("SELECT COUNT(*)::int AS count FROM content_blocks WHERE published = false"))[0];
    const publishedRow = (await dbQuery<{ count: number }>("SELECT COUNT(*)::int AS count FROM content_blocks WHERE published = true"))[0];
    const draftCount = draftRow?.count ?? 0;
    const publishedCount = publishedRow?.count ?? 0;
    return {
      currentVersion: snapshot?.version ?? 0,
      publishedAt: snapshot?.published_at ?? null,
      publishedCount,
      draftCount,
    };
  });

  fastify.post('/api/admin/content/publish', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const admin = request.user!;
    const snapshot = await publishContent(admin.sub);
    return reply.send({
      version: snapshot.version,
      publishedAt: snapshot.published_at,
      count: Array.isArray(snapshot.content) ? snapshot.content.length : 0,
    });
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

  async function getAdminRow(adminId: string): Promise<{ id: string; email: string; role: string; location: string | null } | undefined> {
    const rows = await dbQuery<{ id: string; email: string; role: string; location: string | null }>(
      'SELECT id, email::text AS email, role, location FROM admins WHERE id = $1 LIMIT 1',
      [adminId],
    );
    return rows[0];
  }

  fastify.get('/api/admin/profile', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request) => {
    const admin = request.user!;
    const row = await getAdminRow(admin.sub);
    return row ?? { id: admin.sub, email: admin.email ?? '', role: admin.role, location: null };
  });

  fastify.get('/api/admin/settings', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request) => {
    const admin = request.user!;
    const row = await getAdminRow(admin.sub);
    return row ?? { id: admin.sub, email: admin.email ?? '', role: admin.role, location: null };
  });

  fastify.patch('/api/admin/settings', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const admin = request.user!;
    const body = adminSettingsSchema.parse(request.body);
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.email !== undefined) {
      updates.push(`email = $${idx++}`);
      values.push(body.email);
    }
    if (body.location !== undefined) {
      updates.push(`location = $${idx++}`);
      values.push(body.location);
    }
    if (body.password !== undefined) {
      updates.push(`password_hash = $${idx++}`);
      values.push(await bcrypt.hash(body.password, 10));
    }

    if (updates.length === 0) {
      return reply.code(400).send({ error: 'No fields to update' });
    }

    updates.push('updated_at = now()');
    values.push(admin.sub);

    const rows = await dbQuery<{ id: string; email: string; role: string; location: string | null }>(
      `UPDATE admins SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, email::text AS email, role, location`,
      values,
    );

    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Admin not found' });
    }
    return rows[0];
  });
}
