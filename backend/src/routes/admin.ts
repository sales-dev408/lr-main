import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { dbQuery, withDbClient, type PoolClient } from '../db/pool.js';
import { getAdminAnalytics, getVendorAnalytics } from '../services/analytics.js';
import { buildLookupDiscountView, generateDiscountCode, humanDiscountLabel } from '../services/discounts.js';
import { generateTempPassword } from '../utils/ids.js';
import { writeTransactionAudit } from '../services/audit.js';
import { sendVendorWelcomeEmail, sendDealOfTheDayBlast } from '../services/mailjet.js';
import { getPushTokensForNewVendor, sendPushNotifications } from '../services/push.js';
import { qrCodeUrl } from '../services/quickchart.js';
import { deleteDiscountFromVendorConnections, syncDiscountToVendorConnections } from '../services/pos.js';

const cardSchema = z.object({
  name: z.string().min(1),
  theme: z.enum(['sports', 'entertainment', 'shops_restaurants']),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  iconUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  qrSize: z.number().int().min(80).max(600).optional(),
  layout: z.enum(['qr_top', 'qr_bottom', 'qr_left', 'qr_right']).optional(),
  expirationDate: z.string().datetime().optional(),
  maxUses: z.number().int().positive().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

const vendorSchema = z.object({
  name: z.string().min(1),
  ownerName: z.string().optional(),
  location: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  category: z.string().optional(),
  posType: z.enum(['square', 'stripe', 'clover', 'toast', 'other']).optional(),
  posSystem: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string().min(8).optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'suspended']).optional(),
  discountType: z.enum(['fixed', 'percent', 'bogo']).optional(),
  discountValue: z.number().optional(),
  discountStartsAt: z.string().datetime().optional().nullable(),
  discountEndsAt: z.string().datetime().optional().nullable(),
  boosted: z.boolean().optional(),
  discountTerms: z.string().optional(),
  discountDescription: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  iconDataUrl: z.string().optional(),
  logoDataUrl: z.string().optional(),
});

const discountSchema = z.object({
  cardId: z.string().uuid(),
  vendorId: z.string().uuid(),
  type: z.enum(['fixed', 'percent', 'bogo']),
  value: z.number(),
  minPurchase: z.number().default(0),
  maxUsesTotal: z.number().int().positive().optional(),
  maxUsesPerCustomer: z.number().int().positive().optional(),
  cityOverrides: z.record(z.object({ type: z.enum(['fixed', 'percent', 'bogo']).optional(), value: z.number().optional() })).default({}),
  active: z.boolean().default(true),
});

