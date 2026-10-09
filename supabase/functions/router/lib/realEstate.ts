import { dbQuery } from './db.ts';
import { z } from 'npm:zod';

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

export const realEstateSchema = z.object({
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
  return dbQuery<RealEstateRecord>(`SELECT ${COLUMNS} FROM real_estate ${where} ORDER BY created_at DESC`, []);
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

export async function updateRealEstate(
  id: string,
  input: Partial<z.infer<typeof realEstateSchema>>,
): Promise<RealEstateRecord | null> {
  const rows = await dbQuery<RealEstateRecord>(
    `UPDATE real_estate
     SET title = COALESCE($2, title),
         description = COALESCE($3, description),
         price = COALESCE($4, price),
         beds = COALESCE($5, beds),
         baths = COALESCE($6, baths),
         sqft = COALESCE($7, sqft),
         property_type = COALESCE($8, property_type),
         listing_status = COALESCE($9, listing_status),
         address = COALESCE($10, address),
         city = COALESCE($11, city),
         state = COALESCE($12, state),
         zip = COALESCE($13, zip),
         phone = COALESCE($14, phone),
         email = COALESCE($15, email),
         website = COALESCE($16, website),
         image_url = COALESCE($17, image_url),
         station = COALESCE($18, station),
         latitude = COALESCE($19, latitude),
         longitude = COALESCE($20, longitude),
         active = COALESCE($21, active),
         updated_at = now()
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [
      id,
      input.title ?? null,
      input.description ?? null,
      input.price ?? null,
      input.beds ?? null,
      input.baths ?? null,
      input.sqft ?? null,
      input.property_type ?? null,
      input.listing_status ?? null,
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
      input.active ?? null,
    ],
  );
  return rows[0] ?? null;
}

export async function deleteRealEstate(id: string): Promise<boolean> {
  const rows = await dbQuery<{ id: string }>('DELETE FROM real_estate WHERE id = $1 RETURNING id', [id]);
  return rows.length > 0;
}
