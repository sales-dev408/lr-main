import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dbQuery, withDbClient, type PoolClient } from '../db/pool.js';

const ticketCreateSchema = z.object({
  barcode: z.string().min(1),
  barcodeFormat: z.string().optional(),
  name: z.string().min(1).default('Event Ticket'),
  allowedUses: z.coerce.number().int().positive().default(1),
  drawingDeadline: z.coerce.date().optional(),
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
  drawingDeadline: z.coerce.date().optional().nullable(),
  drawingStatus: z.enum(['open', 'drawn', 'closed']).optional(),
  drawingDate: z.string().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
});

const ticketEntrySchema = z.object({
  ticketId: z.string().uuid(),
  requestedCount: z.coerce.number().int().min(1).max(4).default(1),
});

async function processTicketDrawings(client: PoolClient) {
  const due = await client.query<{ id: string }>(
    "SELECT id FROM tickets WHERE drawing_status = 'open' AND drawing_deadline <= now() FOR UPDATE SKIP LOCKED",
    [],
  );
  for (const row of due.rows) {
    const winner = await client.query<{ user_id: string }>(
      `
        WITH weights AS (
          SELECT user_id, SUM(requested_count)::int AS weight
          FROM ticket_entries
          WHERE ticket_id = $1
          GROUP BY user_id
        )
        SELECT user_id
        FROM weights
        ORDER BY random() * weight DESC
        LIMIT 1
      `,
      [row.id],
    );
    if (winner.rows[0]) {
      await client.query(
        "UPDATE tickets SET user_id = $1, drawing_status = 'drawn', updated_at = now() WHERE id = $2",
        [winner.rows[0].user_id, row.id],
      );
    } else {
      await client.query(
        "UPDATE tickets SET drawing_status = 'drawn', updated_at = now() WHERE id = $1",
        [row.id],
      );
    }
  }
}

function toTicketRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    barcode: row.barcode,
    barcodeFormat: row.barcode_format,
    allowedUses: row.allowed_uses,
    usedUses: row.used_uses,
    remainingUses: Math.max(0, Number(row.allowed_uses) - Number(row.used_uses)),
    status: row.status,
    drawingDeadline: row.drawing_deadline,
    drawingStatus: row.drawing_status,
    drawingDate: row.drawing_date,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

