import type { FastifyInstance } from 'fastify';
import { dbQuery } from '../db/pool.js';
import { savePushToken } from '../services/push.js';

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
