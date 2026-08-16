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

const MILES_PER_METER = 0.000621371;

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 3958.8 * c; // Earth radius in miles
}

async function nearestRailStop(latitude: number, longitude: number): Promise<{ station: string | null; distanceMiles: number | null }> {
  const rows = await dbQuery<{ station: string; lat: number; lng: number }>(
    `SELECT station, AVG(latitude) AS lat, AVG(longitude) AS lng
     FROM vendors
     WHERE station IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL
     GROUP BY station`,
  );
  let nearest: { station: string | null; distanceMiles: number | null } = { station: null, distanceMiles: null };
  let best = Infinity;
  for (const row of rows) {
    const d = haversineMiles(latitude, longitude, row.lat, row.lng);
    if (d < best) {
      best = d;
      nearest = { station: row.station, distanceMiles: d };
    }
  }
  return nearest;
}

function railProximity(station: string | null, distanceMiles: number | null): { nearRail: boolean; station: string | null; distanceMiles: number | null } {
  if (!station || distanceMiles === null) return { nearRail: false, station: null, distanceMiles: null };
  return { nearRail: distanceMiles <= 0.5, station, distanceMiles };
}

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
  let station = input.station ?? null;
  let nearRail = false;
  let distanceMiles: number | null = null;
  if (input.latitude != null && input.longitude != null) {
    const nearest = await nearestRailStop(input.latitude, input.longitude);
    const proximity = railProximity(nearest.station, nearest.distanceMiles);
    station = proximity.station ?? station;
    nearRail = proximity.nearRail;
    distanceMiles = proximity.distanceMiles;
  }
  const rows = await dbQuery<ApartmentRecord>(
    `INSERT INTO apartments_hotels (name, section, station, address, city, state, zip, phone, website, latitude, longitude, near_rail, distance_miles)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING ${COLUMNS}`,
    [input.name, input.section ?? null, station, input.address ?? null, input.city ?? null, input.state ?? null, input.zip ?? null, input.phone ?? null, input.website ?? null, input.latitude ?? null, input.longitude ?? null, nearRail, distanceMiles],
  );
  return rows[0]!;
}

export async function updateApartment(
  id: string,
  input: Partial<z.infer<typeof apartmentSchema>>,
): Promise<ApartmentRecord | null> {
  const existing = await getApartment(id);
  if (!existing) return null;
  const latitude = input.latitude ?? existing.latitude;
  const longitude = input.longitude ?? existing.longitude;
  let station = input.station ?? existing.station;
  let nearRail = existing.near_rail;
  let distanceMiles = existing.distance_miles;
  if (latitude != null && longitude != null) {
    const nearest = await nearestRailStop(latitude, longitude);
    const proximity = railProximity(nearest.station, nearest.distanceMiles);
    station = proximity.station ?? station;
    nearRail = proximity.nearRail;
    distanceMiles = proximity.distanceMiles;
  }
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
         near_rail = COALESCE($13, near_rail),
         distance_miles = COALESCE($14, distance_miles),
         updated_at = now()
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id, input.name ?? null, input.section ?? null, station, input.address ?? null, input.city ?? null, input.state ?? null, input.zip ?? null, input.phone ?? null, input.website ?? null, input.latitude ?? null, input.longitude ?? null, nearRail, distanceMiles],
  );
  return rows[0] ?? null;
}

export async function deleteApartment(id: string): Promise<boolean> {
  const rows = await dbQuery<{ id: string }>('DELETE FROM apartments_hotels WHERE id = $1 RETURNING id', [id]);
  return rows.length > 0;
}
