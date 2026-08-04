import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dbQuery } from '../db/pool.js';
import { humanDiscountLabel } from '../services/discounts.js';
import { resolveCardLookup, resolvePassLookup } from '../services/lookup.js';
import { redeemDiscount } from '../services/redeem.js';
import type { AppliedDiscount } from '../types.js';

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
    const userId = request.user!.sub;

    const result = await redeemDiscount({
      discountCode: code,
      userId,
      actorType: 'customer',
      actorId: userId,
      ip: request.ip,
    });

    if (!result.valid) {
      return reply.code(409).send({ error: result.reason ?? 'Unable to redeem this discount' });
    }

    const rows = await dbQuery<{ vendor_name: string; card_name: string }>(
      `
        SELECT v.name AS vendor_name, c.name AS card_name
        FROM discounts d
        JOIN vendors v ON v.id = d.vendor_id
        JOIN cards c ON c.id = d.card_id
        WHERE d.discount_code = $1 AND d.active = true AND c.is_membership = true
        LIMIT 1
      `,
      [code],
    );
    const row = rows[0];
    const discount = result.discount ?? ({} as AppliedDiscount);
    return {
      vendorName: row?.vendor_name ?? 'Vendor',
      cardName: row?.card_name ?? 'Membership',
      discountCode: code,
      type: discount.type,
      value: discount.value ?? 0,
      discountLabel: discount.description ?? humanDiscountLabel(discount.type ?? 'fixed', discount.value ?? 0),
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
      vendorId: z.string().uuid().optional(),
      discountCode: z.string().optional(),
      discountId: z.string().uuid().optional(),
      city: z.string().optional(),
      purchaseAmount: z.number().optional(),
      giftCardId: z.string().uuid().optional(),
    }).parse(request.body);

    const result = await redeemDiscount({
      ...(body.vendorId ? { vendorId: body.vendorId } : {}),
      ...(body.discountCode ? { discountCode: body.discountCode } : {}),
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
