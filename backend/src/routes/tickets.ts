import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dbQuery } from '../db/pool.js';

const ticketCreateSchema = z.object({
  barcode: z.string().min(1),
  barcodeFormat: z.string().optional(),
  name: z.string().min(1).default('Event Ticket'),
  allowedUses: z.coerce.number().int().positive().default(1),
  drawingDate: z.string().optional(),
  userId: z.string().uuid().optional(),
});

const ticketUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  barcode: z.string().min(1).optional(),
  barcodeFormat: z.string().optional(),
  allowedUses: z.coerce.number().int().positive().optional(),
  usedUses: z.coerce.number().int().min(0).optional(),
  status: z.enum(['active', 'used', 'disabled']).optional(),
  drawingDate: z.string().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
});

export async function registerTicketRoutes(fastify: FastifyInstance): Promise<void> {
  // Public customer-facing list (scoped to a user when authenticated).
  fastify.get('/api/tickets', { config: { rateLimit: { max: 100, timeWindow: '1 minute' } } }, async (request) => {
    const userId = request.user?.role === 'customer' ? request.user.sub : null;
    const rows = await dbQuery(
      `
        SELECT id, name, barcode, barcode_format, allowed_uses, used_uses, status, user_id, created_at
        FROM tickets
        WHERE status = 'active' AND (user_id IS NULL OR $1::uuid IS NULL OR user_id = $1)
        ORDER BY created_at DESC
      `,
      [userId],
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      barcode: row.barcode,
      barcodeFormat: row.barcode_format,
      allowedUses: row.allowed_uses,
      usedUses: row.used_uses,
      remainingUses: Math.max(0, Number(row.allowed_uses) - Number(row.used_uses)),
      status: row.status,
      userId: row.user_id,
      createdAt: row.created_at,
    }));
  });

  fastify.get('/api/tickets/:id', { config: { rateLimit: { max: 100, timeWindow: '1 minute' } } }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const rows = await dbQuery(
      'SELECT id, name, barcode, barcode_format, allowed_uses, used_uses, status, created_at FROM tickets WHERE id = $1 LIMIT 1',
      [id],
    );
    if (rows.length === 0) return reply.code(404).send({ error: 'Ticket not found' });
    const row = rows[0]!;
    return {
      id: row.id,
      name: row.name,
      barcode: row.barcode,
      barcodeFormat: row.barcode_format,
      allowedUses: row.allowed_uses,
      usedUses: row.used_uses,
      remainingUses: Math.max(0, Number(row.allowed_uses) - Number(row.used_uses)),
      status: row.status,
      createdAt: row.created_at,
    };
  });

  // Enter a random drawing: assigns an unclaimed active ticket to the current member.
  fastify.post('/api/tickets/apply', { preHandler: fastify.requireRole(['customer']), config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const rows = await dbQuery(
      `
        UPDATE tickets
        SET user_id = $1, updated_at = now()
        WHERE id = (
          SELECT id FROM tickets
          WHERE status = 'active' AND user_id IS NULL
          ORDER BY random()
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, name, barcode, barcode_format, allowed_uses, used_uses, status, created_at
      `,
      [userId],
    );
    if (rows.length === 0) return reply.code(409).send({ error: 'No tickets available in the drawing' });
    const row = rows[0]!;
    return {
      id: row.id,
      name: row.name,
      barcode: row.barcode,
      barcodeFormat: row.barcode_format,
      allowedUses: row.allowed_uses,
      usedUses: row.used_uses,
      remainingUses: Math.max(0, Number(row.allowed_uses) - Number(row.used_uses)),
      status: row.status,
      userId,
      createdAt: row.created_at,
    };
  });

  // Use a ticket (event staff/self-serve endpoint).
  fastify.post('/api/tickets/:id/use', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    return dbQuery(
      `
        UPDATE tickets
        SET used_uses = used_uses + 1,
            status = CASE WHEN used_uses + 1 >= allowed_uses THEN 'used' ELSE status END,
            updated_at = now()
        WHERE id = $1 AND status = 'active' AND used_uses < allowed_uses
        RETURNING id, name, barcode, barcode_format, allowed_uses, used_uses, status
      `,
      [id],
    ).then((rows) => {
      if (rows.length === 0) return reply.code(409).send({ error: 'Ticket unavailable or fully used' });
      const row = rows[0]!;
      return {
        id: row.id,
        name: row.name,
        barcode: row.barcode,
        barcodeFormat: row.barcode_format,
        allowedUses: row.allowed_uses,
        usedUses: row.used_uses,
        remainingUses: Math.max(0, Number(row.allowed_uses) - Number(row.used_uses)),
        status: row.status,
      };
    });
  });

  // Admin CRUD.
  fastify.get('/api/admin/tickets', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => {
    const rows = await dbQuery(
      'SELECT id, name, barcode, barcode_format, allowed_uses, used_uses, status, drawing_date, user_id, created_at FROM tickets ORDER BY created_at DESC',
      [],
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      barcode: row.barcode,
      barcodeFormat: row.barcode_format,
      allowedUses: row.allowed_uses,
      usedUses: row.used_uses,
      remainingUses: Math.max(0, Number(row.allowed_uses) - Number(row.used_uses)),
      status: row.status,
      drawingDate: row.drawing_date,
      userId: row.user_id,
      createdAt: row.created_at,
    }));
  });

  fastify.post('/api/admin/tickets', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = ticketCreateSchema.parse(request.body);
    const drawingDate = body.drawingDate?.trim() || null;
    const rows = await dbQuery<{ id: string }>(
      'INSERT INTO tickets (barcode, barcode_format, name, allowed_uses, drawing_date, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [body.barcode, body.barcodeFormat ?? null, body.name, body.allowedUses, drawingDate, body.userId ?? null],
    );
    return reply.code(201).send({ id: rows[0]!.id });
  });

  fastify.patch('/api/admin/tickets/:id', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request) => {
    const id = (request.params as { id: string }).id;
    const body = ticketUpdateSchema.parse(request.body);
    const drawingDate = body.drawingDate === undefined ? null : (body.drawingDate?.trim() || null);
    const rows = await dbQuery(
      `
        UPDATE tickets
        SET name = COALESCE($2, name),
            barcode = COALESCE($3, barcode),
            barcode_format = COALESCE($4, barcode_format),
            allowed_uses = COALESCE($5, allowed_uses),
            used_uses = COALESCE($6, used_uses),
            status = COALESCE($7, status),
            drawing_date = CASE WHEN $8 = '' OR $8 IS NULL THEN NULL ELSE $8::date END,
            user_id = COALESCE($9, user_id),
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [id, body.name ?? null, body.barcode ?? null, body.barcodeFormat ?? null, body.allowedUses ?? null, body.usedUses ?? null, body.status ?? null, drawingDate, body.userId === undefined ? null : body.userId],
    );
    return rows[0] ?? {};
  });

  fastify.delete('/api/admin/tickets/:id', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request) => {
    const id = (request.params as { id: string }).id;
    return dbQuery('DELETE FROM tickets WHERE id = $1 RETURNING id', [id]);
  });
}
