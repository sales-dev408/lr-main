import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { dbQuery } from '../db/pool.js';
import { getVendorAnalytics } from '../services/analytics.js';
import { buildLookupDiscountView, humanDiscountLabel } from '../services/discounts.js';
import { syncDiscountToVendorConnections } from '../services/pos.js';

export async function registerVendorRoutes(fastify: FastifyInstance): Promise<void> {
  // Public, customer-facing vendor directory for the mobile app.
  fastify.get('/api/vendors', async (request) => {
    const category = typeof request.query === 'object' && request.query && 'category' in request.query ? String((request.query as { category?: string }).category ?? '') : '';
    const rows = await dbQuery<{
      id: string;
      name: string;
      address: string | null;
      location: string | null;
      category: string | null;
      latitude: number | null;
      longitude: number | null;
      pos_system: string | null;
      icon_url: string | null;
      logo_url: string | null;
      card_id: string;
      discount_type: 'fixed' | 'percent' | 'bogo';
      discount_value: string;
      discount_code: string | null;
      card_icon: string | null;
      card_logo: string | null;
    }>(
      `
        SELECT v.id, v.name, v.address, v.location, v.category, v.latitude, v.longitude, v.pos_system, v.icon_url, v.logo_url,
               c.id AS card_id, d.type AS discount_type, d.value AS discount_value, d.discount_code,
               c.icon_url AS card_icon, c.logo_url AS card_logo
        FROM vendors v
        JOIN cards c ON c.is_membership = true AND c.status = 'active'
        JOIN discounts d ON d.vendor_id = v.id AND d.card_id = c.id AND d.active = true
        WHERE v.status = 'approved' AND ($1::text = '' OR v.category = $1)
        ORDER BY v.name
      `,
      [category],
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address ?? row.location,
      category: row.category,
      latitude: row.latitude,
      longitude: row.longitude,
      posSystem: row.pos_system,
      iconUrl: row.icon_url ?? row.card_icon,
      logoUrl: row.logo_url ?? row.card_logo,
      discount: {
        type: row.discount_type,
        value: Number(row.discount_value),
        label: humanDiscountLabel(row.discount_type, Number(row.discount_value)),
      },
      discountCode: row.discount_code,
      cardId: row.card_id,
      walletUrl: null,
    }));
  });

  fastify.get('/api/vendor/cards', { preHandler: fastify.requireRole(['vendor']) }, async (request) => {
    const vendorId = request.user!.sub;
    const query = await dbQuery<{
      id: string;
      name: string;
      theme: string;
      description: string | null;
      image_url: string | null;
      expiration_date: string | null;
      max_uses: number | null;
      status: string;
      discount_id: string | null;
      discount_type: 'fixed' | 'percent' | 'bogo' | null;
      discount_value: string | null;
      min_purchase: string | null;
      max_uses_total: number | null;
      max_uses_per_customer: number | null;
      uses_count: number | null;
      city_overrides: Record<string, { type?: 'fixed' | 'percent' | 'bogo'; value?: number }> | null;
      active: boolean | null;
    }>(
      `
        SELECT c.id,
               c.name,
               c.theme,
               c.description,
               c.image_url,
               c.expiration_date,
               c.max_uses,
               c.status,
               d.id AS discount_id,
               d.type AS discount_type,
               d.value AS discount_value,
               d.min_purchase,
               d.max_uses_total,
               d.max_uses_per_customer,
               d.uses_count,
               d.city_overrides,
               d.active
        FROM card_vendors cv
        JOIN cards c ON c.id = cv.card_id
        LEFT JOIN discounts d ON d.card_id = cv.card_id AND d.vendor_id = cv.vendor_id
        WHERE cv.vendor_id = $1
        ORDER BY c.created_at DESC
      `,
      [vendorId],
    );

    return query.map((card) => {
      const discount =
        card.discount_id && card.discount_type && card.discount_value !== null && card.min_purchase !== null
          ? buildLookupDiscountView(
              {
                id: card.discount_id,
                cardId: card.id,
                vendorId,
                type: card.discount_type,
                value: card.discount_value,
                minPurchase: card.min_purchase,
                maxUsesTotal: card.max_uses_total,
                maxUsesPerCustomer: card.max_uses_per_customer,
                usesCount: card.uses_count ?? 0,
                cityOverrides: card.city_overrides,
                active: Boolean(card.active),
              },
              null,
            )
          : null;

      return {
        id: card.id,
        name: card.name,
        theme: card.theme,
        description: card.description,
        image_url: card.image_url,
        expiration_date: card.expiration_date,
        max_uses: card.max_uses,
        status: card.status,
        discount,
      };
    });
  });

  fastify.post('/api/vendor/register', async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      location: z.string().optional(),
      city: z.string().optional(),
      category: z.string().optional(),
      posType: z.enum(['square', 'stripe', 'clover', 'toast', 'other']),
      email: z.string().email(),
      password: z.string().min(8),
    });
    const body = schema.parse(request.body);
    const hash = await bcrypt.hash(body.password, 10);
    const rows = await dbQuery<{ id: string }>(
      `
        INSERT INTO vendors (name, location, city, category, pos_type, email, password_hash, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        RETURNING id
      `,
      [body.name, body.location ?? null, body.city ?? null, body.category ?? null, body.posType, body.email, hash],
    );
    return reply.code(201).send({ id: rows[0]!.id, status: 'pending' });
  });

  fastify.patch('/api/vendor/discounts/:id', { preHandler: fastify.requireRole(['vendor']) }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const body = z
      .object({
        type: z.enum(['fixed', 'percent', 'bogo']).optional(),
        value: z.number().optional(),
        minPurchase: z.number().optional(),
        maxUsesPerCustomer: z.number().int().positive().optional(),
        active: z.boolean().optional(),
        cityOverrides: z.record(z.object({ type: z.enum(['fixed', 'percent', 'bogo']).optional(), value: z.number().optional() })).optional(),
      })
      .parse(request.body);

    const ownership = await dbQuery<{ vendor_id: string }>('SELECT vendor_id FROM discounts WHERE id = $1 LIMIT 1', [id]);
    if (!ownership[0] || ownership[0].vendor_id !== request.user?.sub) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const rows = await dbQuery(
      `
        UPDATE discounts
        SET type = COALESCE($2, type),
            value = COALESCE($3, value),
            min_purchase = COALESCE($4, min_purchase),
            max_uses_per_customer = COALESCE($5, max_uses_per_customer),
            active = COALESCE($6, active),
            city_overrides = COALESCE($7::jsonb, city_overrides),
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        body.type ?? null,
        body.value ?? null,
        body.minPurchase ?? null,
        body.maxUsesPerCustomer ?? null,
        body.active ?? null,
        body.cityOverrides ? JSON.stringify(body.cityOverrides) : null,
      ],
    );
    void syncDiscountToVendorConnections({ discountId: id, action: 'upsert' }).catch((error) => {
      fastify.log.warn({ error, discountId: id }, 'POS auto-sync failed');
    });

    return rows[0] ?? {};
  });

  fastify.get('/api/vendor/analytics', { preHandler: fastify.requireRole(['vendor']) }, async (request) => {
    return getVendorAnalytics(request.user!.sub);
  });
}