export async function registerTicketRoutes(fastify: FastifyInstance): Promise<void> {
  // Public customer-facing list (scoped to a user when authenticated).
  fastify.get('/api/tickets', { config: { rateLimit: { max: 100, timeWindow: '1 minute' } } }, async (request) => {
    const userId = request.user?.role === 'customer' ? request.user.sub : null;

    await withDbClient(async (client) => {
      await client.query('BEGIN');
      try {
        await processTicketDrawings(client);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });

    const rows = await dbQuery(
      `
        SELECT t.id, t.name, t.barcode, t.barcode_format, t.allowed_uses, t.used_uses, t.status,
               t.drawing_deadline, t.drawing_status, t.drawing_date, t.user_id, t.created_at,
               (SELECT COALESCE(SUM(requested_count), 0)::int FROM ticket_entries te WHERE te.ticket_id = t.id AND te.user_id = $1::uuid) AS entry_count
        FROM tickets t
        WHERE t.status = 'active'
          AND (
            (t.drawing_status = 'open' AND t.drawing_deadline > now())
            OR ($1::uuid IS NOT NULL AND t.user_id = $1::uuid)
          )
        ORDER BY t.created_at DESC
      `,
      [userId],
    );

    return rows.map((row) => ({
      ...toTicketRow(row),
      entryCount: Number(row.entry_count ?? 0),
    }));
  });

  fastify.get('/api/tickets/:id', { config: { rateLimit: { max: 100, timeWindow: '1 minute' } } }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const rows = await dbQuery(
      'SELECT id, name, barcode, barcode_format, allowed_uses, used_uses, status, drawing_deadline, drawing_status, drawing_date, user_id, created_at FROM tickets WHERE id = $1 LIMIT 1',
      [id],
    );
    if (rows.length === 0) return reply.code(404).send({ error: 'Ticket not found' });
    return toTicketRow(rows[0]!);
  });

  // Enter a random drawing: choose a ticket, request 1-4 entries.
  fastify.post('/api/tickets/enter', { preHandler: fastify.requireRole(['customer']), config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = ticketEntrySchema.parse(request.body);
    const userId = request.user!.sub;

    const tickets = await dbQuery<{ id: string; drawing_status: string; drawing_deadline: string | null }>(
      'SELECT id, drawing_status, drawing_deadline FROM tickets WHERE id = $1 AND status = $2 LIMIT 1',
      [body.ticketId, 'active'],
    );
    const ticket = tickets[0];
    if (!ticket) {
      return reply.code(404).send({ error: 'Ticket not found' });
    }
    if (ticket.drawing_status !== 'open') {
      return reply.code(409).send({ error: 'This drawing has already closed' });
    }
    if (ticket.drawing_deadline && new Date(ticket.drawing_deadline).getTime() <= Date.now()) {
      return reply.code(409).send({ error: 'This drawing has already closed' });
    }

    await dbQuery(
      `
        INSERT INTO ticket_entries (ticket_id, user_id, requested_count)
        VALUES ($1, $2, $3)
        ON CONFLICT (ticket_id, user_id)
        DO UPDATE SET requested_count = LEAST(4, ticket_entries.requested_count + EXCLUDED.requested_count), updated_at = now()
      `,
      [body.ticketId, userId, body.requestedCount],
    );

    return { success: true, ticketId: body.ticketId, requestedCount: body.requestedCount };
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
        RETURNING id, name, barcode, barcode_format, allowed_uses, used_uses, status, drawing_deadline, drawing_status, drawing_date, user_id, created_at
      `,
      [id],
    ).then((rows) => {
      if (rows.length === 0) return reply.code(409).send({ error: 'Ticket unavailable or fully used' });
      return toTicketRow(rows[0]!);
    });
  });

  // Admin CRUD.
  fastify.get('/api/admin/tickets', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => {
    const rows = await dbQuery(
      'SELECT id, name, barcode, barcode_format, allowed_uses, used_uses, status, drawing_deadline, drawing_status, drawing_date, user_id, created_at FROM tickets ORDER BY created_at DESC',
      [],
    );
    return rows.map(toTicketRow);
  });

  fastify.post('/api/admin/tickets', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = ticketCreateSchema.parse(request.body);
    const drawingDate = body.drawingDate?.trim() || null;
    const rows = await dbQuery<{ id: string }>(
      `INSERT INTO tickets (barcode, barcode_format, name, allowed_uses, drawing_deadline, drawing_date, user_id)
       VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, ($6::date + interval '23 hours 59 minutes')::timestamptz, now() + interval '7 days'), $6, $7)
       RETURNING id`,
      [
        body.barcode,
        body.barcodeFormat ?? null,
        body.name,
        body.allowedUses,
        body.drawingDeadline ?? null,
        drawingDate,
        body.userId ?? null,
      ],
    );
    return reply.code(201).send({ id: rows[0]!.id });
  });

  fastify.patch('/api/admin/tickets/:id', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request) => {
    const id = (request.params as { id: string }).id;
    const body = ticketUpdateSchema.parse(request.body);
    const drawingDate = body.drawingDate === undefined ? undefined : (body.drawingDate?.trim() || null);

    const rows = await dbQuery(
      `
        UPDATE tickets
        SET name = COALESCE($2, name),
            barcode = COALESCE($3, barcode),
            barcode_format = COALESCE($4, barcode_format),
            allowed_uses = COALESCE($5, allowed_uses),
            used_uses = COALESCE($6, used_uses),
            status = COALESCE($7, status),
            drawing_deadline = COALESCE($8::timestamptz, (CASE WHEN $10 = '' OR $10 IS NULL THEN NULL ELSE $10::date END + interval '23 hours 59 minutes')::timestamptz, drawing_deadline),
            drawing_status = COALESCE($9, drawing_status),
            drawing_date = CASE WHEN $10 = '' OR $10 IS NULL THEN NULL ELSE $10::date END,
            user_id = COALESCE($11, user_id),
            updated_at = now()
        WHERE id = $1
        RETURNING id, name, barcode, barcode_format, allowed_uses, used_uses, status, drawing_deadline, drawing_status, drawing_date, user_id, created_at
      `,
      [
        id,
        body.name ?? null,
        body.barcode ?? null,
        body.barcodeFormat ?? null,
        body.allowedUses ?? null,
        body.usedUses ?? null,
        body.status ?? null,
        body.drawingDeadline === undefined ? null : body.drawingDeadline,
        body.drawingStatus ?? null,
        drawingDate ?? null,
        body.userId === undefined ? null : body.userId,
      ],
    );
    return toTicketRow(rows[0] ?? {});
  });

  fastify.delete('/api/admin/tickets/:id', { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request) => {
    const id = (request.params as { id: string }).id;
    return dbQuery('DELETE FROM tickets WHERE id = $1 RETURNING id', [id]);
  });
}
