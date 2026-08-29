import { dbQuery } from './db.ts';
import { z } from 'npm:zod';

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

export const stopSchema = z.object({
  name: z.string().min(1),
  city: z.string().optional().nullable(),
  line: z.string().optional().nullable(),
  position: z.number().int().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

const COLUMNS = 'id, name, city, line, position, latitude, longitude, created_at, updated_at';

export async function listStops(): Promise<StopRecord[]> {
  return dbQuery<StopRecord>(
    `SELECT ${COLUMNS} FROM stops ORDER BY position NULLS LAST, name`,
  );
}

export async function getStop(id: string): Promise<StopRecord | null> {
  const rows = await dbQuery<StopRecord>(
    `SELECT ${COLUMNS} FROM stops WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function createStop(input: z.infer<typeof stopSchema>): Promise<StopRecord> {
  const rows = await dbQuery<StopRecord>(
    `INSERT INTO stops (name, city, line, position, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNS}`,
    [input.name, input.city ?? null, input.line ?? null, input.position ?? null, input.latitude ?? null, input.longitude ?? null],
  );
  return rows[0]!;
}

export async function updateStop(id: string, input: Partial<z.infer<typeof stopSchema>>): Promise<StopRecord | null> {
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
     RETURNING ${COLUMNS}`,
    [id, input.name ?? null, input.city ?? null, input.line ?? null, input.position ?? null, input.latitude ?? null, input.longitude ?? null],
  );
  return rows[0] ?? null;
}

export async function deleteStop(id: string): Promise<boolean> {
  const rows = await dbQuery<{ id: string }>('DELETE FROM stops WHERE id = $1 RETURNING id', [id]);
  return rows.length > 0;
}
