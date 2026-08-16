import { dbQuery } from './db.ts';
import { z } from 'npm:zod';

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
  near_rail: boolean;
  distance_miles: number | null;
  created_at: string;
  updated_at: string;
}

export const apartmentSchema = z.object({
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

const COLUMNS = 'id, name, section, station, address, city, state, zip, phone, website, latitude, longitude, near_rail, distance_miles, created_at, updated_at';

export async function listApartments(opts: { nearRail?: boolean } = {}): Promise<ApartmentRecord[]> {
  const conditions: string[] = [];
  const values: (boolean | null)[] = [];
  if (opts.nearRail) {
    values.push(true);
    conditions.push(`near_rail = $${values.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return dbQuery<ApartmentRecord>(`SELECT ${COLUMNS} FROM apartments_hotels ${where} ORDER BY section NULLS LAST, name`, values);
}

export async function getApartment(id: string): Promise<ApartmentRecord | null> {
  const rows = await dbQuery<ApartmentRecord>(`SELECT ${COLUMNS} FROM apartments_hotels WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function createApartment(input: z.infer<typeof apartmentSchema>): Promise<ApartmentRecord> {
  const rows = await dbQuery<ApartmentRecord>(
    `INSERT INTO apartments_hotels (name, section, station, address, city, state, zip, phone, website, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${COLUMNS}`,
    [input.name, input.section ?? null, input.station ?? null, input.address ?? null, input.city ?? null, input.state ?? null, input.zip ?? null, input.phone ?? null, input.website ?? null, input.latitude ?? null, input.longitude ?? null],
  );
  return rows[0]!;
}

export async function updateApartment(
  id: string,
  input: Partial<z.infer<typeof apartmentSchema>>,
): Promise<ApartmentRecord | null> {
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
     RETURNING ${COLUMNS}`,
    [id, input.name ?? null, input.section ?? null, input.station ?? null, input.address ?? null, input.city ?? null, input.state ?? null, input.zip ?? null, input.phone ?? null, input.website ?? null, input.latitude ?? null, input.longitude ?? null],
  );
  return rows[0] ?? null;
}

export async function deleteApartment(id: string): Promise<boolean> {
  const rows = await dbQuery<{ id: string }>('DELETE FROM apartments_hotels WHERE id = $1 RETURNING id', [id]);
  return rows.length > 0;
}
