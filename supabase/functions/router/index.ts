import { z } from 'npm:zod';
import bcrypt from 'npm:bcryptjs';
import { config } from './lib/config.ts';
import { authenticate, requireRole } from './lib/auth.ts';
import { dbQuery, withDbClient } from './lib/db.ts';
import { getAdminAnalytics, getVendorAnalytics } from './lib/analytics.ts';
import { buildLookupDiscountView } from './lib/discounts.ts';
import { resolvePassLookup, resolveCardLookup } from './lib/lookup.ts';
import { redeemDiscount } from './lib/redeem.ts';
import { buildMemberPassUrl } from './lib/wallet.ts';
import { createVendorWithDiscount } from './lib/vendors.ts';
import { ensureMembershipPass, membershipWalletUrl } from './lib/membership.ts';
import { generateDiscountCode, humanDiscountLabel } from './lib/codes.ts';
import { qrCodeUrl } from './lib/quickchart.ts';
import { normalizePhone } from './lib/phone.ts';
import { createRedemptionToken, redeemByToken, affirmRedemptionToken } from './lib/redemptionTokens.ts';
import { sendDealOfTheDayBlast } from './lib/mailjet.ts';
import {
  createContentBlock,
  deleteContentBlock,
  getTheme,
  listContentBlocks,
  saveTheme,
  updateContentBlock,
} from './lib/content.ts';
import {
  fetchPublicEvents,
  getEventsRssUrls,
  saveEventsRssUrls,
  listAdminEvents,
  createAdminEvent,
  updateAdminEvent,
  deleteAdminEvent,
  adminEventSchema,
} from './lib/events.ts';
import { savePushToken } from './lib/push.ts';

// Shape the customer-facing membership pass payload (wallet + barcode links),
// creating the pass idempotently. Returns null if pass generation fails.
async function buildMembershipPassResponse(userId: string, baseUrl?: string) {
  try {
    const pass = await ensureMembershipPass(userId);
    return {
      serialNumber: pass.serial_number,
      lookupToken: pass.lookup_token,
      barcodeValue: pass.barcode_value ?? pass.lookup_token,
      cardId: pass.card_id,
      walletUrl: membershipWalletUrl(pass),
      androidUrl: pass.passcreator_android_uri ?? null,
      passUrl: baseUrl ? buildMemberPassUrl(baseUrl, pass.serial_number) : null,
      passcreatorId: pass.passcreator_id ?? null,
    };
  } catch {
    return null;
  }
}

const customerRegisterSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(7).optional(),
  password: z.string().min(8),
  city: z.string().optional(),
  promoEmailOptIn: z.boolean().default(false),
  promoSmsOptIn: z.boolean().default(false),
  termsAccepted: z.boolean().refine((v) => v === true, { message: 'Terms of Use must be accepted' }),
  privacyAccepted: z.boolean().refine((v) => v === true, { message: 'Privacy Policy must be accepted' }),
  eulaAccepted: z.boolean().refine((v) => v === true, { message: 'EULA must be accepted' }),
});

const contentCreateSchema = z.object({
  kind: z.enum(['text', 'article', 'image', 'file', 'embed']).default('text'),
  title: z.string().min(1),
  body: z.string().optional(),
  url: z.string().optional(),
  dataUrl: z.string().optional(),
  position: z.number().int().optional(),
  published: z.boolean().optional(),
});

const contentUpdateSchema = contentCreateSchema.partial();

const themeTabSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  color: z.string().min(1),
  gradient: z.tuple([z.string().min(1), z.string().min(1)]),
});

const themeSchema = z.object({
  brand: z.string().min(1),
  primaryGradient: z.tuple([z.string().min(1), z.string().min(1)]),
  tabs: z.array(themeTabSchema).min(1),
});

const pushTokenSchema = z.object({
  token: z.string().min(1),
  city: z.string().optional(),
});

const customerLoginSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(7).optional(),
    password: z.string().min(1),
  })
  .refine((data) => Boolean(data.email || data.phone), { message: 'Email or phone is required', path: ['email'] });

const socialSchema = z
  .object({
    provider: z.string().min(1),
    token: z.string().min(1).optional(),
    idToken: z.string().min(1).optional(),
    email: z.string().email().optional(),
    fullName: z.string().min(1).default('Social User'),
  })
  .refine((value) => Boolean(value.token || value.idToken), { message: 'token or idToken is required' });

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

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

const adminVendorCreateSchema = z
  .object({
    name: z.string().min(1),
    ownerName: z.string().optional(),
    address: z.string().optional(),
    category: z.enum(['Sports', 'Dining', 'Entertainment']),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    discountType: z.enum(['fixed', 'percent', 'bogo']).default('percent'),
    discountValue: z.number().positive(),
    discountDescription: z.string().optional().nullable(),
    discountTerms: z.string().optional().nullable(),
    discountStartsAt: z.string().datetime().optional().nullable(),
    discountEndsAt: z.string().datetime().optional().nullable(),
    boosted: z.boolean().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    iconDataUrl: z.string().optional(),
    logoDataUrl: z.string().optional(),
  })
  .refine((data) => data.discountType !== 'bogo' || Boolean(data.discountDescription?.trim()), {
    message: 'BOGO discounts require a description',
    path: ['discountDescription'],
  });

const adminVendorUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    ownerName: z.string().optional(),
    address: z.string().optional(),
    category: z.enum(['Sports', 'Dining', 'Entertainment']).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    discountType: z.enum(['fixed', 'percent', 'bogo']).optional(),
    discountValue: z.number().positive().optional(),
    discountDescription: z.string().optional().nullable(),
    discountTerms: z.string().optional().nullable(),
    discountStartsAt: z.string().datetime().optional().nullable(),
    discountEndsAt: z.string().datetime().optional().nullable(),
    boosted: z.boolean().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    status: z.enum(['pending', 'approved', 'rejected', 'suspended']).optional(),
  })
  .refine((data) => data.discountType !== 'bogo' || (data.discountDescription !== undefined && Boolean(data.discountDescription?.trim())), {
    message: 'BOGO discounts require a description',
    path: ['discountDescription'],
  });

const adminSettingsSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  location: z.string().optional(),
});

const ticketBarcodeSchema = z.object({ barcode: z.string().min(1), format: z.string().min(1) });

const ticketCreateSchema = z.object({
  barcode: z.string().min(1),
  barcodeFormat: z.string().optional(),
  name: z.string().min(1).default('Event Ticket'),
  allowedUses: z.number().int().positive().default(1),
  availableCount: z.number().int().positive().default(4),
  barcodes: z.array(ticketBarcodeSchema).default([]),
  drawingDeadline: z.coerce.date().optional(),
  drawingDate: z.string().optional(),
  userId: z.string().uuid().optional(),
});

const ticketUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  barcode: z.string().min(1).optional(),
  barcodeFormat: z.string().optional(),
  allowedUses: z.number().int().positive().optional(),
  availableCount: z.number().int().positive().optional(),
  barcodes: z.array(ticketBarcodeSchema).optional(),
  usedUses: z.number().int().min(0).optional(),
  status: z.enum(['active', 'used', 'disabled']).optional(),
  drawingDeadline: z.coerce.date().optional().nullable(),
  drawingStatus: z.enum(['open', 'drawn', 'closed']).optional(),
  drawingDate: z.string().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
});

const ticketEntrySchema = z.object({
  ticketId: z.string().uuid(),
  requestedCount: z.coerce.number().int().min(1).default(1),
});

const discountSchema = z.object({
  cardId: z.string().uuid(),
  vendorId: z.string().uuid(),
  type: z.enum(['fixed', 'percent', 'bogo']),
  value: z.number(),
  minPurchase: z.number().default(0),
  maxUsesTotal: z.number().int().positive().optional(),
  maxUsesPerCustomer: z.number().int().positive().optional(),
  cityOverrides: z.record(z.string(), z.object({ type: z.enum(['fixed', 'percent', 'bogo']).optional(), value: z.number().optional() })).default({}),
  active: z.boolean().default(true),
});

