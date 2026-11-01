import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dbQuery } from '../db/pool.js';

export interface RealEstateRecord {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  property_type: string | null;
  listing_status: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  image_url: string | null;
  station: string | null;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const realEstateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  price: z.number().optional().nullable(),
  beds: z.number().optional().nullable(),
  baths: z.number().optional().nullable(),
  sqft: z.number().int().optional().nullable(),
  property_type: z.string().optional().nullable(),
  listing_status: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  station: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  active: z.boolean().optional(),
});

const COLUMNS =
  'id, title, description, price, beds, baths, sqft, property_type, listing_status, address, city, state, zip, phone, email, website, image_url, station, latitude, longitude, active, created_at, updated_at';

export async function listRealEstate(opts: { activeOnly?: boolean } = {}): Promise<RealEstateRecord[]> {
  const where = opts.activeOnly ? 'WHERE active = true' : '';
  return dbQuery<RealEstateRecord>(`SELECT ${COLUMNS} FROM real_estate ${where} ORDER BY created_at DESC`);
}

export async function getRealEstate(id: string): Promise<RealEstateRecord | null> {
  const rows = await dbQuery<RealEstateRecord>(`SELECT ${COLUMNS} FROM real_estate WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function createRealEstate(input: z.infer<typeof realEstateSchema>): Promise<RealEstateRecord> {
  const rows = await dbQuery<RealEstateRecord>(
    `INSERT INTO real_estate (title, description, price, beds, baths, sqft, property_type, listing_status, address, city, state, zip, phone, email, website, image_url, station, latitude, longitude, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
     RETURNING ${COLUMNS}`,
    [
      input.title,
      input.description ?? null,
      input.price ?? null,
      input.beds ?? null,
      input.baths ?? null,
      input.sqft ?? null,
      input.property_type ?? null,
      input.listing_status ?? 'for_sale',
      input.address ?? null,
      input.city ?? null,
      input.state ?? null,
      input.zip ?? null,
      input.phone ?? null,
      input.email ?? null,
      input.website ?? null,
      input.image_url ?? null,
      input.station ?? null,
      input.latitude ?? null,
      input.longitude ?? null,
      input.active ?? true,
    ],
  );
  return rows[0]!;
}

type RealEstateUpdateInput = Omit<Partial<z.infer<typeof realEstateSchema>>, 'title'> & { title?: string | undefined };

// Only keys actually present in `input` are written, so an explicit `null`
// clears a column while an omitted key leaves it untouched.
const REAL_ESTATE_UPDATE_COLUMNS: Record<string, string> = {
  title: 'title',
  description: 'description',
  price: 'price',
  beds: 'beds',
  baths: 'baths',
  sqft: 'sqft',
  property_type: 'property_type',
  listing_status: 'listing_status',
  address: 'address',
  city: 'city',
  state: 'state',
  zip: 'zip',
  phone: 'phone',
  email: 'email',
  website: 'website',
  image_url: 'image_url',
  station: 'station',
  latitude: 'latitude',
  longitude: 'longitude',
  active: 'active',
};

export async function updateRealEstate(id: string, input: RealEstateUpdateInput): Promise<RealEstateRecord | null> {
  const entries = Object.entries(input).filter(([key, value]) => value !== undefined && REAL_ESTATE_UPDATE_COLUMNS[key]);
  if (entries.length === 0) return getRealEstate(id);
  const setClauses = entries.map(([key], index) => `${REAL_ESTATE_UPDATE_COLUMNS[key]} = $${index + 2}`);
  const values = entries.map(([, value]) => value);
  const rows = await dbQuery<RealEstateRecord>(
    `UPDATE real_estate SET ${setClauses.join(', ')}, updated_at = now()
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id, ...values],
  );
  return rows[0] ?? null;
}

export async function deleteRealEstate(id: string): Promise<boolean> {
  const rows = await dbQuery<{ id: string }>('DELETE FROM real_estate WHERE id = $1 RETURNING id', [id]);
  return rows.length > 0;
}

export async function registerRealEstateRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/real-estate', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () =>
    dbQuery<RealEstateRecord>(`SELECT ${COLUMNS} FROM real_estate WHERE active = true ORDER BY created_at DESC`),
  );

  fastify.get(
    '/api/admin/real-estate',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async () => listRealEstate(),
  );

  fastify.post(
    '/api/admin/real-estate',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = realEstateSchema.parse(request.body);
      return reply.code(201).send(await createRealEstate(body));
    },
  );

  fastify.get(
    '/api/admin/real-estate/:id',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const row = await getRealEstate(id);
      if (!row) return reply.code(404).send({ error: 'Listing not found' });
      return row;
    },
  );

  fastify.patch(
    '/api/admin/real-estate/:id',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const body = realEstateSchema.partial().parse(request.body);
      const updated = await updateRealEstate(id, body);
      if (!updated) return reply.code(404).send({ error: 'Listing not found' });
      return updated;
    },
  );

  fastify.delete(
    '/api/admin/real-estate/:id',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const deleted = await deleteRealEstate(id);
      return reply.code(deleted ? 204 : 404).send();
    },
  );
}