export async function registerAdminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/admin/cards', { preHandler: fastify.requireRole(['admin']) }, async (request) => {
    const query = request.query as { theme?: string; status?: string };
    return loadCardsWithBusinesses({
      ...(query.theme ? { theme: query.theme } : {}),
      ...(query.status ? { status: query.status } : {}),
    });
  });

  fastify.get('/api/admin/cards/:id', { preHandler: fastify.requireRole(['admin']) }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const cards = await loadCardsWithBusinesses({ id });
    if (cards.length === 0) {
      return reply.code(404).send({ error: 'Card not found' });
    }
    return cards[0];
  });

  fastify.get('/api/admin/analytics', { preHandler: fastify.requireRole(['admin']) }, async (request) => {
    const query = request.query as { from?: string; to?: string; city?: string };
    return getAdminAnalytics({
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      ...(query.city ? { city: query.city } : {}),
    });
  });

  fastify.get('/api/admin/vendors', { preHandler: fastify.requireRole(['admin']) }, async (request) => {
    const query = request.query as { status?: string; city?: string; category?: string };
    const rows = await dbQuery(
      `
        SELECT v.*, d.type AS discount_type, d.value AS discount_value, d.discount_code, d.description AS discount_description,
               d.starts_at AS discount_starts_at, d.ends_at AS discount_ends_at, d.boosted AS discount_boosted
        FROM vendors v
        LEFT JOIN LATERAL (
          SELECT d.type, d.value, d.discount_code, d.description, d.starts_at, d.ends_at, d.boosted
          FROM discounts d
          JOIN cards c ON c.id = d.card_id AND c.is_membership = true
          WHERE d.vendor_id = v.id
          ORDER BY d.created_at DESC
          LIMIT 1
        ) d ON true
        WHERE ($1::text IS NULL OR v.status = $1)
          AND ($2::text IS NULL OR v.city = $2)
          AND ($3::text IS NULL OR v.category = $3)
        ORDER BY v.created_at DESC
      `,
      [query.status ?? null, query.city ?? null, query.category ?? null],
    );
    return rows;
  });

  fastify.get('/api/admin/vendors/:id', { preHandler: fastify.requireRole(['admin']) }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const rows = await dbQuery(
      `
        SELECT v.*, d.type AS discount_type, d.value AS discount_value, d.discount_code, d.description AS discount_description,
               d.starts_at AS discount_starts_at, d.ends_at AS discount_ends_at, d.boosted AS discount_boosted
        FROM vendors v
        LEFT JOIN LATERAL (
          SELECT d.type, d.value, d.discount_code, d.description, d.starts_at, d.ends_at, d.boosted
          FROM discounts d
          JOIN cards c ON c.id = d.card_id AND c.is_membership = true
          WHERE d.vendor_id = v.id
          ORDER BY d.created_at DESC
          LIMIT 1
        ) d ON true
        WHERE v.id = $1
        LIMIT 1
      `,
      [id],
    );
    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Vendor not found' });
    }
    return rows[0];
  });

  fastify.post('/api/admin/vendors', { preHandler: fastify.requireRole(['admin']) }, async (request, reply) => {
    const body = vendorSchema.parse(request.body);
    if (body.discountType === 'bogo' && (!body.discountDescription || !body.discountDescription.trim())) {
      return reply.code(400).send({ error: 'BOGO discounts require a description' });
    }
    const result = await withDbClient(async (client: PoolClient) => {
      const address = body.address ?? body.location;
      const vendorRows = await client.query<{ id: string }>(
        `
          INSERT INTO vendors (name, owner_name, location, address, city, category, pos_type, pos_system, email, phone, password_hash, status, latitude, longitude, icon_url, logo_url, discount_terms)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          RETURNING id
        `,
        [
          body.name,
          body.ownerName ?? null,
          address ?? null,
          address ?? null,
          body.city ?? null,
          body.category ?? null,
          null,
          null,
          body.email ?? null,
          body.phone ?? null,
          null,
          body.status ?? 'approved',
          body.latitude ?? null,
          body.longitude ?? null,
          body.iconDataUrl ?? null,
          body.logoDataUrl ?? null,
          body.discountTerms ?? null,
        ],
      );
      const vendorId = vendorRows.rows[0]!.id;

      const membership = await client.query<{ id: string; name: string }>(
        `SELECT id, name FROM cards WHERE is_membership = true LIMIT 1`,
      );
      if (!membership.rows[0]) {
        throw new Error('Membership card not found. Run migrations.');
      }
      const { id: cardId, name: cardName } = membership.rows[0];

      await client.query('INSERT INTO card_vendors (card_id, vendor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [cardId, vendorId]);

      const discountType = body.discountType ?? 'percent';
      const discountValue = body.discountValue ?? 10;
      const label = humanDiscountLabel(discountType, discountValue);
      const discountCode = generateDiscountCode({ merchantId: body.name, type: discountType, value: discountValue });

      const discountDescription = body.discountType === 'bogo' && body.discountDescription
        ? body.discountDescription.trim()
        : (body.discountDescription?.trim() || `${label} member discount`);

      const discountRows = await client.query<{ id: string }>(
        `
          INSERT INTO discounts (card_id, vendor_id, type, value, discount_code, description, active, starts_at, ends_at, boosted)
          VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9)
          ON CONFLICT (card_id, vendor_id) DO UPDATE SET type = EXCLUDED.type, value = EXCLUDED.value, discount_code = COALESCE(discounts.discount_code, EXCLUDED.discount_code), description = EXCLUDED.description, active = true, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, boosted = EXCLUDED.boosted, updated_at = now()
          RETURNING id
        `,
        [cardId, vendorId, discountType, discountValue, discountCode, discountDescription, body.discountStartsAt ?? null, body.discountEndsAt ?? null, body.boosted ?? false],
      );

      return {
        vendor: { id: vendorId, name: body.name, ownerName: body.ownerName ?? null, address: address ?? null, category: body.category ?? null },
        discountCode,
        discount: { id: discountRows.rows[0]!.id, type: discountType, value: discountValue, label },
        membershipCard: { id: cardId, name: cardName },
        posInstructions: `Ask the customer to show their ${cardName} pass, scan its barcode, then apply code ${discountCode} in your POS. No NFC required.`,
      };
    });

    if (body.email) {
      try {
        await sendVendorWelcomeEmail({
          to: body.email,
          vendorName: body.name,
          qrCodeUrl: qrCodeUrl(result.discountCode, 300),
          discountLabel: result.discount.label,
          setupUrl: 'https://lightraildeals.com',
        });
      } catch (err) {
        fastify.log.warn({ err, vendorId: result.vendor.id }, 'Failed to send vendor welcome email');
      }
    }

    await writeTransactionAudit({
      actorType: 'admin',
      actorId: request.user?.sub ?? null,
      action: 'admin.vendor.create',
      entityType: 'vendor',
      entityId: result.vendor.id,
      metadata: { name: result.vendor.name, discountCode: result.discountCode, emailed: Boolean(body.email) },
      ip: request.ip,
    });

    void getPushTokensForNewVendor().then((tokens) =>
      sendPushNotifications(
        tokens,
        'New vendor joined',
        `${result.vendor.name} is now offering Light Rail Deals discounts.`,
        { type: 'new_vendor', vendorId: result.vendor.id },
      ),
    );

    return reply.code(201).send(result);
  });

  fastify.patch('/api/admin/vendors/:id', { preHandler: fastify.requireRole(['admin']) }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const body = vendorSchema.partial().parse(request.body);
    if (body.discountType === 'bogo' && (!body.discountDescription || !body.discountDescription.trim())) {
      return reply.code(400).send({ error: 'BOGO discounts require a description' });
    }
    const address = body.address ?? body.location;
    const rows = await dbQuery(
      `
        UPDATE vendors
        SET name = COALESCE($2, name),
            owner_name = COALESCE($3, owner_name),
            location = COALESCE($4, location),
            address = COALESCE($4, address),
            city = COALESCE($5, city),
            category = COALESCE($6, category),
            email = COALESCE($7, email),
            phone = COALESCE($8, phone),
            status = COALESCE($9, status),
            latitude = COALESCE($10, latitude),
            longitude = COALESCE($11, longitude),
            icon_url = COALESCE($12, icon_url),
            logo_url = COALESCE($13, logo_url),
            discount_terms = COALESCE($14, discount_terms),
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [id, body.name ?? null, body.ownerName ?? null, address ?? null, body.city ?? null, body.category ?? null, body.email ?? null, body.phone ?? null, body.status ?? null, body.latitude ?? null, body.longitude ?? null, body.iconDataUrl ?? null, body.logoDataUrl ?? null, body.discountTerms ?? null],
    );

    if (body.discountType !== undefined || body.discountValue !== undefined || body.discountStartsAt !== undefined || body.discountEndsAt !== undefined || body.boosted !== undefined || body.discountDescription !== undefined) {
      const discountDescription = body.discountDescription?.trim();
      await dbQuery(
        `
          UPDATE discounts
          SET type = COALESCE($2, type),
              value = COALESCE($3, value),
              description = COALESCE($4, description),
              starts_at = COALESCE($5, starts_at),
              ends_at = COALESCE($6, ends_at),
              boosted = COALESCE($7, boosted),
              updated_at = now()
          WHERE vendor_id = $1 AND card_id = (SELECT id FROM cards WHERE is_membership = true LIMIT 1)
        `,
        [id, body.discountType ?? null, body.discountValue ?? null, discountDescription ?? null, body.discountStartsAt ?? null, body.discountEndsAt ?? null, body.boosted ?? null],
      );
    }

    return rows[0] ?? {};
  });

  fastify.post('/api/admin/vendors/:id/approve', { preHandler: fastify.requireRole(['admin']) }, async (request) => {
    const id = (request.params as { id: string }).id;
    return dbQuery('UPDATE vendors SET status = \'approved\', updated_at = now() WHERE id = $1 RETURNING *', [id]);
  });

  fastify.post('/api/admin/vendors/:id/reject', { preHandler: fastify.requireRole(['admin']) }, async (request) => {
    const id = (request.params as { id: string }).id;
    return dbQuery('UPDATE vendors SET status = \'rejected\', updated_at = now() WHERE id = $1 RETURNING *', [id]);
  });

  fastify.get('/api/admin/vendors/:id/pass', { preHandler: fastify.requireRole(['admin']) }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const rows = await dbQuery<{ card_id: string; card_name: string; discount_type: 'fixed' | 'percent' | 'bogo'; discount_value: string; discount_code: string | null; pos_system: string | null }>(
      `SELECT c.id AS card_id, c.name AS card_name, d.type AS discount_type, d.value AS discount_value, d.discount_code, v.pos_system
       FROM discounts d
       JOIN cards c ON c.id = d.card_id AND c.is_membership = true
       JOIN vendors v ON v.id = d.vendor_id
       WHERE d.vendor_id = $1 ORDER BY d.created_at DESC LIMIT 1`,
      [id],
    );
    const row = rows[0];
    if (!row) return reply.code(404).send({ error: 'No discount for this vendor' });
    const label = humanDiscountLabel(row.discount_type, Number(row.discount_value));
    return {
      discountCode: row.discount_code,
      discount: { type: row.discount_type, value: Number(row.discount_value), label },
      membershipCard: { id: row.card_id, name: row.card_name },
      posInstructions: `Ask the customer to show their ${row.card_name} pass, scan its barcode, then apply code ${row.discount_code ?? '(none)'} in your POS${row.pos_system ? ` (${row.pos_system})` : ''}. No NFC required.`,
    };
  });

  fastify.post('/api/admin/vendors/:id/reset-password', { preHandler: fastify.requireRole(['admin']) }, async (request) => {
    const id = (request.params as { id: string }).id;
    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);
    await dbQuery('UPDATE vendors SET password_hash = $2, updated_at = now() WHERE id = $1', [id, hash]);
    return { tempPassword };
  });

  fastify.post('/api/admin/vendors/:id/qr', { preHandler: fastify.requireRole(['admin']) }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const result = await withDbClient(async (client) => {
      const vendorRows = await client.query<{ id: string; name: string }>('SELECT id, name FROM vendors WHERE id = $1', [id]);
      if (vendorRows.rows.length === 0) return null;
      const vendor = vendorRows.rows[0]!;

      const membershipRows = await client.query<{ id: string; name: string }>('SELECT id, name FROM cards WHERE is_membership = true LIMIT 1');
      if (membershipRows.rows.length === 0) return null;
      const cardId = membershipRows.rows[0]!.id;

      const existing = await client.query<{ id: string; type: 'fixed' | 'percent' | 'bogo'; value: string }>(
        'SELECT id, type, value FROM discounts WHERE vendor_id = $1 AND card_id = $2 LIMIT 1',
        [id, cardId],
      );

      let discountId: string;
      let type: 'fixed' | 'percent' | 'bogo';
      let value: number;
      if (existing.rows.length > 0) {
        const row = existing.rows[0]!;
        discountId = row.id;
        type = row.type;
        value = Number(row.value);
      } else {
        type = 'percent';
        value = 10;
        const label = humanDiscountLabel(type, value);
        const discountCode = generateDiscountCode({ merchantId: vendor.name, type, value });
        const inserted = await client.query<{ id: string }>(
          'INSERT INTO discounts (card_id, vendor_id, type, value, discount_code, description, active) VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id',
          [cardId, id, type, value, discountCode, `${label} member discount`],
        );
        discountId = inserted.rows[0]!.id;
        await client.query('INSERT INTO card_vendors (card_id, vendor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [cardId, id]);
      }

      const newCode = generateDiscountCode({ merchantId: vendor.name, type, value });
      await client.query('UPDATE discounts SET discount_code = $2, updated_at = now() WHERE id = $1', [discountId, newCode]);
      return { discountCode: newCode, qrUrl: qrCodeUrl(newCode, 300) };
    });

    if (!result) {
      return reply.code(404).send({ error: 'Vendor or membership card not found' });
    }
    return result;
  });

  fastify.get('/api/admin/vendors/:id/activity', { preHandler: fastify.requireRole(['admin']) }, async (request) => {
    const id = (request.params as { id: string }).id;
    return dbQuery('SELECT * FROM transactions WHERE entity_type = \'vendor\' AND entity_id = $1 ORDER BY created_at DESC', [id]);
  });

  fastify.get('/api/admin/vendors/:id/analytics', { preHandler: fastify.requireRole(['admin']) }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const exists = await dbQuery<{ id: string }>('SELECT id FROM vendors WHERE id = $1 LIMIT 1', [id]);
    if (exists.length === 0) return reply.code(404).send({ error: 'Vendor not found' });
    return getVendorAnalytics(id);
  });

  fastify.post('/api/admin/marketing/blast', { preHandler: fastify.requireRole(['admin']) }, async (request, reply) => {
    const body = z.object({
      subject: z.string().min(1),
      text: z.string().min(1),
      html: z.string().optional(),
      smsText: z.string().optional(),
    }).parse(request.body);

    const recipients = await dbQuery<{ email: string | null; phone: string | null; promo_email_opt_in: boolean; promo_sms_opt_in: boolean }>(
      `SELECT email, phone, promo_email_opt_in, promo_sms_opt_in
       FROM users
       WHERE (promo_email_opt_in = true AND email IS NOT NULL AND email <> '')
          OR (promo_sms_opt_in = true AND phone IS NOT NULL AND phone <> '')`,
    );

    if (recipients.length === 0) {
      return reply.send({ emails: 0, sms: 0, errors: ['No opted-in recipients'] });
    }

    const result = await sendDealOfTheDayBlast({
      subject: body.subject,
      text: body.text,
      html: body.html,
      smsText: body.smsText,
      recipients: recipients.map((r) => ({
        email: r.email,
        phone: r.phone,
        promoEmailOptIn: r.promo_email_opt_in,
        promoSmsOptIn: r.promo_sms_opt_in,
      })),
    });

    await writeTransactionAudit({
      actorType: 'admin',
      actorId: request.user?.sub ?? null,
      action: 'admin.marketing.blast',
      entityType: 'user',
      entityId: 'all',
      metadata: { recipients: recipients.length, ...result },
      ip: request.ip,
    });

    return reply.send(result);
  });

  fastify.post('/api/admin/cards', { preHandler: fastify.requireRole(['admin']) }, async (request, reply) => {
    const body = cardSchema.parse(request.body);
    const rows = await dbQuery<{ id: string }>(
      `
        INSERT INTO cards (name, theme, description, image_url, logo_url, icon_url, primary_color, secondary_color, qr_size, layout, expiration_date, max_uses, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `,
      [
        body.name,
        body.theme,
        body.description ?? null,
        body.imageUrl ?? null,
        body.logoUrl ?? null,
        body.iconUrl ?? null,
        body.primaryColor ?? null,
        body.secondaryColor ?? null,
        body.qrSize ?? 240,
        body.layout ?? 'qr_bottom',
        body.expirationDate ?? null,
        body.maxUses ?? null,
        body.status ?? 'draft',
      ],
    );
    return reply.code(201).send({ id: rows[0]!.id });
  });

  fastify.patch('/api/admin/cards/:id', { preHandler: fastify.requireRole(['admin']) }, async (request) => {
    const id = (request.params as { id: string }).id;
    const body = cardSchema.partial().parse(request.body);
    const rows = await dbQuery(
      `
        UPDATE cards
        SET name = COALESCE($2, name),
            theme = COALESCE($3, theme),
            description = COALESCE($4, description),
            image_url = COALESCE($5, image_url),
            logo_url = COALESCE($6, logo_url),
            icon_url = COALESCE($7, icon_url),
            primary_color = COALESCE($8, primary_color),
            secondary_color = COALESCE($9, secondary_color),
            qr_size = COALESCE($10, qr_size),
            layout = COALESCE($11, layout),
            expiration_date = COALESCE($12, expiration_date),
            max_uses = COALESCE($13, max_uses),
            status = COALESCE($14, status),
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        body.name ?? null,
        body.theme ?? null,
        body.description ?? null,
        body.imageUrl ?? null,
        body.logoUrl ?? null,
        body.iconUrl ?? null,
        body.primaryColor ?? null,
        body.secondaryColor ?? null,
        body.qrSize ?? null,
        body.layout ?? null,
        body.expirationDate ?? null,
        body.maxUses ?? null,
        body.status ?? null,
      ],
    );
    return rows[0] ?? {};
  });

  fastify.delete('/api/admin/cards/:id', { preHandler: fastify.requireRole(['admin']) }, async (request) => {
    const id = (request.params as { id: string }).id;
    return dbQuery('DELETE FROM cards WHERE id = $1 RETURNING id', [id]);
  });

  fastify.post('/api/admin/cards/:id/vendors', { preHandler: fastify.requireRole(['admin']) }, async (request) => {
    const id = (request.params as { id: string }).id;
    const body = z.object({ vendorId: z.string().uuid() }).parse(request.body);
    return dbQuery('INSERT INTO card_vendors (card_id, vendor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *', [id, body.vendorId]);
  });

  fastify.delete('/api/admin/cards/:id/vendors/:vendorId', { preHandler: fastify.requireRole(['admin']) }, async (request) => {
    const params = request.params as { id: string; vendorId: string };
    return dbQuery('DELETE FROM card_vendors WHERE card_id = $1 AND vendor_id = $2 RETURNING *', [params.id, params.vendorId]);
  });

  fastify.post('/api/admin/discounts', { preHandler: fastify.requireRole(['admin']) }, async (request, reply) => {
    const body = discountSchema.parse(request.body);
    const rows = await dbQuery<{ id: string }>(
      `
        INSERT INTO discounts (
          card_id, vendor_id, type, value, min_purchase, max_uses_total, max_uses_per_customer, city_overrides, active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
        RETURNING id
      `,
      [
        body.cardId,
        body.vendorId,
        body.type,
        body.value,
        body.minPurchase,
        body.maxUsesTotal ?? null,
        body.maxUsesPerCustomer ?? null,
        JSON.stringify(body.cityOverrides),
        body.active,
      ],
    );
    void syncDiscountToVendorConnections({ discountId: rows[0]!.id, action: 'upsert' }).catch((error) => {
      fastify.log.warn({ error, discountId: rows[0]!.id }, 'POS auto-sync failed');
    });
    return reply.code(201).send({ id: rows[0]!.id });
  });

  fastify.patch('/api/admin/discounts/:id', { preHandler: fastify.requireRole(['admin']) }, async (request) => {
    const id = (request.params as { id: string }).id;
    const body = discountSchema.partial().parse(request.body);
    const rows = await dbQuery(
      `
        UPDATE discounts
        SET card_id = COALESCE($2, card_id),
            vendor_id = COALESCE($3, vendor_id),
            type = COALESCE($4, type),
            value = COALESCE($5, value),
            min_purchase = COALESCE($6, min_purchase),
            max_uses_total = COALESCE($7, max_uses_total),
            max_uses_per_customer = COALESCE($8, max_uses_per_customer),
            city_overrides = COALESCE($9::jsonb, city_overrides),
            active = COALESCE($10, active),
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        body.cardId ?? null,
        body.vendorId ?? null,
        body.type ?? null,
        body.value ?? null,
        body.minPurchase ?? null,
        body.maxUsesTotal ?? null,
        body.maxUsesPerCustomer ?? null,
        body.cityOverrides ? JSON.stringify(body.cityOverrides) : null,
        body.active ?? null,
      ],
    );
    void syncDiscountToVendorConnections({ discountId: id, action: 'upsert' }).catch((error) => {
      fastify.log.warn({ error, discountId: id }, 'POS auto-sync failed');
    });
    return rows[0] ?? {};
  });

  fastify.delete('/api/admin/discounts/:id', { preHandler: fastify.requireRole(['admin']) }, async (request) => {
    const id = (request.params as { id: string }).id;
    void deleteDiscountFromVendorConnections({ discountId: id }).catch((error) => {
      fastify.log.warn({ error, discountId: id }, 'POS auto-sync failed');
    });
    return dbQuery('DELETE FROM discounts WHERE id = $1 RETURNING id', [id]);
  });
}

async function loadCardsWithBusinesses(filters: { id?: string; theme?: string; status?: string }) {
  const cards = await dbQuery<{
    id: string;
    name: string;
    theme: string;
    description: string | null;
    image_url: string | null;
    logo_url: string | null;
    icon_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
    qr_size: number | null;
    layout: string | null;
    expiration_date: string | null;
    max_uses: number | null;
    status: string;
  }>(
    `
      SELECT *
      FROM cards
      WHERE is_membership = true
        AND ($1::uuid IS NULL OR id = $1::uuid)
        AND ($2::text IS NULL OR $2 = '' OR theme = $2)
        AND ($3::text IS NULL OR $3 = '' OR status = $3)
      ORDER BY created_at DESC
    `,
    [filters.id ?? null, filters.theme ?? null, filters.status ?? null],
  );

  const cardIds = cards.map((card) => card.id);
  const vendors = cardIds.length
    ? await dbQuery<{
        card_id: string;
        vendor_id: string;
        vendor_name: string;
        vendor_city: string | null;
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
          SELECT cv.card_id,
                 v.id AS vendor_id,
                 v.name AS vendor_name,
                 v.city AS vendor_city,
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
          JOIN vendors v ON v.id = cv.vendor_id
          LEFT JOIN discounts d ON d.card_id = cv.card_id AND d.vendor_id = cv.vendor_id
          WHERE cv.card_id = ANY($1::uuid[])
          ORDER BY v.name
        `,
        [cardIds],
      )
    : [];

  return cards.map((card) => {
    const participating = vendors.filter((vendor) => vendor.card_id === card.id).map((vendor) => {
      const discount =
        vendor.discount_id && vendor.discount_type && vendor.discount_value !== null && vendor.min_purchase !== null
          ? buildLookupDiscountView(
              {
                id: vendor.discount_id,
                cardId: card.id,
                vendorId: vendor.vendor_id,
                type: vendor.discount_type,
                value: vendor.discount_value,
                minPurchase: vendor.min_purchase,
                maxUsesTotal: vendor.max_uses_total,
                maxUsesPerCustomer: vendor.max_uses_per_customer,
                usesCount: vendor.uses_count ?? 0,
                cityOverrides: vendor.city_overrides,
                active: Boolean(vendor.active),
              },
              null,
            )
          : null;

      return {
        id: vendor.vendor_id,
        name: vendor.vendor_name,
        city: vendor.vendor_city,
        discount,
      };
    });

    return {
      ...card,
      participatingBusinesses: participating,
    };
  });
}
