import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { dbQuery, withDbClient, type PoolClient } from '../db/pool.js';
import { getAdminAnalytics, getVendorAnalytics } from '../services/analytics.js';
import { buildLookupDiscountView, generateDiscountCode, humanDiscountLabel } from '../services/discounts.js';
import { generateTempPassword } from '../utils/ids.js';
import { writeTransactionAudit } from '../services/audit.js';
import { sendVendorWelcomeEmail, sendDealOfTheDayBlast } from '../services/resend.js';
import { getAllPushTokens, getPushTokensByCity, sendPushNotifications } from '../services/push.js';
import { qrCodeUrl } from '../services/quickchart.js';
import { config } from '../config.js';

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  const message = String((error as { message?: unknown })?.message ?? '');
  return code === '23505' || message.includes('unique constraint');
}

// Geocoding function using Mapbox Geocoding API
async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  if (!config.mapboxAccessToken || !address.trim()) return null;
  
  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${config.mapboxAccessToken}&limit=1`;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json() as { features?: Array<{ center: [number, number] }> };
    if (data.features && data.features.length > 0 && data.features[0]) {
      const [longitude, latitude] = data.features[0].center;
      return { latitude, longitude };
    }
    
    return null;
  } catch (error) {
    console.warn('[admin] Geocoding error:', error);
    return null;
  }
}

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
  ownerName: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  station: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  posType: z.enum(['square', 'stripe', 'clover', 'toast', 'other']).optional(),
  posSystem: z.string().optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  password: z.string().min(8).optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'suspended']).optional(),
  discountType: z.enum(['fixed', 'percent', 'bogo']).optional(),
  discountValue: z.number().optional(),
  discountStartsAt: z.string().datetime().optional().nullable(),
  discountEndsAt: z.string().datetime().optional().nullable(),
  boosted: z.boolean().optional(),
  membersOnly: z.boolean().optional(),
  discountTerms: z.string().optional().nullable(),
  discountDescription: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  iconDataUrl: z.string().optional().nullable(),
  logoDataUrl: z.string().optional().nullable(),
});

const discountSchema = z.object({
  cardId: z.string().uuid(),
  vendorId: z.string().uuid(),
  type: z.enum(['fixed', 'percent', 'bogo']),
  value: z.number(),
  minPurchase: z.number().default(0),
  maxUsesTotal: z.number().int().positive().optional().nullable(),
  maxUsesPerCustomer: z.number().int().positive().optional().nullable(),
  cityOverrides: z.record(z.string(), z.object({ type: z.enum(['fixed', 'percent', 'bogo']).optional(), value: z.number().optional() })).default({}),
  active: z.boolean().default(true),
});

const userUpdateSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
  pushPreferences: z
    .object({
      newVendor: z.boolean().optional(),
      expiringDeal: z.boolean().optional(),
      localEvent: z.boolean().optional(),
    })
    .optional(),
  promoEmailOptIn: z.boolean().optional(),
  promoSmsOptIn: z.boolean().optional(),
});

export async function registerAdminRoutes(fastify: FastifyInstance): Promise<void> {


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
               d.starts_at AS discount_starts_at, d.ends_at AS discount_ends_at, d.boosted AS discount_boosted, d.members_only AS discount_members_only
        FROM vendors v
        LEFT JOIN LATERAL (
          SELECT d.type, d.value, d.discount_code, d.description, d.starts_at, d.ends_at, d.boosted, d.members_only
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
               d.starts_at AS discount_starts_at, d.ends_at AS discount_ends_at, d.boosted AS discount_boosted, d.members_only AS discount_members_only
        FROM vendors v
        LEFT JOIN LATERAL (
          SELECT d.type, d.value, d.discount_code, d.description, d.starts_at, d.ends_at, d.boosted, d.members_only
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
    let result;
    try {
      result = await withDbClient(async (client: PoolClient) => {
      const address = body.address ?? body.location;
      
      // Auto-geocode if address is provided but coordinates are missing
      let latitude = body.latitude;
      let longitude = body.longitude;
      if (address && (!latitude || !longitude)) {
        const coords = await geocodeAddress(address);
        if (coords) {
          latitude = coords.latitude;
          longitude = coords.longitude;
        }
      }
      
      const vendorRows = await client.query<{ id: string }>(
        `
          INSERT INTO vendors (name, owner_name, location, address, city, station, category, pos_type, pos_system, email, phone, password_hash, status, latitude, longitude, icon_url, logo_url, discount_terms)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          RETURNING id
        `,
        [
          body.name,
          body.ownerName ?? null,
          address ?? null,
          address ?? null,
          body.city ?? null,
          body.station ?? null,
          body.category ?? null,
          null,
          null,
          body.email ?? null,
          body.phone ?? null,
          null,
          body.status ?? 'approved',
          latitude ?? null,
          longitude ?? null,
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
      const discountValue = body.discountValue ?? 0;
      const label = humanDiscountLabel(discountType, discountValue);
      const discountCode = generateDiscountCode({ merchantId: body.name, type: discountType, value: discountValue });

      const discountDescription = body.discountType === 'bogo' && body.discountDescription
        ? body.discountDescription.trim()
        : (body.discountDescription?.trim() || (discountValue === 0 ? 'No discount' : `${label} member discount`));

      const discountRows = await client.query<{ id: string }>(
        `
          INSERT INTO discounts (card_id, vendor_id, type, value, discount_code, description, active, starts_at, ends_at, boosted, members_only)
          VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10)
          ON CONFLICT (card_id, vendor_id) DO UPDATE SET type = EXCLUDED.type, value = EXCLUDED.value, discount_code = COALESCE(discounts.discount_code, EXCLUDED.discount_code), description = EXCLUDED.description, active = true, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, boosted = EXCLUDED.boosted, members_only = EXCLUDED.members_only, updated_at = now()
          RETURNING id
        `,
        [cardId, vendorId, discountType, discountValue, discountCode, discountDescription, body.discountStartsAt ?? null, body.discountEndsAt ?? null, body.boosted ?? false, body.membersOnly ?? false],
      );

      return {
        vendor: { id: vendorId, name: body.name, ownerName: body.ownerName ?? null, address: address ?? null, category: body.category ?? null },
        discountCode,
        discount: { id: discountRows.rows[0]!.id, type: discountType, value: discountValue, label },
        membershipCard: { id: cardId, name: cardName },
        posInstructions: `Ask the customer to show their ${cardName} pass, scan its barcode, then apply code ${discountCode} in your POS. No NFC required.`,
      };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply.code(409).send({ error: 'A vendor with this email already exists.' });
      }
      throw error;
    }

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

    // Automatic push notifications disabled - only admin can manually trigger push notifications

    return reply.code(201).send(result);
  });

  fastify.patch('/api/admin/vendors/:id', { preHandler: fastify.requireRole(['admin']) }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const body = vendorSchema.partial().parse(request.body);
    if (body.discountType === 'bogo' && (!body.discountDescription || !body.discountDescription.trim())) {
      return reply.code(400).send({ error: 'BOGO discounts require a description' });
    }

    // Only keys actually present in the body are written, so an explicit
    // `null` clears a column while an omitted key leaves it untouched.
    const VENDOR_UPDATE_COLUMNS: Record<string, string> = {
      name: 'name',
      ownerName: 'owner_name',
      city: 'city',
      station: 'station',
      category: 'category',
      email: 'email',
      phone: 'phone',
      status: 'status',
      latitude: 'latitude',
      longitude: 'longitude',
      iconDataUrl: 'icon_url',
      logoDataUrl: 'logo_url',
      discountTerms: 'discount_terms',
      website: 'website',
    };
    const setClauses: string[] = [];
    const values: unknown[] = [id];
    const push = (column: string, value: unknown) => {
      values.push(value);
      setClauses.push(`${column} = $${values.length}`);
    };
    for (const [key, column] of Object.entries(VENDOR_UPDATE_COLUMNS)) {
      const value = (body as Record<string, unknown>)[key];
      if (value !== undefined) push(column, value);
    }
    // `address` and `location` are always written together.
    if (body.address !== undefined || body.location !== undefined) {
      const address = body.address !== undefined ? body.address : body.location;
      push('location', address);
      push('address', address);
    }

    let rows;
    try {
      rows = setClauses.length === 0
        ? await dbQuery<Record<string, unknown>>('SELECT * FROM vendors WHERE id = $1', [id])
        : await dbQuery<Record<string, unknown>>(
            `UPDATE vendors SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
            values,
          );
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply.code(409).send({ error: 'A vendor with this email already exists.' });
      }
      throw error;
    }

    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Vendor not found' });
    }

    const discountFieldsPresent =
      body.discountType !== undefined || body.discountValue !== undefined || body.discountStartsAt !== undefined ||
      body.discountEndsAt !== undefined || body.boosted !== undefined || body.membersOnly !== undefined ||
      body.discountDescription !== undefined;

    if (discountFieldsPresent) {
      const discountDescription = body.discountDescription?.trim() ?? (body.discountDescription === null ? null : undefined);
      // Presence-aware column updates for the membership discount row; an
      // explicit null clears the value (e.g. removing a flash-deal window).
      const DISCOUNT_COLUMNS: Array<[string, unknown]> = [
        ['type', body.discountType],
        ['value', body.discountValue],
        ['description', discountDescription],
        ['starts_at', body.discountStartsAt],
        ['ends_at', body.discountEndsAt],
        ['boosted', body.boosted],
        ['members_only', body.membersOnly],
      ];
      const membership = await dbQuery<{ id: string }>(`SELECT id FROM cards WHERE is_membership = true LIMIT 1`);
      const membershipId = membership[0]?.id;
      if (membershipId) {
        const existing = await dbQuery<{ id: string }>(
          'SELECT id FROM discounts WHERE vendor_id = $1 AND card_id = $2 LIMIT 1',
          [id, membershipId],
        );
        if (existing.length === 0 && (body.discountType !== undefined || body.discountValue !== undefined)) {
          await dbQuery(`INSERT INTO card_vendors (card_id, vendor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [membershipId, id]);
          const discountCode = generateDiscountCode({
            merchantId: String(rows[0]?.name ?? id),
            type: body.discountType ?? 'percent',
            value: body.discountValue ?? 0,
          });
          await dbQuery(
            `INSERT INTO discounts (card_id, vendor_id, type, value, discount_code, description, active, starts_at, ends_at, boosted, members_only)
             VALUES ($2, $1, COALESCE($3, 'percent'), COALESCE($4, 0), $5, $6, true, $7, $8, COALESCE($9, false), COALESCE($10, false))`,
            [id, membershipId, body.discountType ?? null, body.discountValue ?? null, discountCode,
             discountDescription ?? null, body.discountStartsAt ?? null, body.discountEndsAt ?? null,
             body.boosted ?? null, body.membersOnly ?? null],
          );
        } else if (existing.length > 0) {
          const sets = DISCOUNT_COLUMNS
            .filter(([, value]) => value !== undefined)
            .map(([column], index) => `${column} = $${index + 3}`);
          if (sets.length > 0) {
            await dbQuery(
              `UPDATE discounts SET ${sets.join(', ')}, updated_at = now() WHERE vendor_id = $1 AND card_id = $2`,
              [id, membershipId, ...DISCOUNT_COLUMNS.filter(([, value]) => value !== undefined).map(([, value]) => value)],
            );
          }
        }
      }
    }

    return rows[0];
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


  fastify.post('/api/admin/push', { preHandler: fastify.requireRole(['admin']) }, async (request, reply) => {
    const body = z.object({
      title: z.string().min(1).max(100),
      message: z.string().min(1).max(500),
      city: z.string().optional(),
    }).parse(request.body);

    const tokens = body.city && body.city.trim()
      ? await getPushTokensByCity(body.city.trim())
      : await getAllPushTokens();

    if (tokens.length === 0) {
      return reply.send({ sent: 0, message: 'No push tokens registered for the selected audience.' });
    }

    const pushResult = await sendPushNotifications(tokens, body.title, body.message, { type: 'admin_broadcast' });

    await writeTransactionAudit({
      actorType: 'admin',
      actorId: request.user?.sub ?? null,
      action: 'admin.push.broadcast',
      entityType: 'push_notification',
      entityId: null,
      metadata: { title: body.title, recipients: tokens.length, city: body.city ?? null, errors: pushResult.errors },
      ip: request.ip,
    });

    return reply.send({ sent: pushResult.sent, errors: pushResult.errors });
  });






  fastify.post('/api/admin/discounts', { preHandler: fastify.requireRole(['admin']) }, async (request, reply) => {
    const body = discountSchema.parse(request.body);
    let rows: { id: string }[];
    try {
      rows = await dbQuery<{ id: string }>(
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
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply.code(409).send({ error: 'A discount already exists for this vendor on this card. Edit the existing discount instead.' });
      }
      throw error;
    }
    return reply.code(201).send({ id: rows[0]!.id });
  });

  fastify.patch('/api/admin/discounts/:id', { preHandler: fastify.requireRole(['admin']) }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const body = discountSchema.partial().parse(request.body);
    // Only keys actually present in the body are written, so an explicit
    // `null` clears a column (e.g. removing a usage limit) while an omitted
    // key leaves it untouched.
    const entries: Array<[string, unknown]> = [];
    if (body.cardId !== undefined) entries.push(['card_id', body.cardId]);
    if (body.vendorId !== undefined) entries.push(['vendor_id', body.vendorId]);
    if (body.type !== undefined) entries.push(['type', body.type]);
    if (body.value !== undefined) entries.push(['value', body.value]);
    if (body.minPurchase !== undefined) entries.push(['min_purchase', body.minPurchase]);
    if (body.maxUsesTotal !== undefined) entries.push(['max_uses_total', body.maxUsesTotal]);
    if (body.maxUsesPerCustomer !== undefined) entries.push(['max_uses_per_customer', body.maxUsesPerCustomer]);
    if (body.cityOverrides !== undefined) entries.push(['city_overrides', JSON.stringify(body.cityOverrides)]);
    if (body.active !== undefined) entries.push(['active', body.active]);
    let rows: Record<string, unknown>[];
    try {
      rows = entries.length === 0
        ? await dbQuery<Record<string, unknown>>('SELECT * FROM discounts WHERE id = $1', [id])
        : await dbQuery<Record<string, unknown>>(
            `UPDATE discounts SET ${entries.map(([column], i) => `${column} = $${i + 2}${column === 'city_overrides' ? '::jsonb' : ''}`).join(', ')}, updated_at = now()
             WHERE id = $1
             RETURNING *`,
            [id, ...entries.map(([, value]) => value)],
          );
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply.code(409).send({ error: 'A discount already exists for this vendor on this card. Edit the existing discount instead.' });
      }
      throw error;
    }
    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Discount not found' });
    }
    return rows[0];
  });

  fastify.delete('/api/admin/discounts/:id', { preHandler: fastify.requireRole(['admin']) }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const rows = await dbQuery('DELETE FROM discounts WHERE id = $1 RETURNING id', [id]);
    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Discount not found' });
    }
    return rows;
  });




}

