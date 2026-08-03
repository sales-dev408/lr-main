import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dbQuery } from '../db/pool.js';
import { humanDiscountLabel } from '../services/discounts.js';
import { resolveCardLookup, resolvePassLookup } from '../services/lookup.js';
import { redeemDiscount } from '../services/redeem.js';

export async function registerLookupRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/lookup/:lookupToken', async (request, reply) => {
    const lookupToken = (request.params as { lookupToken: string }).lookupToken;
    const city = typeof request.query === 'object' && request.query && 'city' in request.query ? String((request.query as { city?: string }).city ?? '') : '';
    const vendorId = typeof request.query === 'object' && request.query && 'vendorId' in request.query ? String((request.query as { vendorId?: string }).vendorId ?? '') : '';
    const result = await resolvePassLookup(lookupToken, vendorId || undefined, city || undefined);
    if (!result) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return result;
  });

  fastify.get('/api/discounts/lookup', async (request, reply) => {
    const query = request.query as { token?: string; city?: string };
    if (!query.token) {
      return reply.code(400).send({ error: 'token is required' });
    }
    const result = await resolvePassLookup(query.token, undefined, query.city ?? undefined);
    if (!result) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return result;
  });

  fastify.get('/api/discounts/by-code/:code', { preHandler: fastify.requireRole(['customer']) }, async (request, reply) => {
    const code = (request.params as { code: string }).code;
    const rows = await dbQuery<{ vendor_name: string; card_name: string; type: 'fixed' | 'percent' | 'bogo'; value: string }>(
      `
        SELECT v.name AS vendor_name, c.name AS card_name, d.type, d.value
        FROM discounts d
        JOIN vendors v ON v.id = d.vendor_id
        JOIN cards c ON c.id = d.card_id
        WHERE d.discount_code = $1 AND d.active = true AND c.is_membership = true
        LIMIT 1
      `,
      [code],
    );
    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Discount not found' });
    }
    const row = rows[0]!;
    return {
      vendorName: row.vendor_name,
      cardName: row.card_name,
      discountCode: code,
      type: row.type,
      value: Number(row.value),
      discountLabel: humanDiscountLabel(row.type, Number(row.value)),
    };
  });

  fastify.get('/api/lookup/card/:cardId', async (request, reply) => {
    const cardId = (request.params as { cardId: string }).cardId;
    const query = request.query as { vendorId?: string; city?: string };
    const result = await resolveCardLookup(cardId, query.vendorId, query.city);
    if (!result) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return result;
  });

  fastify.post('/api/redeem', async (request, reply) => {
    const body = z.object({
      lookupToken: z.string().optional(),
      cardId: z.string().uuid().optional(),
      userId: z.string().uuid().optional(),
      vendorId: z.string().uuid(),
      discountId: z.string().uuid().optional(),
      city: z.string().optional(),
      purchaseAmount: z.number().optional(),
      giftCardId: z.string().uuid().optional(),
    }).parse(request.body);

    const result = await redeemDiscount({
      vendorId: body.vendorId,
      ...(body.lookupToken ? { lookupToken: body.lookupToken } : {}),
      ...(body.cardId ? { cardId: body.cardId } : {}),
      ...(body.userId ? { userId: body.userId } : {}),
      ...(body.discountId ? { discountId: body.discountId } : {}),
      ...(body.city ? { city: body.city } : {}),
      ...(body.purchaseAmount !== undefined ? { purchaseAmount: body.purchaseAmount } : {}),
      ...(body.giftCardId ? { giftCardId: body.giftCardId } : {}),
      actorType: request.user?.role ?? 'system',
      actorId: request.user?.sub ?? null,
      ip: request.ip,
    });

    return reply.send(result);
  });
}
