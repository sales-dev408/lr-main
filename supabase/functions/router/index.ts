import { z } from 'npm:zod';
import bcrypt from 'npm:bcryptjs';
import { config } from './lib/config.ts';
import { authenticate, requireRole } from './lib/auth.ts';
import { dbQuery, restQuery, withDbClient } from './lib/db.ts';
import { getAdminAnalytics, getVendorAnalytics } from './lib/analytics.ts';
import { buildLookupDiscountView } from './lib/discounts.ts';
import { redeemDiscount } from './lib/redeem.ts';
import { createVendorWithDiscount, getAdminVendorById, getVendorDirectory, inferCuisine, inferVendorType } from './lib/vendors.ts';
import { generateDiscountCode, humanDiscountLabel } from './lib/codes.ts';
import { qrCodeUrl } from './lib/quickchart.ts';
import { createRedemptionToken, redeemByToken, affirmRedemptionToken } from './lib/redemptionTokens.ts';
import type { DiscountRule } from './lib/types.ts';
import {
  createContentBlock,
  deleteContentBlock,
  getContentBlock,
  getContentStatus,
  getContentVersion,
  getPublishedContent,
  getTheme,
  listContentBlocks,
  publishContent,
  saveTheme,
  updateContentBlock,
} from './lib/content.ts';
import { buildLiveAppState, getAppStatus, getLatestAppSnapshot, getLiveAppVersion, publishApp } from './lib/appPublish.ts';
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
import { saveDevicePushToken, removeDevicePushToken, sendPushCampaign } from './lib/push.ts';
import {
  apartmentSchema,
  createApartment,
  deleteApartment,
  getApartment,
  listApartments,
  updateApartment,
} from './lib/apartments.ts';
import {
  realEstateSchema,
  createRealEstate,
  deleteRealEstate,
  getRealEstate,
  listRealEstate,
  updateRealEstate,
} from './lib/realEstate.ts';
import {
  stopSchema,
  createStop,
  deleteStop,
  getStop,
  listStops,
  updateStop,
} from './lib/stops.ts';

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

const adminLoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

const themeSchema = z.object({
  brand: z.string().min(1),
  primaryGradient: z.tuple([z.string().min(1), z.string().min(1)]),
  tabs: z.array(themeTabSchema).min(1),
  mode: z.enum(['nba-allstar']).nullish(),
});

const adSchema = z.object({
  slot: z.number().int().min(1).max(5),
  image_url: z.string().min(1),
  link_url: z.string().min(1).nullable().optional(),
  active: z.boolean().default(true),
});

const adUpdateSchema = adSchema.partial();


function buildPushPreferences(row: Pick<UserProfileRow, 'push_enabled_new_vendor' | 'push_enabled_expiring_deal' | 'push_enabled_local_event'>) {
  return {
    newVendor: row.push_enabled_new_vendor,
    expiringDeal: row.push_enabled_expiring_deal,
    localEvent: row.push_enabled_local_event,
  };
}

