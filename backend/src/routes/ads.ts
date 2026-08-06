import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dbQuery } from '../db/pool.js';

const adSchema = z.object({
  slot: z.number().int().min(1).max(3),
  image_url: z.string().min(1),
  link_url: z.string().optional(),
  active: z.boolean().default(true),
});

const adUpdateSchema = adSchema.partial();

export async function registerAdsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/ads', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => {
    return dbQuery(
      'SELECT id, slot, image_url, link_url, active, created_at, updated_at FROM ads WHERE active = true ORDER BY slot',
    );
  });

  fastify.get('/api/admin/ads', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => {
    return dbQuery(
      'SELECT id, slot, image_url, link_url, active, created_at, updated_at FROM ads ORDER BY slot',
    );
  });

  fastify.post(
    '/api/admin/ads',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = adSchema.parse(request.body);
      const rows = await dbQuery<{ id: string; created_at: string; updated_at: string }>(
        `INSERT INTO ads (slot, image_url, link_url, active)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (slot) DO UPDATE
         SET image_url = EXCLUDED.image_url,
             link_url = EXCLUDED.link_url,
             active = EXCLUDED.active,
             updated_at = now()
         RETURNING id, created_at, updated_at`,
        [body.slot, body.image_url, body.link_url ?? null, body.active],
      );
      return reply.code(201).send({ ...rows[0], ...body });
    },
  );

  fastify.patch(
    '/api/admin/ads/:id',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const body = adUpdateSchema.parse(request.body);
      const rows = await dbQuery(
        `UPDATE ads
         SET slot = COALESCE($2, slot),
             image_url = COALESCE($3, image_url),
             link_url = COALESCE($4, link_url),
             active = COALESCE($5, active),
             updated_at = now()
         WHERE id = $1
         RETURNING id, slot, image_url, link_url, active, created_at, updated_at`,
        [id, body.slot ?? null, body.image_url ?? null, body.link_url ?? null, body.active ?? null],
      );
      if (rows.length === 0) {
        return reply.code(404).send({ error: 'Ad not found' });
      }
      return rows[0];
    },
  );

  fastify.delete(
    '/api/admin/ads/:id',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const rows = await dbQuery<{ id: string }>('DELETE FROM ads WHERE id = $1 RETURNING id', [id]);
      if (rows.length === 0) {
        return reply.code(404).send({ error: 'Ad not found' });
      }
      return { deleted: true };
    },
  );
}
