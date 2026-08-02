import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dbQuery } from '../db/pool.js';

const ticketCreateSchema = z.object({
  barcode: z.string().min(1),
  name: z.string().min(1).default('Event Ticket'),
  allowedUses: z.coerce.number().int().positive().default(1),
  userId: z.string().uuid().optional(),
});

const ticketUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  allowedUses: z.coerce.number().int().positive().optional(),
  usedUses: z.coerce.number().int().min(0).optional(),
  status: z.enum(['active', 'used', 'disabled']).optional(),
  userId: z.string().uuid().optional().nullable(),
});

export async function registerTicketRoutes(fastify: FastifyInstance): Promise<void> {
  // Public customer-facing list (scoped to a user when authenticated).
  fastify.get('/api/tickets', async (request) => {
    const userId = request.user?.role === 'customer' ? request.user.sub : null;
    const rows = await dbQuery(
      `
        SELECT id, name, barcode, allowed_uses, used_uses, status, created_at
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
      allowedUses: row.allowed_uses,
      usedUses: row.used_uses,
      remainingUses: Math.max(0, Number(row.allowed_uses) - Number(row.used_uses)),
      status: row.status,
      createdAt: row.created_at,
    }));
  });

  fastify.get('/api/tickets/:id', async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const rows = await dbQuery(
      'SELECT id, name, barcode, allowed_uses, used_uses, status, created_at FROM tickets WHERE id = $1 LIMIT 1',
      [id],
    );
    if (rows.length === 0) return reply.code(404).send({ error: 'Ticket not found' });
    const row = rows[0]!;
    return {
      id: row.id,
      name: row.name,
      barcode: row.barcode,
      allowedUses: row.allowed_uses,
      usedUses: row.used_uses,
      remainingUses: Math.max(0, Number(row.allowed_uses) - Number(row.used_uses)),
      status: row.status,
      createdAt: row.created_at,
    };
  });

  // Use a ticket (event staff/self-serve endpoint).
  fastify.post('/api/tickets/:id/use', async (request, reply) => {
    const id = (request.params as { id: string }).id;
    return dbQuery(
      `
        UPDATE tickets
        SET used_uses = used_uses + 1,
            status = CASE WHEN used_uses + 1 >= allowed_uses THEN 'used' ELSE status END,
            updated_at = now()
        WHERE id = $1 AND status = 'active' AND used_uses < allowed_uses
        RETURNING id, name, barcode, allowed_uses, used_uses, status
      `,
      [id],
    ).then((rows) => {
      if (rows.length === 0) return reply.code(409).send({ error: 'Ticket unavailable or fully used' });
      const row = rows[0]!;
      return {
        id: row.id,
        name: row.name,
        barcode: row.barcode,
        allowedUses: row.allowed_uses,
        usedUses: row.used_uses,
        remainingUses: Math.max(0, Number(row.allowed_uses) - Number(row.used_uses)),
        status: row.status,
      };
    });
  });

  // Admin CRUD.
  fastify.get('/api/admin/tickets', { preHandler: fastify.requireRole(['admin']) }, async () => {
    const rows = await dbQuery(
      'SELECT id, name, barcode, allowed_uses, used_uses, status, user_id, created_at FROM tickets ORDER BY created_at DESC',
      [],
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      barcode: row.barcode,
      allowedUses: row.allowed_uses,
      usedUses: row.used_uses,
      remainingUses: Math.max(0, Number(row.allowed_uses) - Number(row.used_uses)),
      status: row.status,
      userId: row.user_id,
      createdAt: row.created_at,
    }));
  });

  fastify.post('/api/admin/tickets', { preHandler: fastify.requireRole(['admin']) }, async (request, reply) => {
    const body = ticketCreateSchema.parse(request.body);
    const rows = await dbQuery<{ id: string }>(
      'INSERT INTO tickets (barcode, name, allowed_uses, user_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [body.barcode, body.name, body.allowedUses, body.userId ?? null],
    );
    return reply.code(201).send({ id: rows[0]!.id });
  });

  fastify.patch('/api/admin/tickets/:id', { preHandler: fastify.requireRole(['admin']) }, async (request) => {
    const id = (request.params as { id: string }).id;
    const body = ticketUpdateSchema.parse(request.body);
    const rows = await dbQuery(
      `
        UPDATE tickets
        SET name = COALESCE($2, name),
            allowed_uses = COALESCE($3, allowed_uses),
            used_uses = COALESCE($4, used_uses),
            status = COALESCE($5, status),
            user_id = COALESCE($6, user_id),
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [id, body.name ?? null, body.allowedUses ?? null, body.usedUses ?? null, body.status ?? null, body.userId === undefined ? null : body.userId],
    );
    return rows[0] ?? {};
  });

  fastify.delete('/api/admin/tickets/:id', { preHandler: fastify.requireRole(['admin']) }, async (request) => {
    const id = (request.params as { id: string }).id;
    return dbQuery('DELETE FROM tickets WHERE id = $1 RETURNING id', [id]);
  });
}