function corsOrigin(request: Request): string {
  const origin = request.headers.get('origin');
  if (!origin) return '*';
  if (config.allowedOrigins.length === 0) return '*';
  return config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0]!;
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  const message = String((error as { message?: unknown })?.message ?? '');
  return code === '23505' || message.includes('unique constraint');
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderRedemptionPage(result: { ok: boolean; discount?: { type: 'fixed' | 'percent' | 'bogo'; value: number; description: string; instruction?: string } | null; amountApplied?: number; redemptionId?: string; error?: string }) {
  const success = result.ok;
  const title = success ? 'Membership Accepted' : 'Unable to Redeem';

  let discountAmount = result.discount?.description ?? 'discount';
  if (success) {
    if (result.discount?.type === 'fixed') {
      discountAmount = `$${(result.amountApplied ?? 0).toFixed(2)}`;
    } else if (result.discount?.type === 'percent') {
      discountAmount = `${result.discount.value}% off`;
    }
  }

  const errorMessage = escapeHtml(result.error ?? 'This QR code is invalid or has already been used.');
  const redemptionId = result.redemptionId ? escapeHtml(result.redemptionId) : '';

  const checkIcon = `<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:44px;height:44px;stroke:#fff;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  const xIcon = `<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:44px;height:44px;stroke:#fff;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; background:${success ? '#f0fdf4' : '#fef2f2'}; color:${success ? '#14532d' : '#7f1d1d'}; padding:24px; }
    .card { background:#fff; border-radius:24px; box-shadow:0 10px 40px rgba(0,0,0,0.08); max-width:420px; width:100%; padding:40px 28px; text-align:center; }
    .icon { width:80px; height:80px; margin:0 auto 16px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:${success ? '#22c55e' : '#ef4444'}; }
    h1 { font-size:24px; font-weight:700; margin:0 0 8px; color:#111827; }
    .subtitle { font-size:15px; color:#6b7280; margin:0 0 24px; }
    .message { font-size:17px; line-height:1.5; margin:0 0 16px; color:#374151; }
    .amount { font-size:18px; font-weight:600; color:#111827; margin:0 0 8px; }
    .amount span { color:#22c55e; }
    .tracking { font-size:13px; color:#6b7280; margin:0 0 24px; word-break:break-all; }
    .tracking code { background:#f3f4f6; border-radius:4px; padding:2px 6px; font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; color:#111827; }
    .instruction { font-size:14px; color:#4b5563; background:#f9fafb; border-radius:12px; padding:12px 16px; margin:0 0 20px; line-height:1.5; }
    .footer { font-size:12px; color:#9ca3af; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? checkIcon : xIcon}</div>
    <h1>${escapeHtml(title)}</h1>
    ${success ? '<p class="subtitle">Show this screen to the vendor.</p>' : ''}
    <p class="message">${success ? 'Light Rail Deals Membership Accepted' : errorMessage}</p>
    ${success ? `<p class="amount">Applied discount amount: <span>${escapeHtml(discountAmount)}</span></p>` : ''}
    ${success && redemptionId ? `<p class="tracking">Tracking ID: <code>${redemptionId}</code></p>` : ''}
    ${success && result.discount?.instruction ? `<p class="instruction">${escapeHtml(result.discount.instruction)}</p>` : ''}
    <p class="footer">${success ? 'Redemption recorded in Light Rail Deals.' : 'Ask the member to refresh their discount QR code.'}</p>
  </div>
</body>
</html>`;
}

function json(request: Request, body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': corsOrigin(request),
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      ...(init.headers ?? {}),
    },
  });
}

function getIp(request: Request): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

function queryObject(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams.entries());
}

async function readJsonBody<T>(request: Request, fallback: T): Promise<T> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return fallback;
  const text = await request.text();
  if (!text) return fallback;
  return JSON.parse(text) as T;
}

function encodeBase64UrlJson(value: unknown): string {
  return btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decodeBase64UrlJson<T>(value: string): T | null {
  try {
    const jsonText = atob(value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '='));
    return JSON.parse(jsonText) as T;
  } catch {
    return null;
  }
}

async function issueToken(role: 'customer' | 'vendor' | 'admin', id: string, email?: string | null) {
  const { signJwt } = await import('./lib/jwt.ts');
  // Members stay signed in until they manually log out.
  const expiresIn = role === 'customer' ? '365d' : '7d';
  return signJwt({ sub: id, role, email: email ?? null }, expiresIn);
}

async function buildCustomerProfile(userId: string) {
  const rows = await dbQuery<{
    id: string;
    email: string | null;
    phone: string | null;
    fullName: string;
    firstName: string | null;
    lastName: string | null;
    city: string | null;
    status: string;
    pushEnabledNewVendor: boolean;
    pushEnabledExpiringDeal: boolean;
    pushEnabledLocalEvent: boolean;
    promoEmailOptIn: boolean;
    promoSmsOptIn: boolean;
    termsAcceptedAt: string | null;
    privacyAcceptedAt: string | null;
    eulaAcceptedAt: string | null;
  }>(
    `SELECT id, email::text AS email, phone, full_name AS "fullName",
            first_name AS "firstName", last_name AS "lastName", city, status,
            push_enabled_new_vendor AS "pushEnabledNewVendor",
            push_enabled_expiring_deal AS "pushEnabledExpiringDeal",
            push_enabled_local_event AS "pushEnabledLocalEvent",
            promo_email_opt_in AS "promoEmailOptIn",
            promo_sms_opt_in AS "promoSmsOptIn",
            terms_accepted_at AS "termsAcceptedAt",
            privacy_accepted_at AS "privacyAcceptedAt",
            eula_accepted_at AS "eulaAcceptedAt"
     FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const user = rows[0];
  if (!user) return null;
  return {
    ...user,
    pushPreferences: {
      newVendor: user.pushEnabledNewVendor,
      expiringDeal: user.pushEnabledExpiringDeal,
      localEvent: user.pushEnabledLocalEvent,
    },
  };
}

async function loadCardsWithBusinesses(filters: { id?: string; theme?: string; status?: string; city?: string }) {
  const cards = await dbQuery<{
    id: string;
    name: string;
    theme: string;
    description: string | null;
    image_url: string | null;
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

  return cards.map((card) => ({
    ...card,
    participatingBusinesses: vendors.filter((vendor) => vendor.card_id === card.id).map((vendor) => ({
      id: vendor.vendor_id,
      name: vendor.vendor_name,
      city: vendor.vendor_city,
      discount:
        vendor.discount_id && vendor.discount_type && vendor.discount_value !== null && vendor.min_purchase !== null
          ? buildLookupDiscountView(
              {
                id: vendor.discount_id,
                card_id: card.id,
                vendor_id: vendor.vendor_id,
                type: vendor.discount_type,
                value: vendor.discount_value,
                min_purchase: vendor.min_purchase,
                max_uses_total: vendor.max_uses_total,
                max_uses_per_customer: vendor.max_uses_per_customer,
                uses_count: vendor.uses_count ?? 0,
                city_overrides: vendor.city_overrides,
                active: Boolean(vendor.active),
              },
              filters.city ?? null,
            )
          : null,
    })),
  }));
}

function notFound(request: Request): Response {
  return json(request, { error: 'Not found' }, { status: 404 });
}

Deno.serve(async (request) => {
  const url = new URL(request.url);

  // Normalize the request path to the internal /api/* contract regardless of how
  // the Edge Function is invoked. Supabase serves it under
  //   /functions/v1/router/...   (local / direct)
  //   /router/...                (production gateway strips /functions/v1)
  // and clients may or may not include the /api prefix. All of these resolve to
  // the same internal routes, which is what eliminates the 404/Not Found errors.
  let path = url.pathname
    .replace(/^\/functions\/v1\/router(?=\/|$)/, '')
    .replace(/^\/router(?=\/|$)/, '');
  if (path === '' || path === '/') {
    path = '/';
  } else {
    if (!path.startsWith('/')) path = `/${path}`;
    if (path !== '/api' && !path.startsWith('/api/')) {
      path = `/api${path}`;
    }
  }

  const baseUrl = config.publicApiBaseUrl || `${url.origin}/functions/v1/router`;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin(request),
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      },
    });
  }

  if (config.blockedIps.length > 0) {
    const ip = getIp(request);
    if (ip && config.blockedIps.includes(ip)) {
      return json(request, { error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    if (path === '/' && request.method === 'GET') {
      return json(request, { name: 'Master Gift/Discount Card System Backend', version: '0.1.0' });
    }

    if (path === '/api/health' && request.method === 'GET') {
      let db = false;
      try {
        await dbQuery('SELECT 1');
        db = true;
      } catch {
        db = false;
      }
      return json(request, { status: 'ok', db });
    }

    if (path === '/api/auth/register' && request.method === 'POST') {
      const body = customerRegisterSchema.parse(await readJsonBody(request, {}));
      // Phone numbers authenticate members, so store one canonical form.
      const phone = normalizePhone(body.phone);
      if (body.phone && !phone) return json(request, { error: 'Invalid phone number' }, { status: 400 });
      const fullName = `${body.firstName} ${body.lastName}`.trim();
      const passwordHash = await bcrypt.hash(body.password, 10);
      let rows: Array<{ id: string }>;
      try {
        rows = await withDbClient(async (client) => {
          await client.query('BEGIN');
          try {
            const result = await client.query<{ id: string }>(
              `INSERT INTO users (email, phone, password_hash, full_name, first_name, last_name, city, promo_email_opt_in, promo_sms_opt_in, terms_accepted_at, privacy_accepted_at, eula_accepted_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
              [
                body.email ?? null,
                phone ?? null,
                passwordHash,
                fullName,
                body.firstName,
                body.lastName,
                body.city ?? null,
                body.promoEmailOptIn,
                body.promoSmsOptIn,
                body.termsAccepted ? new Date().toISOString() : null,
                body.privacyAccepted ? new Date().toISOString() : null,
                body.eulaAccepted ? new Date().toISOString() : null,
              ],
            );
            await client.query('COMMIT');
            return result.rows;
          } catch (error) {
            await client.query('ROLLBACK');
            throw error;
          }
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          return json(request, { error: 'An account with this email or phone number already exists. Please sign in.' }, { status: 409 });
        }
        throw error;
      }
      const profile = await buildCustomerProfile(rows[0]!.id);
      const token = await issueToken('customer', rows[0]!.id, profile?.email ?? body.email ?? null);
      // Auto-generate the member's all-in-one membership pass right after signup.
      const membershipPass = await buildMembershipPassResponse(rows[0]!.id, baseUrl);
      return json(request, { token, expiresIn: '365d', profile, membershipPass, walletUrl: membershipPass?.walletUrl ?? null }, { status: 201 });
    }

    if (path === '/api/auth/login' && request.method === 'POST') {
      const body = customerLoginSchema.parse(await readJsonBody(request, {}));
      const loginPhone = body.phone ? normalizePhone(body.phone) : null;
      if (body.phone && !loginPhone) return json(request, { error: 'Invalid phone number' }, { status: 400 });
      const rows = await dbQuery<{ id: string; email: string | null; password_hash: string | null; status: string; full_name: string }>(
        'SELECT id, email::text AS email, password_hash, status, full_name FROM users WHERE ($1::text IS NOT NULL AND lower(email::text) = lower($1::text)) OR ($2::text IS NOT NULL AND phone = $2::text) ORDER BY created_at DESC LIMIT 1',
        [body.email ?? null, loginPhone ?? null],
      );
      const user = rows[0];
      if (!user || user.status !== 'active' || !user.password_hash || !(await bcrypt.compare(body.password, user.password_hash))) {
        return json(request, { error: 'Invalid credentials' }, { status: 401 });
      }
      const profile = await buildCustomerProfile(user.id);
      const token = await issueToken('customer', user.id, user.email);
      const membershipPass = await buildMembershipPassResponse(user.id, baseUrl);
      return json(request, { token, expiresIn: '365d', profile, membershipPass, walletUrl: membershipPass?.walletUrl ?? null });
    }

    if (path === '/api/auth/social' && request.method === 'POST') {
      const body = socialSchema.parse(await readJsonBody(request, {}));
      const socialToken = body.token ?? body.idToken ?? '';
      const socialId = `${body.provider}:${socialToken}`;
      const rows = await withDbClient(async (client) => {
        await client.query('BEGIN');
        try {
          const existing = await client.query<{ id: string; email: string | null }>('SELECT id, email::text AS email FROM users WHERE social_provider = $1 AND social_id = $2 LIMIT 1', [
            body.provider,
            socialId,
          ]);
          if (existing.rows[0]) {
            await client.query('COMMIT');
            return existing.rows[0]!;
          }
          const created = await client.query<{ id: string }>(
            `INSERT INTO users (email, password_hash, social_provider, social_id, full_name) VALUES ($1, NULL, $2, $3, $4) RETURNING id`,
            [body.email ?? null, body.provider, socialId, body.fullName],
          );
          await client.query('COMMIT');
          return { id: created.rows[0]!.id, email: body.email ?? null };
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      });
      const token = await issueToken('customer', rows.id, rows.email);
      const profile = await buildCustomerProfile(rows.id);
      const membershipPass = await buildMembershipPassResponse(rows.id, baseUrl);
      return json(request, { token, expiresIn: '7d', profile, membershipPass, walletUrl: membershipPass?.walletUrl ?? null });
    }

    if (path === '/api/auth/admin/login' && request.method === 'POST') {
      const body = adminLoginSchema.parse(await readJsonBody(request, {}));
      const rows = await dbQuery<{ id: string; email: string; password_hash: string; role: string }>('SELECT id, email::text AS email, password_hash, role FROM admins WHERE email::text = $1 LIMIT 1', [
        body.email,
      ]);
      let admin = rows[0];
      // Bootstrap the first owner from the configured ADMIN_EMAIL/ADMIN_PASSWORD
      // when no admin exists yet, so the owner can sign in and then manage
      // credentials from the dashboard. Credentials are never hardcoded here.
      if (!admin) {
        const counted = await dbQuery<{ count: string }>('SELECT count(*)::text AS count FROM admins');
        const noAdmins = counted[0]?.count === '0';
        if (noAdmins && body.email.toLowerCase() === config.adminEmail.toLowerCase() && body.password === config.adminPassword) {
          const seedHash = await bcrypt.hash(body.password, 10);
          const created = await dbQuery<{ id: string; email: string; password_hash: string; role: string }>(
            `INSERT INTO admins (email, password_hash, role) VALUES ($1, $2, 'owner') RETURNING id, email::text AS email, password_hash, role`,
            [config.adminEmail, seedHash],
          );
          admin = created[0];
        }
      }
      if (!admin || !(await bcrypt.compare(body.password, admin.password_hash))) return json(request, { error: 'Invalid credentials' }, { status: 401 });
      const token = await issueToken('admin', admin.id, admin.email);
      return json(request, { token, expiresIn: '7d', profile: { id: admin.id, email: admin.email, role: admin.role } });
    }

    if (path === '/api/cards' && request.method === 'GET') {
      return json(request, await loadCardsWithBusinesses({ theme: url.searchParams.get('theme') ?? '', status: 'active', city: url.searchParams.get('city') ?? '' }));
    }

    if (/^\/api\/cards\/[^/]+$/.test(path) && request.method === 'GET') {
      const id = path.split('/').pop()!;
      const cards = await dbQuery('SELECT * FROM cards WHERE id = $1 LIMIT 1', [id]);
      if (cards.length === 0) return json(request, { error: 'Card not found' }, { status: 404 });
      const vendors = await dbQuery(`SELECT v.id, v.name, v.city, d.* FROM card_vendors cv JOIN vendors v ON v.id = cv.vendor_id LEFT JOIN discounts d ON d.card_id = cv.card_id AND d.vendor_id = cv.vendor_id WHERE cv.card_id = $1`, [id]);
      return json(request, { ...(cards[0] as Record<string, unknown>), participatingBusinesses: vendors });
    }

    // Public, customer-facing directory of participating businesses for the
    // mobile app. Every vendor's exclusive discount hangs off the single
    // membership card; the member unlocks them all with their own membership
    // pass, so no per-vendor wallet URL or raw discount code is exposed here.
    if ((path === '/api/vendors' || /^\/api\/vendors\/[^/]+$/.test(path)) && request.method === 'GET') {
      const single = path !== '/api/vendors';
      const vendorId = single ? path.split('/').pop()! : null;
      const rows = await dbQuery<{
        id: string;
        name: string;
        address: string | null;
        city: string | null;
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
        discount_description: string | null;
        discount_terms: string | null;
        starts_at: string | null;
        ends_at: string | null;
        boosted: boolean;
        card_icon: string | null;
        card_logo: string | null;
      }>(
        `SELECT v.id, v.name, v.address, v.city, v.location, v.category, v.latitude, v.longitude, v.pos_system, v.icon_url, v.logo_url, v.discount_terms,
                c.id AS card_id, d.type AS discount_type, d.value AS discount_value, d.discount_code, d.description AS discount_description,
                d.starts_at, d.ends_at, d.boosted, c.icon_url AS card_icon, c.logo_url AS card_logo
         FROM vendors v
         JOIN cards c ON c.is_membership = true AND c.status = 'active'
         JOIN discounts d ON d.vendor_id = v.id AND d.card_id = c.id AND d.active = true
         WHERE v.status = 'approved'
           AND ($1::uuid IS NULL OR v.id = $1::uuid)
           AND (d.starts_at IS NULL OR d.starts_at <= now())
           AND (d.ends_at IS NULL OR d.ends_at >= now())
         ORDER BY CASE WHEN d.boosted THEN 0 ELSE 1 END, v.name`,
        [vendorId],
      );
      const items = rows.map((row) => ({
        id: row.id,
        name: row.name,
        address: row.address ?? row.location,
        city: row.city,
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
        discountDescription: row.discount_description,
        discountTerms: row.discount_terms ?? 'Cannot be applied with any other offer\nNot redeemable for cash\nCan be used 1 time per week',
        discountCode: row.discount_code,
        boosted: row.boosted,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        cardId: row.card_id,
        walletUrl: null,
      }));
      if (single) {
        if (items.length === 0) return json(request, { error: 'Vendor not found' }, { status: 404 });
        return json(request, items[0]);
      }
      return json(request, items);
    }

    // Public customer-facing event tickets. Active tickets appear in the app automatically.
    if (path === '/api/tickets' && request.method === 'GET') {
      const claims = authenticate(request);
      const userId = claims?.role === 'customer' ? claims.sub : null;
      await withDbClient(async (client) => {
        await client.query('BEGIN');
        try {
          const due = await client.query<{ id: string }>("SELECT id FROM tickets WHERE drawing_status = 'open' AND drawing_deadline <= now() FOR UPDATE SKIP LOCKED");
          for (const row of due.rows) {
            const winner = await client.query<{ user_id: string }>(
              `WITH weights AS (
                 SELECT user_id, SUM(requested_count)::int AS weight
                 FROM ticket_entries
                 WHERE ticket_id = $1
                 GROUP BY user_id
               )
               SELECT user_id
               FROM weights
               ORDER BY random() * weight DESC
               LIMIT 1`,
              [row.id],
            );
            if (winner.rows[0]) {
              await client.query("UPDATE tickets SET user_id = $1, drawing_status = 'drawn', updated_at = now() WHERE id = $2", [winner.rows[0].user_id, row.id]);
            } else {
              await client.query("UPDATE tickets SET drawing_status = 'drawn', updated_at = now() WHERE id = $1", [row.id]);
            }
          }
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      });
      const rows = await dbQuery(
        `
          SELECT t.id, t.name, t.barcode, t.barcode_format, t.allowed_uses, t.used_uses, t.available_count, t.status,
                 t.drawing_deadline, t.drawing_status, t.user_id, t.created_at,
                 CASE WHEN t.user_id = $1::uuid THEN t.barcodes ELSE '[]'::jsonb END AS barcodes,
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
      return json(request, rows.map((row) => ({
        id: row.id,
        name: row.name,
        barcode: row.barcode,
        barcodeFormat: row.barcode_format,
        allowedUses: row.allowed_uses,
        usedUses: row.used_uses,
        remainingUses: Math.max(0, Number(row.allowed_uses) - Number(row.used_uses)),
        availableCount: row.available_count ?? 4,
        barcodes: Array.isArray(row.barcodes) ? row.barcodes : [],
        status: row.status,
        drawingDeadline: row.drawing_deadline,
        drawingStatus: row.drawing_status,
        entryCount: Number(row.entry_count ?? 0),
        userId: row.user_id,
        createdAt: row.created_at,
      })));
    }

    if (/^\/api\/tickets\/[^/]+$/.test(path) && request.method === 'GET') {
      const id = path.split('/').pop()!;
      const rows = await dbQuery('SELECT id, name, barcode, barcode_format, allowed_uses, used_uses, available_count, status, drawing_deadline, drawing_status, created_at, barcodes FROM tickets WHERE id = $1 LIMIT 1', [id]);
      if (rows.length === 0) return json(request, { error: 'Ticket not found' }, { status: 404 });
      const row = rows[0];
      return json(request, {
        id: row.id,
        name: row.name,
        barcode: row.barcode,
        barcodeFormat: row.barcode_format,
        allowedUses: row.allowed_uses,
        usedUses: row.used_uses,
        remainingUses: Math.max(0, Number(row.allowed_uses) - Number(row.used_uses)),
        availableCount: row.available_count ?? 4,
        barcodes: [],
        status: row.status,
        drawingDeadline: row.drawing_deadline,
        drawingStatus: row.drawing_status,
        createdAt: row.created_at,
      });
    }

    // Enter a random drawing: choose a ticket and request 1-4 entries.
    if (path === '/api/tickets/enter' && request.method === 'POST') {
      const claims = requireRole(request, ['customer']);
      if (claims instanceof Response) return claims;
      const userId = claims.sub;
      const body = ticketEntrySchema.parse(await readJsonBody(request, {}));
      const tickets = await dbQuery<{ id: string; drawing_status: string; drawing_deadline: string | null; available_count: number }>(
        'SELECT id, drawing_status, drawing_deadline, available_count FROM tickets WHERE id = $1 AND status = $2 LIMIT 1',
        [body.ticketId, 'active'],
      );
      const ticket = tickets[0];
      if (!ticket) return json(request, { error: 'Ticket not found' }, { status: 404 });
      if (ticket.drawing_status !== 'open') return json(request, { error: 'This drawing has already closed' }, { status: 409 });
      if (ticket.drawing_deadline && new Date(ticket.drawing_deadline).getTime() <= Date.now()) return json(request, { error: 'This drawing has already closed' }, { status: 409 });

      const availableCount = Math.max(1, Number(ticket.available_count) || 4);
      const maxRequestCount = Math.min(4, availableCount);
      if (body.requestedCount > maxRequestCount) {
        return json(request, { error: `You can request up to ${maxRequestCount} ticket${maxRequestCount === 1 ? '' : 's'} for this drawing` }, { status: 400 });
      }

      await dbQuery(
        `INSERT INTO ticket_entries (ticket_id, user_id, requested_count)
         VALUES ($1, $2, $3)
         ON CONFLICT (ticket_id, user_id)
         DO UPDATE SET requested_count = LEAST($4, ticket_entries.requested_count + EXCLUDED.requested_count), updated_at = now()`,
        [body.ticketId, userId, body.requestedCount, maxRequestCount],
      );
      return json(request, { success: true, ticketId: body.ticketId, requestedCount: body.requestedCount });
    }

    if (/^\/api\/tickets\/[^/]+$/.test(path) && request.method === 'POST') {
      const id = path.split('/').pop()!;
      const rows = await dbQuery(
        `UPDATE tickets
         SET used_uses = used_uses + 1,
             status = CASE WHEN used_uses + 1 >= allowed_uses THEN 'used' ELSE status END,
             updated_at = now()
         WHERE id = $1 AND status = 'active' AND used_uses < allowed_uses
         RETURNING id, name, barcode, barcode_format, allowed_uses, used_uses, available_count, status, drawing_deadline, drawing_status, created_at, barcodes`,
        [id],
      );
      if (rows.length === 0) return json(request, { error: 'Ticket unavailable or fully used' }, { status: 409 });
      const row = rows[0];
      return json(request, {
        id: row.id,
        name: row.name,
        barcode: row.barcode,
        barcodeFormat: row.barcode_format,
        allowedUses: row.allowed_uses,
        usedUses: row.used_uses,
        remainingUses: Math.max(0, Number(row.allowed_uses) - Number(row.used_uses)),
        availableCount: row.available_count ?? 4,
        barcodes: [],
        status: row.status,
        drawingDeadline: row.drawing_deadline,
        drawingStatus: row.drawing_status,
        createdAt: row.created_at,
      });
    }

    // Admin ticket management.
    if (path === '/api/admin/tickets' && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const rows = await dbQuery('SELECT id, name, barcode, barcode_format, allowed_uses, used_uses, available_count, barcodes, status, drawing_date, user_id, created_at FROM tickets ORDER BY created_at DESC', []);
      return json(request, rows.map((row) => ({
        id: row.id,
        name: row.name,
        barcode: row.barcode,
        barcodeFormat: row.barcode_format,
        allowedUses: row.allowed_uses,
        usedUses: row.used_uses,
        remainingUses: Math.max(0, Number(row.allowed_uses) - Number(row.used_uses)),
        availableCount: row.available_count ?? 4,
        barcodes: Array.isArray(row.barcodes) ? row.barcodes : [],
        status: row.status,
        drawingDate: row.drawing_date,
        userId: row.user_id,
        createdAt: row.created_at,
      })));
    }

    if (path === '/api/admin/tickets' && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const body = ticketCreateSchema.parse(await readJsonBody(request, {}));
      const drawingDate = body.drawingDate?.trim() || null;
      const rows = await dbQuery<{ id: string }>(
        `INSERT INTO tickets (barcode, barcode_format, name, allowed_uses, available_count, barcodes, drawing_deadline, drawing_date, user_id)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, COALESCE($7::timestamptz, ($8::date + interval '23 hours 59 minutes')::timestamptz, now() + interval '7 days'), $8, $9)
         RETURNING id`,
        [body.barcode, body.barcodeFormat ?? null, body.name, body.allowedUses, body.availableCount, JSON.stringify(body.barcodes), body.drawingDeadline ?? null, drawingDate, body.userId ?? null],
      );
      return json(request, { id: rows[0]!.id }, { status: 201 });
    }

    if (/^\/api\/admin\/tickets\/[^/]+$/.test(path) && request.method === 'PATCH') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const body = ticketUpdateSchema.parse(await readJsonBody(request, {}));
      const drawingDate = body.drawingDate === undefined ? null : (body.drawingDate?.trim() || null);
      const rows = await dbQuery(
        `UPDATE tickets
         SET name = COALESCE($2, name),
             barcode = COALESCE($3, barcode),
             barcode_format = COALESCE($4, barcode_format),
             allowed_uses = COALESCE($5, allowed_uses),
             available_count = COALESCE($12, available_count),
             barcodes = COALESCE($13::jsonb, barcodes),
             used_uses = COALESCE($6, used_uses),
             status = COALESCE($7, status),
             drawing_deadline = COALESCE($8::timestamptz, (CASE WHEN $10 = '' OR $10 IS NULL THEN NULL ELSE $10::date END + interval '23 hours 59 minutes')::timestamptz, drawing_deadline),
             drawing_status = COALESCE($9, drawing_status),
             drawing_date = CASE WHEN $10 = '' OR $10 IS NULL THEN NULL ELSE $10::date END,
             user_id = COALESCE($11, user_id),
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [id, body.name ?? null, body.barcode ?? null, body.barcodeFormat ?? null, body.allowedUses ?? null, body.usedUses ?? null, body.status ?? null, body.drawingDeadline === undefined ? null : body.drawingDeadline, body.drawingStatus ?? null, drawingDate, body.userId === undefined ? null : body.userId, body.availableCount ?? null, body.barcodes ? JSON.stringify(body.barcodes) : null],
      );
      if (rows.length === 0) return json(request, { error: 'Ticket not found' }, { status: 404 });
      const row = rows[0];
      return json(request, {
        id: row.id,
        name: row.name,
        barcode: row.barcode,
        barcodeFormat: row.barcode_format,
        allowedUses: row.allowed_uses,
        usedUses: row.used_uses,
        remainingUses: Math.max(0, Number(row.allowed_uses) - Number(row.used_uses)),
        availableCount: row.available_count ?? 4,
        barcodes: Array.isArray(row.barcodes) ? row.barcodes : [],
        status: row.status,
        drawingDate: row.drawing_date,
        userId: row.user_id,
        createdAt: row.created_at,
      });
    }

    if (/^\/api\/admin\/tickets\/[^/]+$/.test(path) && request.method === 'DELETE') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      return json(request, await dbQuery('DELETE FROM tickets WHERE id = $1 RETURNING id', [id]));
    }

    if (path === '/api/admin/cards' && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const q = queryObject(url);
      return json(request, await loadCardsWithBusinesses({ ...(q.theme ? { theme: q.theme } : {}), ...(q.status ? { status: q.status } : {}) }));
    }
    if (/^\/api\/admin\/cards\/[^/]+$/.test(path) && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const cards = await loadCardsWithBusinesses({ id });
      if (cards.length === 0) return json(request, { error: 'Card not found' }, { status: 404 });
      return json(request, cards[0]);
    }
    if (path === '/api/admin/analytics' && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const q = queryObject(url);
      return json(request, await getAdminAnalytics({ ...(q.from ? { from: q.from } : {}), ...(q.to ? { to: q.to } : {}), ...(q.city ? { city: q.city } : {}) }));
    }
    if (path === '/api/admin/settings' && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const rows = await dbQuery('SELECT id, email::text AS email, role, location FROM admins WHERE id = $1 LIMIT 1', [auth.sub]);
      if (!rows[0]) return json(request, { error: 'Not found' }, { status: 404 });
      return json(request, rows[0]);
    }
    if (path === '/api/admin/settings' && request.method === 'PATCH') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const body = adminSettingsSchema.parse(await readJsonBody(request, {}));
      const passwordHash = body.password ? await bcrypt.hash(body.password, 10) : null;
      const rows = await dbQuery(
        `UPDATE admins SET email = COALESCE($2, email), password_hash = COALESCE($3, password_hash), location = COALESCE($4, location), updated_at = now() WHERE id = $1 RETURNING id, email::text AS email, role, location`,
        [auth.sub, body.email ?? null, passwordHash, body.location ?? null],
      );
      return json(request, rows[0] ?? {});
    }
    if (path === '/api/admin/vendors' && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const q = queryObject(url);
      return json(request, await dbQuery(`SELECT v.*, d.type AS discount_type, d.value AS discount_value, d.discount_code, d.starts_at AS discount_starts_at, d.ends_at AS discount_ends_at, d.boosted AS discount_boosted FROM vendors v LEFT JOIN LATERAL (SELECT d.type, d.value, d.discount_code, d.starts_at, d.ends_at, d.boosted FROM discounts d JOIN cards c ON c.id = d.card_id AND c.is_membership = true WHERE d.vendor_id = v.id ORDER BY d.created_at DESC LIMIT 1) d ON true WHERE ($1::text IS NULL OR v.status = $1) AND ($2::text IS NULL OR v.city = $2) AND ($3::text IS NULL OR v.category = $3) ORDER BY v.created_at DESC`, [
        q.status ?? null,
        q.city ?? null,
        q.category ?? null,
      ]));
    }
    if (path === '/api/admin/vendors' && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const body = adminVendorCreateSchema.parse(await readJsonBody(request, {}));
      const result = await createVendorWithDiscount({
        name: body.name,
        ownerName: body.ownerName ?? null,
        address: body.address ?? null,
        category: body.category,
        email: body.email ?? null,
        phone: body.phone ?? null,
        discountType: body.discountType,
        discountValue: body.discountValue,
        discountDescription: body.discountDescription ?? null,
        discountTerms: body.discountTerms ?? null,
        discountStartsAt: body.discountStartsAt ?? null,
        discountEndsAt: body.discountEndsAt ?? null,
        boosted: body.boosted ?? false,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        iconDataUrl: body.iconDataUrl ?? null,
        logoDataUrl: body.logoDataUrl ?? null,
      });
      return json(request, result, { status: 201 });
    }
    if (/^\/api\/admin\/vendors\/[^/]+$/.test(path) && request.method === 'PATCH') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const body = adminVendorUpdateSchema.parse(await readJsonBody(request, {}));
      const rows = await dbQuery(
        `UPDATE vendors SET name = COALESCE($2, name), owner_name = COALESCE($3, owner_name), location = COALESCE($4, location), address = COALESCE($4, address), category = COALESCE($5, category), email = COALESCE($6, email), phone = COALESCE($7, phone), status = COALESCE($8, status), latitude = COALESCE($9, latitude), longitude = COALESCE($10, longitude), discount_terms = COALESCE($11, discount_terms), updated_at = now() WHERE id = $1 RETURNING *`,
        [id, body.name ?? null, body.ownerName ?? null, body.address ?? null, body.category ?? null, body.email ?? null, body.phone ?? null, body.status ?? null, body.latitude ?? null, body.longitude ?? null, body.discountTerms ?? null],
      );
      if (body.discountType !== undefined || body.discountValue !== undefined || body.discountDescription !== undefined || body.discountStartsAt !== undefined || body.discountEndsAt !== undefined || body.boosted !== undefined) {
        await dbQuery(
          `UPDATE discounts SET type = COALESCE($2, type), value = COALESCE($3, value), description = COALESCE($4, description), starts_at = COALESCE($5, starts_at), ends_at = COALESCE($6, ends_at), boosted = COALESCE($7, boosted), updated_at = now() WHERE vendor_id = $1 AND card_id = (SELECT id FROM cards WHERE is_membership = true LIMIT 1)`,
          [id, body.discountType ?? null, body.discountValue ?? null, body.discountDescription ?? null, body.discountStartsAt ?? null, body.discountEndsAt ?? null, body.boosted ?? null],
        );
      }
      return json(request, rows[0] ?? {});
    }
    // Returns a vendor's exclusive discount on the shared membership card. There
    // is no per-vendor wallet pass anymore — members carry one membership pass,
    // and the business applies this discount when they scan the member barcode.
    if (/^\/api\/admin\/vendors\/[^/]+\/pass$/.test(path) && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').slice(-2)[0]!;
      const rows = await dbQuery<{ card_id: string; card_name: string; discount_type: 'fixed' | 'percent' | 'bogo'; discount_value: string; discount_code: string | null; pos_system: string | null }>(
        `SELECT c.id AS card_id, c.name AS card_name, d.type AS discount_type, d.value AS discount_value, d.discount_code, v.pos_system
         FROM discounts d
         JOIN cards c ON c.id = d.card_id AND c.is_membership = true
         JOIN vendors v ON v.id = d.vendor_id
         WHERE d.vendor_id = $1 ORDER BY d.created_at DESC LIMIT 1`,
        [id],
      );
      const row = rows[0];
      if (!row) return json(request, { error: 'No discount for this vendor' }, { status: 404 });
      const label = humanDiscountLabel(row.discount_type, Number(row.discount_value));
      return json(request, {
        discountCode: row.discount_code,
        discount: { type: row.discount_type, value: Number(row.discount_value), label },
        membershipCard: { id: row.card_id, name: row.card_name },
        posInstructions: `Ask the customer to show their ${row.card_name} pass, scan its barcode, then apply code ${row.discount_code ?? '(none)'} in your POS${row.pos_system ? ` (${row.pos_system})` : ''}. No NFC required.`,
      });
    }
    if (/^\/api\/admin\/vendors\/[^/]+\/approve$/.test(path) && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').slice(-2)[0]!;
      return json(request, await dbQuery('UPDATE vendors SET status = \'approved\', updated_at = now() WHERE id = $1 RETURNING *', [id]));
    }
    if (/^\/api\/admin\/vendors\/[^/]+\/reject$/.test(path) && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').slice(-2)[0]!;
      return json(request, await dbQuery('UPDATE vendors SET status = \'rejected\', updated_at = now() WHERE id = $1 RETURNING *', [id]));
    }
    if (/^\/api\/admin\/vendors\/[^/]+\/activity$/.test(path) && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').slice(-2)[0]!;
      return json(request, await dbQuery('SELECT * FROM transactions WHERE entity_type = \'vendor\' AND entity_id = $1 ORDER BY created_at DESC', [id]));
    }
    if (/^\/api\/admin\/vendors\/[^/]+\/analytics$/.test(path) && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').slice(-2)[0]!;
      const exists = await dbQuery<{ id: string }>('SELECT id FROM vendors WHERE id = $1 LIMIT 1', [id]);
      if (exists.length === 0) return json(request, { error: 'Vendor not found' }, { status: 404 });
      return json(request, await getVendorAnalytics(id));
    }
    if (/^\/api\/admin\/vendors\/[^/]+\/qr$/.test(path) && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').slice(-2)[0]!;
      const result = await withDbClient(async (client) => {
        const vendorRows = await client.query('SELECT id, name FROM vendors WHERE id = $1', [id]);
        if (vendorRows.rows.length === 0) return null;
        const vendor = vendorRows.rows[0] as { id: string; name: string };

        const membershipRows = await client.query('SELECT id, name FROM cards WHERE is_membership = true LIMIT 1');
        if (membershipRows.rows.length === 0) return null;
        const cardId = (membershipRows.rows[0] as { id: string }).id;

        const existing = await client.query(
          'SELECT id, type, value FROM discounts WHERE vendor_id = $1 AND card_id = $2 LIMIT 1',
          [id, cardId],
        );

        let discountId: string;
        let type: 'fixed' | 'percent' | 'bogo';
        let value: number;
        if (existing.rows.length > 0) {
          const row = existing.rows[0] as { id: string; type: 'fixed' | 'percent' | 'bogo'; value: string };
          discountId = row.id;
          type = row.type;
          value = Number(row.value);
        } else {
          type = 'percent';
          value = 10;
          const label = humanDiscountLabel(type, value);
          const discountCode = generateDiscountCode({ merchantId: vendor.name, type, value });
          const inserted = await client.query(
            'INSERT INTO discounts (card_id, vendor_id, type, value, discount_code, description, active) VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id',
            [cardId, id, type, value, discountCode, `${label} member discount`],
          );
          discountId = (inserted.rows[0] as { id: string }).id;
          await client.query('INSERT INTO card_vendors (card_id, vendor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [cardId, id]);
        }

        const newCode = generateDiscountCode({ merchantId: vendor.name, type, value });
        await client.query('UPDATE discounts SET discount_code = $2, updated_at = now() WHERE id = $1', [discountId, newCode]);
        return { discountCode: newCode, qrUrl: qrCodeUrl(newCode, 300) };
      });

      if (!result) return json(request, { error: 'Vendor or membership card not found' }, { status: 404 });
      return json(request, result);
    }
    if (path === '/api/admin/cards' && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const body = cardSchema.parse(await readJsonBody(request, {}));
      const rows = await dbQuery<{ id: string }>(`INSERT INTO cards (name, theme, description, image_url, logo_url, icon_url, primary_color, secondary_color, qr_size, layout, expiration_date, max_uses, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`, [
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
      ]);
      return json(request, { id: rows[0]!.id }, { status: 201 });
    }
    if (/^\/api\/admin\/cards\/[^/]+$/.test(path) && request.method === 'PATCH') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const body = cardSchema.partial().parse(await readJsonBody(request, {}));
      const rows = await dbQuery(
        `UPDATE cards SET name = COALESCE($2, name), theme = COALESCE($3, theme), description = COALESCE($4, description), image_url = COALESCE($5, image_url), logo_url = COALESCE($6, logo_url), icon_url = COALESCE($7, icon_url), primary_color = COALESCE($8, primary_color), secondary_color = COALESCE($9, secondary_color), qr_size = COALESCE($10, qr_size), layout = COALESCE($11, layout), expiration_date = COALESCE($12, expiration_date), max_uses = COALESCE($13, max_uses), status = COALESCE($14, status), updated_at = now() WHERE id = $1 RETURNING *`,
        [id, body.name ?? null, body.theme ?? null, body.description ?? null, body.imageUrl ?? null, body.logoUrl ?? null, body.iconUrl ?? null, body.primaryColor ?? null, body.secondaryColor ?? null, body.qrSize ?? null, body.layout ?? null, body.expirationDate ?? null, body.maxUses ?? null, body.status ?? null],
      );
      return json(request, rows[0] ?? {});
    }
    if (/^\/api\/admin\/cards\/[^/]+$/.test(path) && request.method === 'DELETE') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      return json(request, await dbQuery('DELETE FROM cards WHERE id = $1 RETURNING id', [id]));
    }
    if (/^\/api\/admin\/cards\/[^/]+\/vendors$/.test(path) && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').slice(-2)[0]!;
      const body = z.object({ vendorId: z.string().uuid() }).parse(await readJsonBody(request, {}));
      return json(request, await dbQuery('INSERT INTO card_vendors (card_id, vendor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *', [id, body.vendorId]));
    }
    if (/^\/api\/admin\/cards\/[^/]+\/vendors\/[^/]+$/.test(path) && request.method === 'DELETE') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const parts = path.split('/');
      return json(request, await dbQuery('DELETE FROM card_vendors WHERE card_id = $1 AND vendor_id = $2 RETURNING *', [parts[4], parts[6]]));
    }
    if (path === '/api/admin/discounts' && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const body = discountSchema.parse(await readJsonBody(request, {}));
      const rows = await dbQuery<{ id: string }>(
        `INSERT INTO discounts (card_id, vendor_id, type, value, min_purchase, max_uses_total, max_uses_per_customer, city_overrides, active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9) RETURNING id`,
        [body.cardId, body.vendorId, body.type, body.value, body.minPurchase, body.maxUsesTotal ?? null, body.maxUsesPerCustomer ?? null, JSON.stringify(body.cityOverrides), body.active],
      );
      return json(request, { id: rows[0]!.id }, { status: 201 });
    }
    if (/^\/api\/admin\/discounts\/[^/]+$/.test(path) && request.method === 'PATCH') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const body = discountSchema.partial().parse(await readJsonBody(request, {}));
      const rows = await dbQuery(
        `UPDATE discounts SET card_id = COALESCE($2, card_id), vendor_id = COALESCE($3, vendor_id), type = COALESCE($4, type), value = COALESCE($5, value), min_purchase = COALESCE($6, min_purchase), max_uses_total = COALESCE($7, max_uses_total), max_uses_per_customer = COALESCE($8, max_uses_per_customer), city_overrides = COALESCE($9::jsonb, city_overrides), active = COALESCE($10, active), updated_at = now() WHERE id = $1 RETURNING *`,
        [id, body.cardId ?? null, body.vendorId ?? null, body.type ?? null, body.value ?? null, body.minPurchase ?? null, body.maxUsesTotal ?? null, body.maxUsesPerCustomer ?? null, body.cityOverrides ? JSON.stringify(body.cityOverrides) : null, body.active ?? null],
      );
      return json(request, rows[0] ?? {});
    }
    if (/^\/api\/admin\/discounts\/[^/]+$/.test(path) && request.method === 'DELETE') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      return json(request, await dbQuery('DELETE FROM discounts WHERE id = $1 RETURNING id', [id]));
    }

    // ---- CMS content + theme ------------------------------------------------
    // Public: published content blocks rendered in the app's Discover feed.
    if (path === '/api/content' && request.method === 'GET') {
      return json(request, await listContentBlocks({ publishedOnly: true }));
    }
    // Public: shared theme (blue/red/green bottom-tab styling) for app + admin.
    if (path === '/api/settings/theme' && request.method === 'GET') {
      return json(request, await getTheme());
    }
    if (path === '/api/admin/content' && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      return json(request, await listContentBlocks({ publishedOnly: false }));
    }
    if (path === '/api/admin/content' && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const body = contentCreateSchema.parse(await readJsonBody(request, {}));
      return json(request, await createContentBlock(body), { status: 201 });
    }
    if (/^\/api\/admin\/content\/[^/]+$/.test(path) && request.method === 'PATCH') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const body = contentUpdateSchema.parse(await readJsonBody(request, {}));
      const updated = await updateContentBlock(id, body);
      if (!updated) return json(request, { error: 'Content not found' }, { status: 404 });
      return json(request, updated);
    }
    if (/^\/api\/admin\/content\/[^/]+$/.test(path) && request.method === 'DELETE') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      return json(request, { deleted: await deleteContentBlock(id) });
    }
    if (path === '/api/admin/settings/theme' && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      return json(request, await getTheme());
    }
    if (path === '/api/admin/settings/theme' && request.method === 'PATCH') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const body = themeSchema.parse(await readJsonBody(request, {}));
      return json(request, await saveTheme(body));
    }

    // ---- Events RSS feed ----------------------------------------------------
    // Public: parsed RSS feed items shown on the Events tab.
    if (path === '/api/events' && request.method === 'GET') {
      return json(request, await fetchPublicEvents());
    }
    // Admin: manage the RSS feed URLs and manually added events that power the Events tab.
    if (path === '/api/admin/events' && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      return json(request, { urls: await getEventsRssUrls(), events: await listAdminEvents() });
    }
    if (path === '/api/admin/events' && request.method === 'PATCH') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const body = request.body ? (await readJsonBody(request, {})) as { urls?: unknown } : { urls: [] };
      const urls = Array.isArray(body.urls)
        ? body.urls.filter((url): url is string => typeof url === 'string' && url.length > 0)
        : [];
      return json(request, { urls: await saveEventsRssUrls(urls) });
    }
    if (path === '/api/admin/events/custom' && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const body = adminEventSchema.parse(await readJsonBody(request, {}));
      return json(request, await createAdminEvent(body), { status: 201 });
    }
    if (/^\/api\/admin\/events\/custom\/[^/]+$/.test(path) && request.method === 'PATCH') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const body = adminEventSchema.partial().parse(await readJsonBody(request, {}));
      const updated = await updateAdminEvent(id, body);
      if (!updated) return json(request, { error: 'Event not found' }, { status: 404 });
      return json(request, updated);
    }
    if (/^\/api\/admin\/events\/custom\/[^/]+$/.test(path) && request.method === 'DELETE') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const deleted = await deleteAdminEvent(id);
      return json(request, {}, { status: deleted ? 204 : 404 });
    }

    // Resolves a membership pass to its wallet download. 302-redirects to the
    // Passcreator-hosted pass (Apple Wallet / Google Wallet) so the link stays
    // valid even if the underlying hosted URL changes.
    if (/^\/api\/passes\/[^/]+\/pkpass$/.test(path) && request.method === 'GET') {
      const serial = path.split('/').slice(-2)[0]!;
      const rows = await dbQuery<{ user_id: string; passcreator_iphone_uri: string | null; passcreator_url: string | null }>(
        `SELECT user_id, passcreator_iphone_uri, passcreator_url FROM passes WHERE serial_number = $1 LIMIT 1`,
        [serial],
      );
      const row = rows[0];
      if (!row) return json(request, { error: 'Pass not found' }, { status: 404 });
      let target = row.passcreator_iphone_uri || row.passcreator_url;
      if (!target) {
        const pass = await ensureMembershipPass(row.user_id);
        target = membershipWalletUrl(pass);
      }
      if (!target) return json(request, { error: 'Apple Wallet pass generation is not configured' }, { status: 503 });
      return new Response(null, { status: 302, headers: { Location: target, 'Access-Control-Allow-Origin': corsOrigin(request) } });
    }

    // The current member's single all-in-one membership pass (auto-created).
    if (path === '/api/me/pass' && (request.method === 'GET' || request.method === 'POST')) {
      const auth = requireRole(request, ['customer']);
      if (auth instanceof Response) return auth;
      const body = request.method === 'POST' ? z.object({ platform: z.enum(['apple', 'google']).optional() }).parse(await readJsonBody(request, {})) : {};
      const pass = await ensureMembershipPass(auth.sub, body.platform ? { platform: body.platform } : {});
      return json(request, {
        pass: { passId: pass.id, serialNumber: pass.serial_number, lookupToken: pass.lookup_token, barcodeValue: pass.barcode_value ?? pass.lookup_token, cardId: pass.card_id },
        walletUrl: membershipWalletUrl(pass),
        androidUrl: pass.passcreator_android_uri ?? null,
        passUrl: buildMemberPassUrl(baseUrl, pass.serial_number),
        downloadUrl: `/api/passes/${pass.serial_number}`,
      });
    }
    if (path === '/api/me/analytics' && request.method === 'GET') {
      const auth = requireRole(request, ['customer']);
      if (auth instanceof Response) return auth;
      const totalRows = await dbQuery<{ redemptions: string }>('SELECT COUNT(*)::text AS redemptions FROM redemptions WHERE user_id = $1', [auth.sub]);
      const vendorRows = await dbQuery<{ vendor_id: string; vendor_name: string; redemptions: string }>(
        `SELECT v.id AS vendor_id, v.name AS vendor_name, COUNT(r.id)::text AS redemptions
         FROM redemptions r
         JOIN vendors v ON v.id = r.vendor_id
         WHERE r.user_id = $1
         GROUP BY v.id, v.name
         ORDER BY COUNT(r.id) DESC`,
        [auth.sub],
      );
      const recentRows = await dbQuery<{ day: string; redemptions: string }>(
        `SELECT to_char(date_trunc('day', redeemed_at), 'YYYY-MM-DD') AS day, COUNT(*)::text AS redemptions
         FROM redemptions
         WHERE user_id = $1 AND redeemed_at >= now() - interval '30 days'
         GROUP BY 1
         ORDER BY 1 DESC`,
        [auth.sub],
      );
      return json(request, {
        totalRedemptions: Number(totalRows[0]?.redemptions ?? '0'),
        byVendor: vendorRows.map((row) => ({ vendorId: row.vendor_id, vendorName: row.vendor_name, redemptions: Number(row.redemptions) })),
        daily: recentRows.map((row) => ({ day: row.day, redemptions: Number(row.redemptions) })),
      });
    }
    if (path === '/api/me' && request.method === 'GET') {
      const auth = requireRole(request, ['customer']);
      if (auth instanceof Response) return auth;
      const profile = await buildCustomerProfile(auth.sub);
      if (!profile) return json(request, { error: 'User not found' }, { status: 404 });
      return json(request, profile);
    }
    if (path === '/api/me' && request.method === 'PATCH') {
      const auth = requireRole(request, ['customer']);
      if (auth instanceof Response) return auth;
      const body = z.object({
        city: z.string().trim().min(1).optional(),
        promoEmailOptIn: z.boolean().optional(),
        promoSmsOptIn: z.boolean().optional(),
        pushPreferences: z.object({
          newVendor: z.boolean().optional(),
          expiringDeal: z.boolean().optional(),
          localEvent: z.boolean().optional(),
        }).optional(),
      }).parse(await readJsonBody(request, {}));
      const rows = await dbQuery<{
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
        promo_email_opt_in: boolean;
        promo_sms_opt_in: boolean;
        terms_accepted_at: string | null;
        privacy_accepted_at: string | null;
        eula_accepted_at: string | null;
      }>(
        `UPDATE users
         SET city = COALESCE($2, city),
             promo_email_opt_in = COALESCE($3, promo_email_opt_in),
             promo_sms_opt_in = COALESCE($4, promo_sms_opt_in),
             push_enabled_new_vendor = COALESCE($5, push_enabled_new_vendor),
             push_enabled_expiring_deal = COALESCE($6, push_enabled_expiring_deal),
             push_enabled_local_event = COALESCE($7, push_enabled_local_event),
             updated_at = now()
         WHERE id = $1
         RETURNING id, email::text AS email, phone, full_name, first_name, last_name, city, status,
                   push_enabled_new_vendor, push_enabled_expiring_deal, push_enabled_local_event,
                   promo_email_opt_in, promo_sms_opt_in,
                   terms_accepted_at, privacy_accepted_at, eula_accepted_at`,
        [auth.sub, body.city ?? null, body.promoEmailOptIn ?? null, body.promoSmsOptIn ?? null, body.pushPreferences?.newVendor ?? null, body.pushPreferences?.expiringDeal ?? null, body.pushPreferences?.localEvent ?? null],
      );
      const user = rows[0];
      if (!user) return json(request, { error: 'User not found' }, { status: 404 });
      return json(request, {
        id: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.full_name,
        firstName: user.first_name,
        lastName: user.last_name,
        city: user.city,
        status: user.status,
        promoEmailOptIn: user.promo_email_opt_in,
        promoSmsOptIn: user.promo_sms_opt_in,
        termsAcceptedAt: user.terms_accepted_at,
        privacyAcceptedAt: user.privacy_accepted_at,
        eulaAcceptedAt: user.eula_accepted_at,
        pushPreferences: {
          newVendor: user.push_enabled_new_vendor,
          expiringDeal: user.push_enabled_expiring_deal,
          localEvent: user.push_enabled_local_event,
        },
      });
    }
    if (path === '/api/me' && request.method === 'DELETE') {
      const auth = requireRole(request, ['customer']);
      if (auth instanceof Response) return auth;
      await dbQuery('DELETE FROM users WHERE id = $1', [auth.sub]);
      return json(request, { deleted: true });
    }
    if (path === '/api/me/push-token' && request.method === 'POST') {
      const auth = requireRole(request, ['customer']);
      if (auth instanceof Response) return auth;
      const body = pushTokenSchema.parse(await readJsonBody(request, {}));
      await savePushToken(auth.sub, body.token, body.city);
      return json(request, { registered: true });
    }

    // Backwards-compatible create endpoint: always returns the member's single
    // membership pass (idempotent). Any supplied cardId is ignored.
    if (path === '/api/passes' && request.method === 'POST') {
      const auth = requireRole(request, ['customer']);
      if (auth instanceof Response) return auth;
      const body = z.object({ platform: z.enum(['apple', 'google']).optional(), cardId: z.string().uuid().optional() }).parse(await readJsonBody(request, {}));
      const pass = await ensureMembershipPass(auth.sub, body.platform ? { platform: body.platform } : {});
      return json(request, {
        pass: { passId: pass.id, serialNumber: pass.serial_number, lookupToken: pass.lookup_token, barcodeValue: pass.barcode_value ?? pass.lookup_token, cardId: pass.card_id },
        walletUrl: membershipWalletUrl(pass),
        androidUrl: pass.passcreator_android_uri ?? null,
        passUrl: buildMemberPassUrl(baseUrl, pass.serial_number),
        downloadUrl: `/api/passes/${pass.serial_number}`,
      }, { status: 201 });
    }
    if (/^\/api\/passes\/[^/]+$/.test(path) && request.method === 'GET') {
      const serial = path.split('/').pop()!;
      const rows = await dbQuery(`SELECT p.*, c.name AS card_name, c.description AS card_description FROM passes p JOIN cards c ON c.id = p.card_id WHERE p.serial_number = $1 LIMIT 1`, [serial]);
      if (rows.length === 0) return json(request, { error: 'Pass not found' }, { status: 404 });
      return json(request, rows[0]);
    }
    if (/^\/api\/passes\/[^/]+\/registrations\/[^/]+$/.test(path) && request.method === 'POST') {
      const parts = path.split('/');
      const serial = parts[3]!;
      const deviceLibraryId = parts[5]!;
      const body = z.object({ pushToken: z.string().optional() }).parse(await readJsonBody(request, {}));
      await dbQuery('UPDATE passes SET device_library_id = $2, push_token = COALESCE($3, push_token), updated_at = now() WHERE serial_number = $1', [serial, deviceLibraryId, body.pushToken ?? null]);
      return json(request, { registered: true });
    }
    if (/^\/api\/passes\/[^/]+\/registrations\/[^/]+$/.test(path) && request.method === 'DELETE') {
      const parts = path.split('/');
      const serial = parts[3]!;
      const deviceLibraryId = parts[5]!;
      await dbQuery('UPDATE passes SET device_library_id = NULL, push_token = NULL, updated_at = now() WHERE serial_number = $1 AND device_library_id = $2', [serial, deviceLibraryId]);
      return json(request, { deleted: true });
    }

    if (/^\/api\/lookup\/[^/]+$/.test(path) && request.method === 'GET') {
      const lookupToken = path.split('/').pop()!;
      const result = await resolvePassLookup(lookupToken, url.searchParams.get('vendorId') ?? undefined, url.searchParams.get('city') ?? undefined);
      if (!result) return json(request, { error: 'Not found' }, { status: 404 });
      return json(request, result);
    }
    if (path === '/api/discounts/lookup' && request.method === 'GET') {
      const token = url.searchParams.get('token') ?? '';
      if (!token) return json(request, { error: 'token is required' }, { status: 400 });
      const result = await resolvePassLookup(token, undefined, url.searchParams.get('city') ?? undefined);
      if (!result) return json(request, { error: 'Not found' }, { status: 404 });
      return json(request, result);
    }
    if (/^\/api\/discounts\/by-code\/[^/]+$/.test(path) && request.method === 'GET') {
      const auth = requireRole(request, ['customer']);
      if (auth instanceof Response) return auth;
      const code = path.split('/').pop()!;
      const userId = auth.sub;
      const result = await redeemDiscount({
        discountCode: code,
        userId,
        actorType: 'customer',
        actorId: userId,
        ip: getIp(request),
      });
      if (!result.valid) return json(request, { error: result.reason ?? 'Unable to redeem this discount' }, { status: 409 });
      const rows = await dbQuery<{ vendor_name: string; card_name: string; type: 'fixed' | 'percent' | 'bogo'; value: string }>(
        `SELECT v.name AS vendor_name, c.name AS card_name, d.type, d.value
         FROM discounts d
         JOIN vendors v ON v.id = d.vendor_id
         JOIN cards c ON c.id = d.card_id
         WHERE d.discount_code = $1 AND d.active = true AND c.is_membership = true
         LIMIT 1`,
        [code],
      );
      const row = rows[0];
      return json(request, {
        vendorName: row?.vendor_name ?? 'Vendor',
        cardName: row?.card_name ?? 'Membership',
        discountCode: code,
        type: row?.type ?? 'fixed',
        value: Number(row?.value ?? 0),
        discountLabel: humanDiscountLabel(row?.type ?? 'fixed', Number(row?.value ?? 0)),
      });
    }
    if (/^\/api\/lookup\/card\/[^/]+$/.test(path) && request.method === 'GET') {
      const cardId = path.split('/').pop()!;
      const result = await resolveCardLookup(cardId, url.searchParams.get('vendorId') ?? undefined, url.searchParams.get('city') ?? undefined);
      if (!result) return json(request, { error: 'Not found' }, { status: 404 });
      return json(request, result);
    }
    if (path === '/api/redeem' && request.method === 'POST') {
      const auth = authenticate(request);
      const body = z
        .object({
          lookupToken: z.string().optional(),
          cardId: z.string().uuid().optional(),
          userId: z.string().uuid().optional(),
          vendorId: z.string().uuid().optional(),
          discountCode: z.string().optional(),
          discountId: z.string().uuid().optional(),
          city: z.string().optional(),
          purchaseAmount: z.number().optional(),
          giftCardId: z.string().uuid().optional(),
        })
        .parse(await readJsonBody(request, {}));
      const result = await redeemDiscount({ ...body, actorType: auth?.role ?? 'system', actorId: auth?.sub ?? null, ip: getIp(request) });
      return json(request, result);
    }

    if (/^\/api\/onboarding\/[^/]+$/.test(path) && request.method === 'GET') {
      const code = path.split('/').pop()!;
      const decoded = decodeBase64UrlJson<{ vendorId?: string; cardId?: string }>(code);
      if (!decoded?.vendorId || !decoded?.cardId) return json(request, { error: 'Invalid onboarding code' }, { status: 404 });
      const rows = await dbQuery(`SELECT c.id AS card_id, c.theme, c.name AS card_name, v.id AS vendor_id, v.name AS vendor_name FROM cards c JOIN vendors v ON v.id = $1 WHERE c.id = $2 LIMIT 1`, [
        decoded.vendorId,
        decoded.cardId,
      ]);
      if (rows.length === 0) return json(request, { error: 'Not found' }, { status: 404 });
      return json(request, { theme: rows[0]!.theme, card: rows[0]!.card_name, vendor: rows[0]!.vendor_name, appStoreUrl: config.appStoreUrl, playStoreUrl: config.playStoreUrl });
    }
    if (path === '/api/qr/onboarding.png' && request.method === 'GET') {
      const vendorId = url.searchParams.get('vendorId') ?? '';
      const cardId = url.searchParams.get('cardId') ?? '';
      if (!vendorId || !cardId) return json(request, { error: 'vendorId and cardId are required' }, { status: 400 });
      const code = encodeBase64UrlJson({ vendorId, cardId });
      const deepLink = `lrcard://onboard?code=${encodeURIComponent(code)}`;
      const text = `${deepLink}\nhttps://lightraildeals.com/onboard?code=${encodeURIComponent(code)}`;
      return Response.redirect(qrCodeUrl(text, 300), 302);
    }
    if (/^\/api\/qr\/lookup\/[^/]+\.png$/.test(path) && request.method === 'GET') {
      const lookupToken = path.split('/').pop()!.replace(/\.png$/, '');
      return Response.redirect(qrCodeUrl(lookupToken, 300), 302);
    }

    if (path === '/api/discounts/tokens' && request.method === 'POST') {
      const auth = requireRole(request, ['customer']);
      if (auth instanceof Response) return auth;
      const body = z.object({ vendorId: z.string().uuid() }).parse(await readJsonBody(request, {}));
      const fallbackBase = `${url.origin}/functions/v1/router`;
      const payload = await withDbClient((client) => createRedemptionToken(client, auth.sub, body.vendorId, fallbackBase));
      return json(request, payload);
    }
    if (/^\/api\/discounts\/tokens\/[^/]+\/affirm$/.test(path) && request.method === 'POST') {
      const auth = requireRole(request, ['customer']);
      if (auth instanceof Response) return auth;
      const token = path.split('/').slice(-2)[0]!;
      const body = z.object({ affirmationName: z.string().min(1) }).parse(await readJsonBody(request, {}));
      const result = await affirmRedemptionToken(token, auth.sub, body.affirmationName, getIp(request));
      if (!result.ok) {
        return json(request, { error: result.error ?? 'Unable to apply discount' }, { status: 409 });
      }
      return json(request, {
        ok: true,
        discountLabel: result.discount?.description ?? humanDiscountLabel(result.discount?.type ?? 'fixed', result.discount?.value ?? 0),
        amountApplied: result.amountApplied,
        redemptionId: result.redemptionId,
      });
    }

    if (/^\/(?:api\/)?redeem\/[^/]+$/.test(path) && request.method === 'GET') {
      const token = path.split('/').pop()!;
      const result = await redeemByToken(token, getIp(request));
      const html = renderRedemptionPage(result);
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (path === '/api/admin/marketing/blast' && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const body = z.object({
        subject: z.string().min(1),
        text: z.string().min(1),
        html: z.string().optional(),
        smsText: z.string().optional(),
      }).parse(await readJsonBody(request, {}));
      const recipients = await dbQuery<{ email: string | null; phone: string | null; promo_email_opt_in: boolean; promo_sms_opt_in: boolean }>(
        `SELECT email::text AS email, phone, promo_email_opt_in, promo_sms_opt_in
         FROM users
         WHERE status = 'active' AND (promo_email_opt_in = true OR promo_sms_opt_in = true)`,
      );
      const result = await sendDealOfTheDayBlast({
        ...body,
        recipients: recipients.map((r) => ({
          email: r.email,
          phone: r.phone,
          promoEmailOptIn: r.promo_email_opt_in,
          promoSmsOptIn: r.promo_sms_opt_in,
        })),
      });
      return json(request, result);
    }

    return notFound(request);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json(request, { error: 'Validation error', issues: error.issues }, { status: 400 });
    }
    return json(request, { error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
});