function mapUserProfileRow(row: UserProfileRow) {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    fullName: row.full_name,
    firstName: row.first_name,
    lastName: row.last_name,
    city: row.city,
    status: row.status,
    pushPreferences: buildPushPreferences(row),
    promoEmailOptIn: row.promo_email_opt_in,
    promoSmsOptIn: row.promo_sms_opt_in,
    termsAcceptedAt: row.terms_accepted_at,
    privacyAcceptedAt: row.privacy_accepted_at,
    eulaAcceptedAt: row.eula_accepted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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

function renderRedemptionPage(result: { ok: boolean; discount?: { type: 'fixed' | 'percent' | 'bogo'; value: number; description: string; instruction?: string } | null; amountApplied?: number; redemptionId?: string; memberName?: string; memberId?: string; error?: string }) {
  const success = result.ok;
  const title = success ? 'Membership Approved' : 'Unable to Apply Discount';

  let discountAmount = result.discount?.description ?? 'discount';
  if (success) {
    if (result.discount?.type === 'fixed') {
      discountAmount = `$${(result.amountApplied ?? 0).toFixed(2)}`;
    } else if (result.discount?.type === 'percent') {
      discountAmount = `${result.discount.value}% off`;
    }
  }

  const memberName = escapeHtml(result.memberName ?? 'Member');
  const memberId = escapeHtml(result.memberId ?? '');
  const errorMessage = escapeHtml(result.error ?? 'This QR code is invalid or has already been used.');

  const icon = success
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:40px;height:40px;"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:40px;height:40px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  const bodyContent = `
    <div class="icon-ring" style="background:${success ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'linear-gradient(135deg,#dc2626,#ef4444)'}">
      <div class="icon">${icon}</div>
    </div>
    ${success ? `<h1 class="member-name">${memberName}</h1>` : `<h1>${escapeHtml(title)}</h1>`}
    ${success && memberId ? `<p class="member-id">Member ID: ${memberId}</p>` : ''}
    ${success ? `<p class="message">Membership approved. Apply <strong>${escapeHtml(discountAmount)}</strong> to the bill.</p>` : `<p class="message">${errorMessage}</p>`}
    ${!success ? `<p class="footer">Ask the member to refresh their discount QR code.</p>` : ''}
    ${success ? '<p class="footer">Redemption recorded in Light Rail Deals.</p>' : ''}
  `;

  return pageShell(title, bodyContent, success ? 'success' : 'error');
}

function renderMissingTokenPage(): string {
  const title = 'Invalid QR Code';
  const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:36px;height:36px;"><rect x="3" y="3" width="18" height="18" rx="6" ry="6"></rect><line x1="12" y1="8" x2="12" y2="13"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

  const bodyContent = `
    <div class="icon-ring" style="background:linear-gradient(135deg,#d97706,#f59e0b)">
      <div class="icon">${icon}</div>
    </div>
    <h1>${title}</h1>
    <p class="subtitle">No redemption code was found in this link.</p>
    <p class="message">This QR code appears to be incomplete, expired, or already used. Ask the member to generate a new discount code from the Light Rail Deals app.</p>
    <p class="footer">If the problem continues, contact Light Rail Deals support.</p>
  `;

  return pageShell(title, bodyContent, 'neutral');
}

function pageShell(title: string, body: string, tone: 'success' | 'error' | 'neutral'): string {
  const brandColor = tone === 'success' ? '#16a34a' : tone === 'error' ? '#dc2626' : '#d97706';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 100%);
      color: #1f2937;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      border-radius: 28px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.25);
      max-width: 460px;
      width: 100%;
      padding: 44px 32px 36px;
      text-align: center;
      overflow: hidden;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 28px;
      font-size: 15px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.2px;
    }
    .brand svg { width: 22px; height: 22px; }
    .icon-ring {
      width: 92px;
      height: 92px;
      margin: 0 auto 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    }
    .icon { display: flex; align-items: center; justify-content: center; }
    h1 { font-size: 26px; font-weight: 800; margin: 0 0 8px; color: #111827; letter-spacing: -0.5px; }
    .subtitle { font-size: 15px; color: #6b7280; margin: 0 0 22px; line-height: 1.45; }
    .message { font-size: 16px; line-height: 1.6; margin: 0 0 18px; color: #4b5563; }
    .message strong { color: ${brandColor}; }
    .member-name { font-size: 26px; font-weight: 800; margin: 0 0 6px; color: #111827; letter-spacing: -0.5px; }
    .member-id { font-size: 15px; font-weight: 500; color: #6b7280; margin: 0 0 22px; letter-spacing: 0.2px; }
    .amount { font-size: 17px; font-weight: 600; color: #111827; margin: 0 0 8px; }
    .amount span { color: ${brandColor}; }
    .tracking { font-size: 13px; color: #6b7280; margin: 0 0 24px; word-break: break-all; }
    .tracking code { background: #f3f4f6; border-radius: 6px; padding: 3px 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #111827; }
    .instruction { font-size: 14px; color: #374151; background: #f9fafb; border-radius: 14px; padding: 14px 18px; margin: 0 0 22px; line-height: 1.55; border: 1px solid #f3f4f6; }
    .footer { font-size: 12px; color: #9ca3af; margin: 0; }
    @media (max-width: 480px) {
      .card { padding: 32px 22px 28px; border-radius: 22px; }
      h1 { font-size: 22px; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <svg viewBox="0 0 24 24" fill="none" stroke="${brandColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="8" rx="2"></rect><path d="M4 12h2l2-3 3 6 3-6 2 3h3"></path></svg>
      Light Rail Deals
    </div>
    ${body}
  </div>
</body>
</html>`;
}

function json(request: Request, body: unknown, init: ResponseInit = {}): Response {
  const payload = JSON.stringify(body);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': corsOrigin(request),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    ...(init.headers ?? {}),
  };
  // The app-state and vendor payloads are multi-MB JSON; gzip cuts them to a
  // fraction of the wire size when the client accepts it.
  if (payload.length > 1024 && /\bgzip\b/i.test(request.headers.get('accept-encoding') ?? '')) {
    const stream = new Blob([payload]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Response(stream, {
      ...init,
      headers: { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' },
    });
  }
  return new Response(payload, { ...init, headers });
}

function noContent(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin(request),
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    },
  });
}

function getIp(request: Request): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

