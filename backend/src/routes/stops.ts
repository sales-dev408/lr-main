import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dbQuery } from '../db/pool.js';

export interface StopRecord {
  id: string;
  name: string;
  city: string | null;
  line: string | null;
  position: number | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

const stopSchema = z.object({
  name: z.string().min(1),
  city: z.string().optional().nullable(),
  line: z.string().optional().nullable(),
  position: z.number().int().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export async function listStops(): Promise<StopRecord[]> {
  return dbQuery<StopRecord>(
    'SELECT id, name, city, line, position, latitude, longitude, created_at, updated_at FROM stops ORDER BY position NULLS LAST, name',
  );
}

export async function getStop(id: string): Promise<StopRecord | null> {
  const rows = await dbQuery<StopRecord>(
    'SELECT id, name, city, line, position, latitude, longitude, created_at, updated_at FROM stops WHERE id = $1 LIMIT 1',
    [id],
  );
  return rows[0] ?? null;
}

export async function createStop(input: z.infer<typeof stopSchema>): Promise<StopRecord> {
  const rows = await dbQuery<StopRecord>(
    `INSERT INTO stops (name, city, line, position, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, city, line, position, latitude, longitude, created_at, updated_at`,
    [input.name, input.city ?? null, input.line ?? null, input.position ?? null, input.latitude ?? null, input.longitude ?? null],
  );
  return rows[0]!;
}

type StopUpdateInput = Omit<Partial<z.infer<typeof stopSchema>>, 'name'> & { name?: string | undefined };

export async function updateStop(id: string, input: StopUpdateInput): Promise<StopRecord | null> {
  const rows = await dbQuery<StopRecord>(
    `UPDATE stops
     SET name = COALESCE($2, name),
         city = COALESCE($3, city),
         line = COALESCE($4, line),
         position = COALESCE($5, position),
         latitude = COALESCE($6, latitude),
         longitude = COALESCE($7, longitude),
         updated_at = now()
     WHERE id = $1
     RETURNING id, name, city, line, position, latitude, longitude, created_at, updated_at`,
    [id, input.name ?? null, input.city ?? null, input.line ?? null, input.position ?? null, input.latitude ?? null, input.longitude ?? null],
  );
  return rows[0] ?? null;
}

export async function deleteStop(id: string): Promise<boolean> {
  const rows = await dbQuery<{ id: string }>('DELETE FROM stops WHERE id = $1 RETURNING id', [id]);
  return rows.length > 0;
}

export async function registerStopsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/stops', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async () => listStops());

  fastify.get(
    '/api/admin/stops',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async () => listStops(),
  );

  fastify.post(
    '/api/admin/stops',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = stopSchema.parse(request.body);
      return reply.code(201).send(await createStop(body));
    },
  );

  fastify.get(
    '/api/admin/stops/:id',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const row = await getStop(id);
      if (!row) return reply.code(404).send({ error: 'Stop not found' });
      return row;
    },
  );

  fastify.patch(
    '/api/admin/stops/:id',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const body = stopSchema.partial().parse(request.body);
      const updated = await updateStop(id, body);
      if (!updated) return reply.code(404).send({ error: 'Stop not found' });
      return updated;
    },
  );

  fastify.delete(
    '/api/admin/stops/:id',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const deleted = await deleteStop(id);
      return reply.code(deleted ? 204 : 404).send();
    },
  );
}
