import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dbQuery } from '../db/pool.js';

export interface ApartmentRecord {
  id: string;
  name: string;
  section: string | null;
  station: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

const apartmentSchema = z.object({
  name: z.string().min(1),
  section: z.string().optional().nullable(),
  station: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export async function listApartments(): Promise<ApartmentRecord[]> {
  return dbQuery<ApartmentRecord>(
    'SELECT id, name, section, station, address, city, state, zip, phone, website, latitude, longitude, created_at, updated_at FROM apartments_hotels ORDER BY section NULLS LAST, name',
  );
}

export async function getApartment(id: string): Promise<ApartmentRecord | null> {
  const rows = await dbQuery<ApartmentRecord>(
    'SELECT id, name, section, station, address, city, state, zip, phone, website, latitude, longitude, created_at, updated_at FROM apartments_hotels WHERE id = $1 LIMIT 1',
    [id],
  );
  return rows[0] ?? null;
}

export async function createApartment(input: z.infer<typeof apartmentSchema>): Promise<ApartmentRecord> {
  const rows = await dbQuery<ApartmentRecord>(
    `INSERT INTO apartments_hotels (name, section, station, address, city, state, zip, phone, website, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, name, section, station, address, city, state, zip, phone, website, latitude, longitude, created_at, updated_at`,
    [input.name, input.section ?? null, input.station ?? null, input.address ?? null, input.city ?? null, input.state ?? null, input.zip ?? null, input.phone ?? null, input.website ?? null, input.latitude ?? null, input.longitude ?? null],
  );
  return rows[0]!;
}

type ApartmentUpdateInput = Omit<Partial<z.infer<typeof apartmentSchema>>, 'name'> & { name?: string | undefined };

export async function updateApartment(id: string, input: ApartmentUpdateInput): Promise<ApartmentRecord | null> {
  const rows = await dbQuery<ApartmentRecord>(
    `UPDATE apartments_hotels
     SET name = COALESCE($2, name),
         section = COALESCE($3, section),
         station = COALESCE($4, station),
         address = COALESCE($5, address),
         city = COALESCE($6, city),
         state = COALESCE($7, state),
         zip = COALESCE($8, zip),
         phone = COALESCE($9, phone),
         website = COALESCE($10, website),
         latitude = COALESCE($11, latitude),
         longitude = COALESCE($12, longitude),
         updated_at = now()
     WHERE id = $1
     RETURNING id, name, section, station, address, city, state, zip, phone, website, latitude, longitude, created_at, updated_at`,
    [id, input.name, input.section ?? null, input.station ?? null, input.address ?? null, input.city ?? null, input.state ?? null, input.zip ?? null, input.phone ?? null, input.website ?? null, input.latitude ?? null, input.longitude ?? null],
  );
  return rows[0] ?? null;
}

export async function deleteApartment(id: string): Promise<boolean> {
  const rows = await dbQuery<{ id: string }>('DELETE FROM apartments_hotels WHERE id = $1 RETURNING id', [id]);
  return rows.length > 0;
}

export async function registerApartmentsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/apartments', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => listApartments());

  fastify.get(
    '/api/admin/apartments',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async () => listApartments(),
  );

  fastify.post(
    '/api/admin/apartments',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = apartmentSchema.parse(request.body);
      return reply.code(201).send(await createApartment(body));
    },
  );

  fastify.get(
    '/api/admin/apartments/:id',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const row = await getApartment(id);
      if (!row) return reply.code(404).send({ error: 'Apartment not found' });
      return row;
    },
  );

  fastify.patch(
    '/api/admin/apartments/:id',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const body = apartmentSchema.partial().parse(request.body);
      const updated = await updateApartment(id, body);
      if (!updated) return reply.code(404).send({ error: 'Apartment not found' });
      return updated;
    },
  );

  fastify.delete(
    '/api/admin/apartments/:id',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const deleted = await deleteApartment(id);
      return reply.code(deleted ? 204 : 404).send();
    },
  );
}