function acceptsJson(request: Request): boolean {
  const accept = request.headers.get('Accept') ?? '';
  return accept.includes('application/json');
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


function notFound(request: Request): Response {
  return json(request, { error: 'Not found' }, { status: 404 });
}

// ---- NCAA upstream normalization ----
// ncaa-api.henrygd.me returns nested shapes (`games[].game`, grouped
// `data[].standings[]`). Normalize into the flat shape every shipped app
// version expects so older bundles keep working without an update.
interface NcaaUpstreamTeam {
  score?: string | number;
  names?: { char6?: string; short?: string; seo?: string; full?: string };
  conferences?: { conferenceSeo?: string | null }[];
}

interface NcaaUpstreamGame {
  gameID?: string | number;
  away?: NcaaUpstreamTeam;
  home?: NcaaUpstreamTeam;
  finalMessage?: string;
  startTime?: string;
  startTimeEpoch?: string | number;
  gameState?: string;
  startDate?: string;
  currentPeriod?: string;
  contestClock?: string;
}

function ncaaToScore(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function ncaaMapTeam(team: NcaaUpstreamTeam | undefined) {
  const names = team?.names ?? {};
  const name = names.short || names.full || names.char6 || 'TBD';
  return {
    id: names.seo || name,
    name,
    abbreviation: names.char6 || name,
    score: ncaaToScore(team?.score),
  };
}

function ncaaTeamInConference(team: NcaaUpstreamTeam | undefined, conference: string): boolean {
  return (team?.conferences ?? []).some((c) => c?.conferenceSeo === conference);
}

function ncaaGameStatus(game: NcaaUpstreamGame): string | undefined {
  if (game.finalMessage?.trim()) return game.finalMessage.trim();
  switch (game.gameState) {
    case 'final':
      return 'Final';
    case 'live':
      return 'Live';
    case 'pre':
      return game.startTime || undefined;
    default:
      return undefined;
  }
}

function ncaaMapGame(entry: unknown, sport: string, division: string) {
  const game = (entry as { game?: NcaaUpstreamGame } | null)?.game;
  if (!game) return null;
  const epoch = Number(game.startTimeEpoch);
  return {
    id: Number(game.gameID) || 0,
    sport,
    path: division,
    game_date: Number.isFinite(epoch) && epoch > 0 ? new Date(epoch * 1000).toISOString() : String(game.startDate ?? ''),
    home_team: ncaaMapTeam(game.home),
    away_team: ncaaMapTeam(game.away),
    status: ncaaGameStatus(game),
    quarter: game.gameState === 'live' ? game.currentPeriod?.trim() || undefined : undefined,
    time_remaining: game.gameState === 'live' ? game.contestClock?.trim() || undefined : undefined,
  };
}

// Upstream divisions: football uses fbs/fcs/d2/d3 (d1 does not exist);
// every other sport uses d1/d2/d3 (fbs/fcs do not). Shipped app versions
// keep the stale division when switching sports, so coerce invalid combos
// here instead of passing the upstream 400/404 through to clients (whose
// direct-API fallback points at the dead api.ncaa.com host).
function ncaaCoerceDivision(sport: string, division: string): string {
  const isFootballDivision = division === 'fbs' || division === 'fcs';
  if (sport === 'football') return division === 'd1' ? 'fbs' : division;
  return isFootballDivision ? 'd1' : division;
}

function ncaaNumField(row: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
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

    // Public: record first-run acceptance of Terms/Privacy/EULA with the
    // request IP and timestamp. Works anonymously — the bearer token is used
    // only to link the row to an account when one exists.
    if (path === '/api/legal/acceptance' && request.method === 'POST') {
      const body = await readJsonBody<{ platform?: string; deviceId?: string }>(request, {});
      const ip = getIp(request);
      const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null;
      const platform = typeof body.platform === 'string' ? body.platform.slice(0, 50) : null;
      const deviceId = typeof body.deviceId === 'string' ? body.deviceId.slice(0, 120) : null;
      await dbQuery(
        'INSERT INTO legal_acceptances (device_id, platform, ip, user_agent) VALUES ($1, $2, $3::inet, $4)',
        [deviceId, platform, ip, userAgent],
      );
      return json(request, { recorded: true });
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

    // Public, customer-facing directory of participating businesses for the
    // mobile app. Every vendor's exclusive discount hangs off the single
    // membership card; the member unlocks them all with their own membership
    // pass, so no per-vendor wallet URL or raw discount code is exposed here.
    if ((path === '/api/vendors' || /^\/api\/vendors\/[^/]+$/.test(path)) && request.method === 'GET') {
      const single = path !== '/api/vendors';
      const vendorId = single ? path.split('/').pop()! : undefined;
      const items = await getVendorDirectory(vendorId);
      if (single) {
        if (items.length === 0) return json(request, { error: 'Vendor not found' }, { status: 404 });
        return json(request, items[0]);
      }
      return json(request, items);
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
    if (path === '/api/admin/profile' && request.method === 'GET') {
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
      // Read via PostgREST: the direct pg connection dies mid-transfer on
      // this multi-KB result set from edge isolates.
      const vendorParams: Array<[string, string]> = [
        ['select', 'id,name,owner_name,location,address,city,station,category,vendor_type,cuisine,email,phone,website,status,latitude,longitude,icon_url,logo_url,discount_terms,pos_type,pos_system,created_at,updated_at'],
        ['order', 'created_at.desc'],
      ];
      if (q.status) vendorParams.push(['status', `eq.${q.status}`]);
      if (q.city) vendorParams.push(['city', `eq.${q.city}`]);
      if (q.category) vendorParams.push(['category', `eq.${q.category}`]);
      const [vendors, discounts] = await Promise.all([
        restQuery<Record<string, unknown>>('vendors', vendorParams),
        restQuery<{ vendor_id: string; type: string | null; value: number | null; discount_code: string | null; description: string | null; starts_at: string | null; ends_at: string | null; boosted: boolean | null; members_only: boolean | null }>(
          'discounts',
          [
            ['select', 'vendor_id,type,value,discount_code,description,starts_at,ends_at,boosted,members_only,created_at'],
            ['order', 'created_at.desc'],
          ],
        ),
      ]);
      const latest = new Map<string, (typeof discounts)[number]>();
      for (const d of discounts) if (!latest.has(d.vendor_id)) latest.set(d.vendor_id, d);
      return json(request, vendors.map((v) => {
        const d = latest.get(v.id as string);
        return {
          ...v,
          discount_type: d?.type ?? null,
          discount_value: d?.value ?? null,
          discount_code: d?.discount_code ?? null,
          discount_description: d?.description ?? null,
          discount_starts_at: d?.starts_at ?? null,
          discount_ends_at: d?.ends_at ?? null,
          discount_boosted: d?.boosted ?? null,
          discount_members_only: d?.members_only ?? null,
        };
      }));
    }
    if (path === '/api/admin/vendors' && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const body = adminVendorCreateSchema.parse(await readJsonBody(request, {}));
      const result = await createVendorWithDiscount({
        name: body.name,
        ownerName: body.ownerName ?? null,
        address: body.address ?? null,
        city: body.city ?? null,
        station: body.station ?? null,
        category: body.category,
        email: body.email ?? null,
        phone: body.phone ?? null,
        website: body.website ?? null,
        discountType: body.discountType,
        discountValue: body.discountValue,
        discountDescription: body.discountDescription ?? null,
        discountTerms: body.discountTerms ?? null,
        discountStartsAt: body.discountStartsAt ?? null,
        discountEndsAt: body.discountEndsAt ?? null,
        boosted: body.boosted ?? false,
        membersOnly: body.membersOnly ?? false,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        iconDataUrl: body.iconDataUrl ?? null,
        logoDataUrl: body.logoDataUrl ?? null,
      });
      return json(request, result, { status: 201 });
    }
    if (/^\/api\/admin\/vendors\/[^/]+$/.test(path) && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const vendor = await getAdminVendorById(id);
      if (!vendor) return json(request, { error: 'Vendor not found' }, { status: 404 });
      return json(request, vendor);
    }
    if (/^\/api\/admin\/vendors\/[^/]+$/.test(path) && request.method === 'PATCH') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const body = adminVendorUpdateSchema.parse(await readJsonBody(request, {}));
      const vendorType = body.category !== undefined ? inferVendorType(body.category) : null;
      const cuisine = body.category !== undefined ? inferCuisine(body.category, vendorType) : null;
      const rows = await dbQuery(
        `UPDATE vendors SET name = COALESCE($2, name), owner_name = COALESCE($3, owner_name), location = COALESCE($4, location), address = COALESCE($4, address), category = COALESCE($5, category), email = COALESCE($6, email), phone = COALESCE($7, phone), status = COALESCE($8, status), latitude = COALESCE($9, latitude), longitude = COALESCE($10, longitude), discount_terms = COALESCE($11, discount_terms), vendor_type = COALESCE($12, vendor_type), cuisine = COALESCE($13, cuisine), station = COALESCE($14, station), city = COALESCE($15, city), website = COALESCE($16, website), updated_at = now() WHERE id = $1 RETURNING *`,
        [id, body.name ?? null, body.ownerName ?? null, body.address ?? null, body.category ?? null, body.email ?? null, body.phone ?? null, body.status ?? null, body.latitude ?? null, body.longitude ?? null, body.discountTerms ?? null, vendorType, cuisine, body.station ?? null, body.city ?? null, body.website ?? null],
      );
      if (body.discountType !== undefined || body.discountValue !== undefined || body.discountDescription !== undefined || body.discountStartsAt !== undefined || body.discountEndsAt !== undefined || body.boosted !== undefined || body.membersOnly !== undefined) {
        if (body.discountType !== undefined || body.discountValue !== undefined) {
          // Upsert so vendors without a discount row get one created.
          const discountCode = generateDiscountCode({
            merchantId: String(rows[0]?.name ?? id),
            type: body.discountType ?? 'percent',
            value: body.discountValue ?? 0,
          });
          await dbQuery(
            `INSERT INTO discounts (vendor_id, type, value, discount_code, description, active, starts_at, ends_at, boosted, members_only)
             VALUES ($1, COALESCE($2, 'percent'), COALESCE($3, 0), $4, $5, true, $6, $7, $8, COALESCE($9, false))
             ON CONFLICT (vendor_id) DO UPDATE SET
               type = COALESCE($2, discounts.type), value = COALESCE($3, discounts.value),
               discount_code = COALESCE(discounts.discount_code, EXCLUDED.discount_code),
               description = COALESCE($5, discounts.description), starts_at = COALESCE($6, discounts.starts_at),
               ends_at = COALESCE($7, discounts.ends_at), boosted = COALESCE($8, discounts.boosted),
               members_only = COALESCE($9, discounts.members_only), active = true, updated_at = now()`,
            [id, body.discountType ?? null, body.discountValue ?? null, discountCode, body.discountDescription ?? null, body.discountStartsAt ?? null, body.discountEndsAt ?? null, body.boosted ?? null, body.membersOnly ?? null],
          );
        } else {
          await dbQuery(
            `UPDATE discounts SET type = COALESCE($2, type), value = COALESCE($3, value), description = COALESCE($4, description), starts_at = COALESCE($5, starts_at), ends_at = COALESCE($6, ends_at), boosted = COALESCE($7, boosted), members_only = COALESCE($8, members_only), updated_at = now() WHERE vendor_id = $1`,
            [id, body.discountType ?? null, body.discountValue ?? null, body.discountDescription ?? null, body.discountStartsAt ?? null, body.discountEndsAt ?? null, body.boosted ?? null, body.membersOnly ?? null],
          );
        }
      }
      return json(request, rows[0] ?? {});
    }
    // Returns a vendor's exclusive discount code for admin reference.
    if (/^\/api\/admin\/vendors\/[^/]+\/pass$/.test(path) && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').slice(-2)[0]!;
      const rows = await dbQuery<{ discount_type: 'fixed' | 'percent' | 'bogo'; discount_value: string; discount_code: string | null }>(
        `SELECT d.type AS discount_type, d.value AS discount_value, d.discount_code FROM discounts d WHERE d.vendor_id = $1 ORDER BY d.created_at DESC LIMIT 1`,
        [id],
      );
      const row = rows[0];
      if (!row) return json(request, { error: 'No discount for this vendor' }, { status: 404 });
      const label = humanDiscountLabel(row.discount_type, Number(row.discount_value));
      return json(request, { discountCode: row.discount_code, discount: { type: row.discount_type, value: Number(row.discount_value), label } });
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

        const existing = await client.query(
          'SELECT id, type, value FROM discounts WHERE vendor_id = $1 LIMIT 1',
          [id],
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
            'INSERT INTO discounts (vendor_id, type, value, discount_code, description, active) VALUES ($1, $2, $3, $4, $5, true) RETURNING id',
            [id, type, value, discountCode, `${label} member discount`],
          );
          discountId = (inserted.rows[0] as { id: string }).id;
        }

        const newCode = generateDiscountCode({ merchantId: vendor.name, type, value });
        await client.query('UPDATE discounts SET discount_code = $2, updated_at = now() WHERE id = $1', [discountId, newCode]);
        return { discountCode: newCode, qrUrl: qrCodeUrl(newCode, 300) };
      });

      if (!result) return json(request, { error: 'Vendor or membership card not found' }, { status: 404 });
      return json(request, result);
    }
    if (path === '/api/admin/discounts' && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const rows = await restQuery('discounts', [
        ['select', 'id,vendor_id,type,value,min_purchase,max_uses_total,max_uses_per_customer,city_overrides,active,created_at,updated_at'],
        ['order', 'created_at.desc'],
      ]);
      return json(request, rows);
    }
    if (/^\/api\/admin\/discounts\/[^/]+$/.test(path) && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const rows = await dbQuery('SELECT id, vendor_id, type, value, min_purchase, max_uses_total, max_uses_per_customer, city_overrides, active, created_at, updated_at FROM discounts WHERE id = $1 LIMIT 1', [id]);
      if (rows.length === 0) {
        return json(request, { error: 'Discount not found' }, { status: 404 });
      }
      return json(request, rows[0]);
    }
    if (path === '/api/admin/discounts' && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const body = discountSchema.parse(await readJsonBody(request, {}));
      const rows = await dbQuery<{ id: string }>(
        `INSERT INTO discounts (vendor_id, type, value, min_purchase, max_uses_total, max_uses_per_customer, city_overrides, active) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8) RETURNING id`,
        [body.vendorId, body.type, body.value, body.minPurchase, body.maxUsesTotal ?? null, body.maxUsesPerCustomer ?? null, JSON.stringify(body.cityOverrides ?? {}), body.active],
      );
      return json(request, { id: rows[0]!.id }, { status: 201 });
    }
    if (/^\/api\/admin\/discounts\/[^/]+$/.test(path) && request.method === 'PATCH') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const body = discountSchema.partial().parse(await readJsonBody(request, {}));
      const rows = await dbQuery(
        `UPDATE discounts SET vendor_id = COALESCE($2, vendor_id), type = COALESCE($3, type), value = COALESCE($4, value), min_purchase = COALESCE($5, min_purchase), max_uses_total = COALESCE($6, max_uses_total), max_uses_per_customer = COALESCE($7, max_uses_per_customer), city_overrides = COALESCE($8::jsonb, city_overrides), active = COALESCE($9, active), updated_at = now() WHERE id = $1 RETURNING *`,
        [id, body.vendorId ?? null, body.type ?? null, body.value ?? null, body.minPurchase ?? null, body.maxUsesTotal ?? null, body.maxUsesPerCustomer ?? null, body.cityOverrides ? JSON.stringify(body.cityOverrides) : null, body.active ?? null],
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
      return json(request, await getPublishedContent());
    }
    // Public: current published content version so the app can decide whether to refresh.
    if (path === '/api/content/version' && request.method === 'GET') {
      return json(request, await getContentVersion());
    }
    // Public: active ads shown in the mobile app.
    if (path === '/api/ads' && request.method === 'GET') {
      const rows = await dbQuery<{ id: string; slot: number; image_url: string; link_url: string | null; active: boolean; created_at: string; updated_at: string }>(
        'SELECT id, slot, image_url, link_url, active, created_at, updated_at FROM ads WHERE active = true ORDER BY slot',
      );
      return json(request, rows);
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
    if (path === '/api/admin/content/status' && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      return json(request, await getContentStatus());
    }
    if (path === '/api/admin/content/publish' && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const result = await publishContent();
      return json(request, result, { status: 201 });
    }
    if (/^\/api\/admin\/content\/[^/]+$/.test(path) && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const block = await getContentBlock(id);
      if (!block) return json(request, { error: 'Content block not found' }, { status: 404 });
      return json(request, block);
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

    // ---- Full app state -----------------------------------------------------
    // Public: live snapshot of the public app state (vendors, apartments,
    // events, content, theme). Built fresh from the tables on every request so
    // admin edits reach devices immediately — the manual publish step is no
    // longer required. Falls back to the last published snapshot if the live
    // build fails (e.g. a transient DB issue).
    if (path === '/api/app' && request.method === 'GET') {
      try {
        return json(request, await buildLiveAppState());
      } catch (err) {
        console.error('[app] live state build failed, falling back to snapshot:', err);
        const snapshot = await getLatestAppSnapshot();
        if (!snapshot) return json(request, { error: 'No published app state' }, { status: 404 });
        return json(request, snapshot);
      }
    }
    if (path === '/api/app/version' && request.method === 'GET') {
      return json(request, await getLiveAppVersion());
    }
    if (path === '/api/admin/app/status' && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      return json(request, await getAppStatus());
    }
    if (path === '/api/admin/app/publish' && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const result = await publishApp();
      return json(request, result, { status: 201 });
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
    if (/^\/api\/admin\/events\/custom\/[^/]+$/.test(path) && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const rows = await dbQuery<{
        id: string;
        title: string;
        description: string | null;
        event_date: string | null;
        event_time: string | null;
        image_url: string | null;
        city: string | null;
        phone: string | null;
        event_link: string | null;
        sport: string | null;
        event_type: string | null;
        created_at: string;
      }>(
        'SELECT id, title, description, event_date, event_time, image_url, city, phone, event_link, sport, event_type, created_at FROM admin_events WHERE id = $1 LIMIT 1',
        [id],
      );
      if (rows.length === 0) {
        return json(request, { error: 'Event not found' }, { status: 404 });
      }
      return json(request, rows[0]);
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
      await deleteAdminEvent(id);
      return json(request, { success: true });
    }

    // ---- Apartments / hotels ------------------------------------------------
    // Public: listings shown on the Apartments/Hotels tab with Mapbox.
    if (path === '/api/apartments' && request.method === 'GET') {
      return json(request, await listApartments({ nearRail: true }));
    }
    if (/^\/api\/apartments\/[^/]+$/.test(path) && request.method === 'GET') {
      const id = path.split('/').pop()!;
      const row = await getApartment(id);
      if (!row) return json(request, { error: 'Apartment not found' }, { status: 404 });
      return json(request, row);
    }
    // Admin: manage apartments/hotels listings.
    if (path === '/api/admin/apartments' && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      return json(request, await listApartments());
    }
    if (path === '/api/admin/apartments' && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const body = apartmentSchema.parse(await readJsonBody(request, {}));
      return json(request, await createApartment(body), { status: 201 });
    }
    if (/^\/api\/admin\/apartments\/[^/]+$/.test(path) && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const row = await getApartment(id);
      if (!row) return json(request, { error: 'Apartment not found' }, { status: 404 });
      return json(request, row);
    }
    if (/^\/api\/admin\/apartments\/[^/]+$/.test(path) && request.method === 'PATCH') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const body = apartmentSchema.partial().parse(await readJsonBody(request, {}));
      const updated = await updateApartment(id, body);
      if (!updated) return json(request, { error: 'Apartment not found' }, { status: 404 });
      return json(request, updated);
    }
    if (/^\/api\/admin\/apartments\/[^/]+$/.test(path) && request.method === 'DELETE') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const deleted = await deleteApartment(id);
      return json(request, {}, { status: deleted ? 204 : 404 });
    }

    // ---- Real estate ------------------------------------------------------
    // Admin: manage real-estate listings surfaced on the app's Real Estate tab
    // (via the /api/app snapshot; the tab shows "Coming soon" while empty).
    if (path === '/api/admin/real-estate' && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      return json(request, await listRealEstate());
    }
    if (path === '/api/admin/real-estate' && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const body = realEstateSchema.parse(await readJsonBody(request, {}));
      return json(request, await createRealEstate(body), { status: 201 });
    }
    if (/^\/api\/admin\/real-estate\/[^/]+$/.test(path) && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const row = await getRealEstate(id);
      if (!row) return json(request, { error: 'Listing not found' }, { status: 404 });
      return json(request, row);
    }
    if (/^\/api\/admin\/real-estate\/[^/]+$/.test(path) && request.method === 'PATCH') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const body = realEstateSchema.partial().parse(await readJsonBody(request, {}));
      const updated = await updateRealEstate(id, body);
      if (!updated) return json(request, { error: 'Listing not found' }, { status: 404 });
      return json(request, updated);
    }
    if (/^\/api\/admin\/real-estate\/[^/]+$/.test(path) && request.method === 'DELETE') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const deleted = await deleteRealEstate(id);
      return json(request, {}, { status: deleted ? 204 : 404 });
    }

    // ---- Stops ------------------------------------------------------------
    // Public: list of rail stops used by the directory.
    if (path === '/api/stops' && request.method === 'GET') {
      return json(request, await listStops());
    }
    // Admin: manage rail stops.
    if (path === '/api/admin/stops' && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      return json(request, await listStops());
    }
    if (path === '/api/admin/stops' && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const body = stopSchema.parse(await readJsonBody(request, {}));
      return json(request, await createStop(body), { status: 201 });
    }
    if (/^\/api\/admin\/stops\/[^/]+$/.test(path) && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const row = await getStop(id);
      if (!row) return json(request, { error: 'Stop not found' }, { status: 404 });
      return json(request, row);
    }
    if (/^\/api\/admin\/stops\/[^/]+$/.test(path) && request.method === 'PATCH') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const body = stopSchema.partial().parse(await readJsonBody(request, {}));
      const updated = await updateStop(id, body);
      if (!updated) return json(request, { error: 'Stop not found' }, { status: 404 });
      return json(request, updated);
    }
    if (/^\/api\/admin\/stops\/[^/]+$/.test(path) && request.method === 'DELETE') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const deleted = await deleteStop(id);
      return json(request, {}, { status: deleted ? 204 : 404 });
    }

    // The current member's single all-in-one membership pass (auto-created).
    // Anonymous push registration: devices register/unregister their Expo
    // push token without an account. Token is the dedupe key.
    if (path === '/api/push/register' && request.method === 'POST') {
      const body = z.object({
        token: z.string().min(1).max(300).nullable(),
        platform: z.string().max(30).optional(),
      }).parse(await readJsonBody(request, {}));
      if (body.token === null) {
        return json(request, { registered: false });
      }
      await saveDevicePushToken(body.token, body.platform ?? null);
      return json(request, { registered: true });
    }
    if (path === '/api/push/unregister' && request.method === 'POST') {
      const body = z.object({ token: z.string().min(1).max(300) }).parse(await readJsonBody(request, {}));
      await removeDevicePushToken(body.token);
      return json(request, { registered: false });
    }

    // Redemption tokens work anonymously: a customer JWT binds the token to
    // the member account; without one the token is created with NULL user_id.
    if (path === '/api/discounts/tokens' && request.method === 'POST') {
      const claims = authenticate(request);
      const userId = claims?.role === 'customer' ? claims.sub : null;
      const body = z.object({ vendorId: z.string().uuid() }).parse(await readJsonBody(request, {}));
      const fallbackBase = `${url.origin}/functions/v1/router`;
      try {
        const payload = await withDbClient((client) => createRedemptionToken(client, userId, body.vendorId, fallbackBase));
        return json(request, payload);
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status === 403) {
          return json(request, { error: (error as Error).message }, { status: 403 });
        }
        throw error;
      }
    }
    if (/^\/api\/discounts\/tokens\/[^/]+\/affirm$/.test(path) && request.method === 'POST') {
      const claims = authenticate(request);
      const userId = claims?.role === 'customer' ? claims.sub : null;
      const token = path.split('/').slice(-2)[0]!;
      const body = z.object({ affirmationName: z.string().min(1) }).parse(await readJsonBody(request, {}));
      const result = await affirmRedemptionToken(token, userId, body.affirmationName, getIp(request));
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

    if (path === '/api/redeem' && request.method === 'GET') {
      if (acceptsJson(request)) {
        return json(request, { ok: false, error: 'No redemption code' }, { status: 400 });
      }
      return new Response(renderMissingTokenPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (/^\/(?:api\/)?redeem\/[^/]+$/.test(path) && request.method === 'GET') {
      const token = path.split('/').pop()!;
      const result = await redeemByToken(token, getIp(request));
      if (acceptsJson(request)) {
        return json(request, result);
      }
      const html = renderRedemptionPage(result);
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // Admin: send a push notification to all users with a push token (optionally filtered by city).
    if (path === '/api/admin/push' && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const body = z.object({
        title: z.string().min(1).max(100),
        message: z.string().min(1).max(500),
        campaignKey: z.string().max(120).optional(),
      }).parse(await readJsonBody(request, {}));
      const result = await sendPushCampaign(body.title, body.message, auth.sub, body.campaignKey ?? null);
      if (result.targeted === 0) {
        return json(request, { sent: 0, message: 'No push tokens registered for the selected audience.' });
      }
      return json(request, { sent: result.sent, targeted: result.targeted, skipped: result.skipped, campaignId: result.campaignId, errors: result.errors });
    }

    // NCAA API proxy endpoints to bypass CORS/DNS issues. Upstream is the
    // public ncaa-api.henrygd.me mirror (the old api.ncaa.com endpoints no
    // longer resolve).
    if (path.startsWith('/api/proxy/ncaa/scoreboard/') && request.method === 'GET') {
      const pathMatch = path.match(/^\/api\/proxy\/ncaa\/scoreboard\/([^/]+)\/(.+)$/);
      if (!pathMatch) return json(request, { error: 'Invalid path' }, { status: 400 });
      const [, sport, pathPart] = pathMatch;

      // Validate and sanitize parameters to prevent SSRF
      const allowedSports = /^(football|basketball-men|basketball-women|soccer-men|soccer-women|volleyball-women|baseball|softball|icehockey-men|icehockey-women|lacrosse-men|lacrosse-women)$/;
      const allowedPath = /^[\w\-\/]+$/;

      if (!allowedSports.test(sport)) {
        return json(request, { error: 'Invalid sport parameter' }, { status: 400 });
      }
      if (!allowedPath.test(pathPart)) {
        return json(request, { error: 'Invalid path parameter' }, { status: 400 });
      }

      // Normalize legacy client paths (`{div}/current/all-conf[/conference]`)
      // to the upstream layout. A trailing non-numeric segment is treated as a
      // conference slug and filtered server-side for older app versions.
      const segments = pathPart.split('/').filter((s) => s && s !== 'current' && s !== 'all-conf');
      let conference: string | null = null;
      if (segments.length > 1 && !/^\d+$/.test(segments[segments.length - 1]!)) {
        conference = segments.pop()!;
      }
      if (segments.length > 0) segments[0] = ncaaCoerceDivision(sport, segments[0]!);
      const upstreamPath = segments.map(encodeURIComponent).join('/');
      const ncaaUrl = `https://ncaa-api.henrygd.me/scoreboard/${encodeURIComponent(sport)}/${upstreamPath}`;

      try {
        const response = await fetch(ncaaUrl, {
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          return json(request, { error: `NCAA API error: ${response.status}` }, { status: response.status });
        }

        const data = await response.json();
        const entries = Array.isArray((data as { games?: unknown[] })?.games)
          ? (data as { games: unknown[] }).games
          : [];
        // The upstream scoreboard endpoint ignores conference path segments, so
        // filtering happens here by matching team conference slugs.
        const filtered = conference
          ? entries.filter(
              (entry) =>
                ncaaTeamInConference((entry as { game?: NcaaUpstreamGame })?.game?.home, conference) ||
                ncaaTeamInConference((entry as { game?: NcaaUpstreamGame })?.game?.away, conference),
            )
          : entries;
        const games = filtered
          .map((entry) => ncaaMapGame(entry, sport, segments[0] ?? ''))
          .filter((game) => game !== null);
        return json(request, { games });
      } catch (error) {
        console.error('NCAA API proxy error:', error);
        return json(request, { error: 'Failed to fetch from NCAA API' }, { status: 502 });
      }
    }

    if (path.startsWith('/api/proxy/ncaa/standings/') && request.method === 'GET') {
      const pathMatch = path.match(/^\/api\/proxy\/ncaa\/standings\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/);
      if (!pathMatch) return json(request, { error: 'Invalid path' }, { status: 400 });
      const [, sport, division, conference] = pathMatch;

      // Validate and sanitize parameters to prevent SSRF
      const allowedSports = /^(football|basketball-men|basketball-women|soccer-men|soccer-women|volleyball-women|baseball|softball|icehockey-men|icehockey-women|lacrosse-men|lacrosse-women)$/;
      const allowedDivision = /^(fbs|fcs|d1|d2|d3)$/;
      const allowedConference = /^[\w\-]+$/;

      if (!allowedSports.test(sport)) {
        return json(request, { error: 'Invalid sport parameter' }, { status: 400 });
      }
      if (!allowedDivision.test(division)) {
        return json(request, { error: 'Invalid division parameter' }, { status: 400 });
      }
      if (conference && !allowedConference.test(conference)) {
        return json(request, { error: 'Invalid conference parameter' }, { status: 400 });
      }

      const conferencePath = conference ? `/${encodeURIComponent(conference)}` : '';
      const ncaaUrl = `https://ncaa-api.henrygd.me/standings/${encodeURIComponent(sport)}/${encodeURIComponent(ncaaCoerceDivision(sport, division))}${conferencePath}`;

      try {
        const response = await fetch(ncaaUrl, {
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          return json(request, { error: `NCAA API error: ${response.status}` }, { status: response.status });
        }

        const data = await response.json();
        const groups = Array.isArray((data as { data?: { conference?: string; standings?: Record<string, unknown>[] }[] })?.data)
          ? (data as { data: { conference?: string; standings?: Record<string, unknown>[] }[] }).data
          : [];
        const standings: Record<string, unknown>[] = [];
        for (const group of groups) {
          for (const row of group.standings ?? []) {
            const wins = ncaaNumField(row, 'Overall W', 'W');
            const losses = ncaaNumField(row, 'Overall L', 'L');
            const ties = ncaaNumField(row, 'Overall T', 'T', 'Overall Ties');
            const total = wins + losses + ties;
            standings.push({
              team: String(row['School'] ?? row['Team'] ?? ''),
              conference: String(group.conference ?? ''),
              wins,
              losses,
              ...(ties > 0 ? { ties } : {}),
              ...(total > 0 ? { percentage: wins / total } : {}),
            });
          }
        }
        return json(request, { standings });
      } catch (error) {
        console.error('NCAA API proxy error:', error);
        return json(request, { error: 'Failed to fetch from NCAA API' }, { status: 502 });
      }
    }

    // Ads: public list and admin CRUD.
    if (path === '/api/ads' && request.method === 'GET') {
      const rows = await dbQuery('SELECT id, slot, image_url, link_url, active, created_at, updated_at FROM ads WHERE active = true ORDER BY slot');
      return json(request, rows);
    }

    if (path === '/api/admin/ads' && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const rows = await dbQuery('SELECT id, slot, image_url, link_url, active, created_at, updated_at FROM ads ORDER BY slot');
      return json(request, rows);
    }

    if (path === '/api/admin/ads' && request.method === 'POST') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const body = adSchema.parse(await readJsonBody(request, {}));
      const rows = await dbQuery<{ id: string; created_at: string; updated_at: string }>(
        `INSERT INTO ads (slot, image_url, link_url, active)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (slot) DO UPDATE
         SET image_url = EXCLUDED.image_url,
             link_url = EXCLUDED.link_url,
             active = EXCLUDED.active,
             updated_at = now()
         RETURNING id, created_at, updated_at`,
        [body.slot, body.image_url, body.link_url ?? null, body.active],
      );
      return json(request, { ...rows[0], ...body }, { status: 201 });
    }

    if (/^\/api\/admin\/ads\/[^/]+$/.test(path) && request.method === 'GET') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const rows = await dbQuery<{ id: string; slot: number; image_url: string; link_url: string | null; active: boolean; created_at: string; updated_at: string }>(
        'SELECT id, slot, image_url, link_url, active, created_at, updated_at FROM ads WHERE id = $1 LIMIT 1',
        [id],
      );
      if (rows.length === 0) {
        return json(request, { error: 'Ad not found' }, { status: 404 });
      }
      return json(request, rows[0]);
    }

    if (/^\/api\/admin\/ads\/[^/]+$/.test(path) && request.method === 'PATCH') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const body = adUpdateSchema.parse(await readJsonBody(request, {}));
      const rows = await dbQuery(
        `UPDATE ads
         SET slot = COALESCE($2, slot),
             image_url = COALESCE($3, image_url),
             link_url = COALESCE($4, link_url),
             active = COALESCE($5, active),
             updated_at = now()
         WHERE id = $1
         RETURNING id, slot, image_url, link_url, active, created_at, updated_at`,
        [id, body.slot ?? null, body.image_url ?? null, body.link_url ?? null, body.active ?? null],
      );
      if (rows.length === 0) {
        return json(request, { error: 'Ad not found' }, { status: 404 });
      }
      return json(request, rows[0]);
    }

    if (/^\/api\/admin\/ads\/[^/]+$/.test(path) && request.method === 'DELETE') {
      const auth = requireRole(request, ['admin']);
      if (auth instanceof Response) return auth;
      const id = path.split('/').pop()!;
      const rows = await dbQuery<{ id: string }>('DELETE FROM ads WHERE id = $1 RETURNING id', [id]);
      if (rows.length === 0) {
        return json(request, { error: 'Ad not found' }, { status: 404 });
      }
      return json(request, { deleted: true });
    }

    return notFound(request);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json(request, { error: 'Validation error', issues: error.issues }, { status: 400 });
    }
    return json(request, { error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
});
