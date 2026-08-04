import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dbQuery } from '../db/pool.js';
import { savePushToken } from '../services/push.js';
import type { PushPreferences, UserProfile } from '../types.js';

type ProfileRow = {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  status: string;
  push_enabled_new_vendor: boolean;
  push_enabled_expiring_deal: boolean;
  push_enabled_local_event: boolean;
};

const profileColumns = `
  id,
  email::text AS email,
  phone,
  full_name,
  first_name,
  last_name,
  city,
  status,
  push_enabled_new_vendor,
  push_enabled_expiring_deal,
  push_enabled_local_event
`;

function buildPushPreferences(row: Pick<ProfileRow, 'push_enabled_new_vendor' | 'push_enabled_expiring_deal' | 'push_enabled_local_event'>): PushPreferences {
  return {
    newVendor: row.push_enabled_new_vendor,
    expiringDeal: row.push_enabled_expiring_deal,
    localEvent: row.push_enabled_local_event,
  };
}

function mapProfileRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    fullName: row.full_name,
    firstName: row.first_name,
    lastName: row.last_name,
    city: row.city,
    status: row.status as UserProfile['status'],
    pushPreferences: buildPushPreferences(row),
  };
}

export async function registerUserRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/me/analytics', { preHandler: fastify.requireRole(['customer']) }, async (request) => {
    const userId = request.user!.sub;

    const totalRows = await dbQuery<{ redemptions: string }>(
      'SELECT COUNT(*)::text AS redemptions FROM redemptions WHERE user_id = $1',
      [userId],
    );

    const vendorRows = await dbQuery<{ vendor_id: string; vendor_name: string; redemptions: string }>(
      `
        SELECT v.id AS vendor_id, v.name AS vendor_name, COUNT(r.id)::text AS redemptions
        FROM redemptions r
        JOIN vendors v ON v.id = r.vendor_id
        WHERE r.user_id = $1
        GROUP BY v.id, v.name
        ORDER BY COUNT(r.id) DESC
      `,
      [userId],
    );

    const recentRows = await dbQuery<{ day: string; redemptions: string }>(
      `
        SELECT to_char(date_trunc('day', redeemed_at), 'YYYY-MM-DD') AS day, COUNT(*)::text AS redemptions
        FROM redemptions
        WHERE user_id = $1 AND redeemed_at >= now() - interval '30 days'
        GROUP BY 1
        ORDER BY 1 DESC
      `,
      [userId],
    );

    return {
      totalRedemptions: Number(totalRows[0]?.redemptions ?? '0'),
      byVendor: vendorRows.map((row) => ({
        vendorId: row.vendor_id,
        vendorName: row.vendor_name,
        redemptions: Number(row.redemptions),
      })),
      daily: recentRows.map((row) => ({ day: row.day, redemptions: Number(row.redemptions) })),
    };
  });

  fastify.get('/api/me', { preHandler: fastify.requireRole(['customer']) }, async (request) => {
    const userId = request.user!.sub;
    const rows = await dbQuery<ProfileRow>(
      `SELECT ${profileColumns} FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const user = rows[0];
    if (!user) return { error: 'User not found' };
    return mapProfileRow(user);
  });

  const pushPreferencesSchema = z.object({
    newVendor: z.boolean().optional(),
    expiringDeal: z.boolean().optional(),
    localEvent: z.boolean().optional(),
  });

  fastify.patch(
    '/api/me',
    { preHandler: fastify.requireRole(['customer']), config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = z
        .object({
          city: z.string().trim().min(1).optional(),
          pushPreferences: pushPreferencesSchema.optional(),
        })
        .parse(request.body);
      const userId = request.user!.sub;
      const rows = await dbQuery<ProfileRow>(
        `UPDATE users
         SET city = COALESCE($2, city),
             push_enabled_new_vendor = COALESCE($3, push_enabled_new_vendor),
             push_enabled_expiring_deal = COALESCE($4, push_enabled_expiring_deal),
             push_enabled_local_event = COALESCE($5, push_enabled_local_event),
             updated_at = now()
         WHERE id = $1
         RETURNING ${profileColumns}`,
        [userId, body.city ?? null, body.pushPreferences?.newVendor ?? null, body.pushPreferences?.expiringDeal ?? null, body.pushPreferences?.localEvent ?? null],
      );
      const user = rows[0];
      if (!user) return reply.code(404).send({ error: 'User not found' });
      return mapProfileRow(user);
    },
  );

  fastify.delete(
    '/api/me',
    { preHandler: fastify.requireRole(['customer']), config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const userId = request.user!.sub;
      await dbQuery('DELETE FROM users WHERE id = $1', [userId]);
      return reply.code(204).send();
    },
  );

  fastify.post(
    '/api/me/push-token',
    { preHandler: fastify.requireRole(['customer']), config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = request.body as { token?: string; city?: string | null };
      if (!body.token) {
        return reply.code(400).send({ error: 'Push token is required' });
      }
      await savePushToken(request.user!.sub, body.token, body.city);
      return { registered: true };
    },
  );
}
