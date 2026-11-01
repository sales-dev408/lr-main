import { getApiBaseUrl } from './config';
import { ApiError } from './errors';
import { fetchCached } from './cache';
import type {
  Ad,
  AdminAuthProfile,
  ApartmentRecord,
  AppState,
  AuthResponse,
  ContentBlock,
  ContentKind,
  DiscountType,
  ErrorShape,
  RealEstateRecord,
  RssEvent,
  StopRecord,
  ThemeSettings,
  VendorListItem,
} from './types';
import { setStops } from './stops';
import { getItem, setItem } from './storage';

const PUSH_TOKEN_KEY = 'lr.mobile.pushToken';



function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Maps a free-text vendor category ("Mexican", "Sports Bar", "Coffee", ...) to
// the canonical vendor_type values used by the Browse type filters.
export function inferVendorType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === 'restaurant' || lower === 'bar' || lower === 'cafe' || lower === 'other' || lower === 'beauty' || lower === 'boutique' || lower === 'services') return lower;
  if (/(beauty|barber|salon|nail|lash|brow|spa\b|hair)/i.test(raw)) return 'beauty';
  if (/boutique/i.test(raw)) return 'boutique';
  if (/(bar|pub|brew|tavern|lounge|cocktail|wine|beer|rooftop|live music)/i.test(raw)) return 'bar';
  if (/(caf|coffee)/i.test(raw)) return 'cafe';
  if (/(convenience|market|store|retail|shop|sport|entertainment|music)/i.test(raw)) return 'other';
  return 'restaurant';
}






async function parseError(response: Response): Promise<{ code: string; message: string }> {
  try {
    const body = (await response.json()) as ErrorShape;
    if (typeof body.error === 'string') {
      return { code: 'api_error', message: body.error };
    }
    if (body.error && typeof body.error === 'object') {
      return {
        code: typeof body.error.code === 'string' ? body.error.code : 'api_error',
        message: typeof body.error.message === 'string' ? body.error.message : response.statusText || 'Request failed',
      };
    }
    return { code: 'api_error', message: response.statusText || 'Request failed' };
  } catch {
    return { code: 'api_error', message: response.statusText || 'Request failed' };
  }
}

function normalizeDiscountType(value: unknown): DiscountType {
  return value === 'fixed' || value === 'percent' || value === 'bogo' ? value : 'fixed';
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  // Never serve stale admin content, theme, vendors, or card data from caches.
  // Use the fetch cache option instead of Cache-Control/Pragma headers so the
  // request stays a simple CORS request and avoids an extra preflight.
  const method = init.method?.toUpperCase() ?? 'GET';
  const fetchInit: RequestInit = { ...init };
  if (method === 'GET' && !fetchInit.cache) {
    fetchInit.cache = 'no-store';
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
      ...fetchInit,
      headers,
    });
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : 'API unreachable', 0, 'network_error');
  }

  if (!response.ok) {
    const parsed = await parseError(response);
    throw new ApiError(parsed.message, response.status, parsed.code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}



function normalizeVendor(input: Record<string, unknown>): VendorListItem {
  const discount = isRecord(input.discount) ? input.discount : {};
  return {
    id: String(input.id),
    name: String(input.name),
    address: (input.address as string | null | undefined) ?? null,
    city: (input.city as string | null | undefined) ?? null,
    category: (input.category as string | null | undefined) ?? null,
    latitude: input.latitude == null ? null : Number(input.latitude),
    longitude: input.longitude == null ? null : Number(input.longitude),
    posSystem: (input.posSystem as string | null | undefined) ?? null,
    iconUrl: (input.iconUrl as string | null | undefined) ?? null,
    logoUrl: (input.logoUrl as string | null | undefined) ?? null,
    phone: (input.phone as string | null | undefined) ?? null,
    website: (input.website as string | null | undefined) ?? null,
    membersOnly: Boolean(input.membersOnly),
    discount: {
      type: normalizeDiscountType(discount.type),
      value: toNumber(discount.value),
      label: String(discount.label ?? ''),
      description: (discount.description as string | null | undefined) ?? null,
    },
    discountCode: (input.discountCode as string | null | undefined) ?? null,
    discountTerms: String(input.discountTerms ?? 'Cannot be applied with any other offer\nNot redeemable for cash\nCan be used 1 time per week'),
    discountDescription: (input.discountDescription as string | null | undefined) ?? null,
    boosted: Boolean(input.boosted),
    startsAt: (input.startsAt as string | null | undefined) ?? null,
    endsAt: (input.endsAt as string | null | undefined) ?? null,
    cardId: String(input.cardId ?? ''),
    walletUrl: input.walletUrl == null ? null : String(input.walletUrl),
    vendorType: inferVendorType(input.vendorType ?? input.vendor_type ?? input.category),
    cuisine: (input.cuisine as string | null | undefined) ?? null,
    station: (input.station as string | null | undefined) ?? null,
  };
}

function normalizeApartment(input: Record<string, unknown>): ApartmentRecord {
  const rawType = input.listingType ?? input.listing_type;
  return {
    id: String(input.id),
    name: String(input.name),
    listingType: rawType === 'hotel' ? 'hotel' : 'apartment',
    section: (input.section as string | null | undefined) ?? null,
    station: (input.station as string | null | undefined) ?? null,
    address: (input.address as string | null | undefined) ?? null,
    city: (input.city as string | null | undefined) ?? null,
    state: (input.state as string | null | undefined) ?? null,
    zip: (input.zip as string | null | undefined) ?? null,
    phone: (input.phone as string | null | undefined) ?? null,
    website: (input.website as string | null | undefined) ?? null,
    latitude: input.latitude == null ? null : Number(input.latitude),
    longitude: input.longitude == null ? null : Number(input.longitude),
    nearRail: Boolean(input.nearRail ?? input.near_rail),
    distanceMiles: toNullableNumber(input.distanceMiles ?? input.distance_miles),
  };
}

function normalizeRealEstate(input: Record<string, unknown>): RealEstateRecord {
  return {
    id: String(input.id),
    title: String(input.title),
    description: (input.description as string | null | undefined) ?? null,
    price: toNullableNumber(input.price),
    beds: toNullableNumber(input.beds),
    baths: toNullableNumber(input.baths),
    sqft: toNullableNumber(input.sqft),
    propertyType: (input.propertyType as string | null | undefined) ?? (input.property_type as string | null | undefined) ?? null,
    listingStatus: String(input.listingStatus ?? input.listing_status ?? 'for_sale'),
    address: (input.address as string | null | undefined) ?? null,
    city: (input.city as string | null | undefined) ?? null,
    state: (input.state as string | null | undefined) ?? null,
    zip: (input.zip as string | null | undefined) ?? null,
    phone: (input.phone as string | null | undefined) ?? null,
    email: (input.email as string | null | undefined) ?? null,
    website: (input.website as string | null | undefined) ?? null,
    imageUrl: (input.imageUrl as string | null | undefined) ?? (input.image_url as string | null | undefined) ?? null,
    station: (input.station as string | null | undefined) ?? null,
    latitude: input.latitude == null ? null : Number(input.latitude),
    longitude: input.longitude == null ? null : Number(input.longitude),
  };
}

function normalizeStop(input: Record<string, unknown>): StopRecord {
  return {
    id: String(input.id),
    name: String(input.name),
    city: (input.city as string | null | undefined) ?? null,
    line: (input.line as string | null | undefined) ?? null,
    position: toNullableNumber(input.position),
    latitude: input.latitude == null ? null : Number(input.latitude),
    longitude: input.longitude == null ? null : Number(input.longitude),
    createdAt: typeof input.createdAt === 'string' ? input.createdAt : undefined,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : undefined,
  };
}

const APP_STATE_VERSION_KEY = 'lr.mobile.app.version';
const APP_STATE_DATA_KEY = 'lr.mobile.app.data';
const VERSION_CHECK_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Bundled seed snapshot, generated by scripts/generate-app-seed.mjs and shipped
// inside the app binary. Only used when there is no cached snapshot AND the
// backend is unreachable — a first launch while offline. All subsequent loads
// use the AsyncStorage snapshot refreshed by the version check.
const bundledSeed = require('../assets/app-snapshot.json') as Record<string, unknown> | null;

let versionCache: { version: string; at: number } | null = null;

export function clearVersionCache(): void {
  versionCache = null;
}

function normalizeAppState(raw: Record<string, unknown>): AppState {
  return {
    version: toNumber(raw.version),
    publishedAt: String(raw.publishedAt ?? ''),
    content: Array.isArray(raw.content) ? (raw.content as ContentBlock[]) : [],
    vendors: Array.isArray(raw.vendors) ? (raw.vendors as Record<string, unknown>[]).map(normalizeVendor) : [],
    apartments: Array.isArray(raw.apartments) ? (raw.apartments as Record<string, unknown>[]).map(normalizeApartment) : [],
    realEstate: Array.isArray(raw.realEstate) ? (raw.realEstate as Record<string, unknown>[]).map(normalizeRealEstate) : [],
    events: Array.isArray(raw.events) ? (raw.events as RssEvent[]) : [],
    theme: (raw.theme as ThemeSettings) ?? ({} as ThemeSettings),
    stops: Array.isArray(raw.stops) ? (raw.stops as Record<string, unknown>[]).map(normalizeStop) : [],
    ads: Array.isArray(raw.ads) ? (raw.ads as Ad[]) : [],
  };
}

async function fetchMissingStops(state: AppState): Promise<void> {
  if (state.stops.length > 0) return;
  try {
    const stopsRaw = await apiRequest<Record<string, unknown>[]>('/stops');
    state.stops = stopsRaw.map(normalizeStop);
  } catch {
    // Backend doesn't expose /stops; continue with empty stops.
  }
}

export async function getAppState(): Promise<AppState | null> {
  let currentVersion = '0';
  try {
    if (versionCache && Date.now() - versionCache.at < VERSION_CHECK_TTL_MS) {
      currentVersion = versionCache.version;
    } else {
      const versionRes = await apiRequest<{ version: number; publishedAt: string | null }>('/app/version');
      currentVersion = String(versionRes.version);
      versionCache = { version: currentVersion, at: Date.now() };
    }
  } catch {
    // Backend is unavailable; fall through and try the cached version below.
  }

  const cachedVersion = await getItem(APP_STATE_VERSION_KEY);
  const cachedData = await getItem(APP_STATE_DATA_KEY);
  if (cachedVersion === currentVersion && cachedData) {
    try {
      const cached = JSON.parse(cachedData) as AppState;
      // Ensure stops are populated even on a cache hit so the stop picker
      // and vendor grouping work on every app launch, not just the first.
      if (!cached.stops || cached.stops.length === 0) {
        await fetchMissingStops(cached);
      }
      setStops(cached?.stops ?? []);
      return cached;
    } catch {
      // ignore parse error and fetch fresh below
    }
  }

  try {
    const raw = await apiRequest<Record<string, unknown>>('/app');
    const state = normalizeAppState(raw);
    // Fallback: older published snapshots may not include stops. Fetch them
    // directly so the stop picker and vendor grouping work regardless.
    await fetchMissingStops(state);
    setStops(state.stops);
    await setItem(APP_STATE_VERSION_KEY, currentVersion);
    await setItem(APP_STATE_DATA_KEY, JSON.stringify(state));
    return state;
  } catch {
    if (cachedData) {
      try {
        const state = JSON.parse(cachedData) as AppState;
        // Same fallback for cached snapshots that predate the stops field.
        if (!state.stops || state.stops.length === 0) {
          await fetchMissingStops(state);
        }
        setStops(state?.stops ?? []);
        return state;
      } catch {
        // ignore
      }
    }
    // Last resort: the seed bundled inside the app binary keeps directory
    // browsing alive on a first launch without connectivity.
    if (bundledSeed) {
      try {
        const state = normalizeAppState(bundledSeed);
        setStops(state.stops);
        return state;
      } catch {
        // ignore
      }
    }
    return null;
  }
}

export async function listVendors(params: { category?: string; station?: string } = {}): Promise<VendorListItem[]> {
  const state = await getAppState();
  let vendors = state?.vendors ?? [];
  if (vendors.length === 0) {
    const legacy = await apiRequest<Record<string, unknown>[]>('/vendors');
    vendors = legacy.map(normalizeVendor);
  }
  if (params.category) {
    vendors = vendors.filter((v) => v.vendorType === params.category || v.category === params.category);
  }
  if (params.station) {
    vendors = vendors.filter((v) => v.station === params.station);
  }
  return vendors;
}

export async function listRealEstate(): Promise<RealEstateRecord[]> {
  const state = await getAppState();
  return state?.realEstate ?? [];
}

export async function listApartments(): Promise<ApartmentRecord[]> {
  const state = await getAppState();
  if (state?.apartments?.length) {
    return state.apartments;
  }
  const legacy = await apiRequest<Record<string, unknown>[]>('/apartments');
  return legacy.map(normalizeApartment);
}




// Fetches (creating if needed) the current member's single membership pass.

// Ensures the member's membership pass exists and returns it. `cardId` is
// accepted for backwards compatibility but ignored — there is one membership
// pass per user.





// ---- CMS content + theme --------------------------------------------------

export async function listAds(): Promise<Ad[]> {
  const state = await getAppState();
  if (state?.ads) {
    return state.ads;
  }
  return fetchCached('ads', () => apiRequest<Ad[]>('/ads'), 60 * 1000);
}

export async function getAppTheme(): Promise<ThemeSettings> {
  const state = await getAppState();
  if (state?.theme) {
    return state.theme;
  }
  return fetchCached('theme', () => apiRequest<ThemeSettings>('/settings/theme'), 5 * 60 * 1000);
}

export async function listPublishedContent(): Promise<ContentBlock[]> {
  const state = await getAppState();
  if (state?.content) {
    return state.content;
  }
  // Legacy fallback: content has its own version/cache keys.
  let currentVersion = '0';
  try {
    const versionRes = await apiRequest<{ version: number; publishedAt: string | null }>('/content/version');
    currentVersion = String(versionRes.version);
  } catch {
    // Backend unavailable; fall through to cached version below.
  }

  const CONTENT_VERSION_KEY = 'lr.mobile.publishedContent.version';
  const CONTENT_DATA_KEY = 'lr.mobile.publishedContent.data';
  const cachedVersion = await getItem(CONTENT_VERSION_KEY);
  const cachedData = await getItem(CONTENT_DATA_KEY);
  if (cachedVersion === currentVersion && cachedData) {
    try {
      return JSON.parse(cachedData) as ContentBlock[];
    } catch {
      // ignore
    }
  }

  const content = await apiRequest<ContentBlock[]>('/content');
  await setItem(CONTENT_DATA_KEY, JSON.stringify(content));
  await setItem(CONTENT_VERSION_KEY, currentVersion);
  return content;
}

export async function getEvents(): Promise<RssEvent[]> {
  const state = await getAppState();
  if (state?.events?.length) {
    return state.events;
  }
  return fetchCached('events', () => apiRequest<RssEvent[]>('/events'), 15 * 60 * 1000);
}

// Public endpoint — records the first-run legal acceptance server-side with
// the request IP. Sends the stored bearer token when present so the row links
// to the account.
export async function recordLegalAcceptance(platform: string) {
  return apiRequest<{ recorded: boolean }>('/legal/acceptance', {
    method: 'POST',
    body: JSON.stringify({ platform }),
  });
}


export async function registerPushToken(token: string) {
  await setItem(PUSH_TOKEN_KEY, token);
  return apiRequest('/push/register', { method: 'POST', body: JSON.stringify({ token, platform: 'expo' }) });
}

export async function unregisterPushToken(token?: string) {
  const t = token ?? (await getItem(PUSH_TOKEN_KEY));
  if (!t) return;
  return apiRequest('/push/unregister', { method: 'POST', body: JSON.stringify({ token: t }) });
}



// ---- In-app admin editing -------------------------------------------------
// The app presents the first/last-name inputs as the credential fields, but the
// values are always validated server-side by the admin login endpoint.

export async function adminLogin(body: { email: string; password: string }) {
  return apiRequest<AuthResponse<AdminAuthProfile>>('/auth/admin/login', { method: 'POST', body: JSON.stringify(body) });
}

function adminHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function adminListContent(token: string) {
  return apiRequest<ContentBlock[]>('/admin/content', { headers: adminHeaders(token) });
}

export async function adminCreateContent(
  token: string,
  body: { kind: ContentKind; title: string; body?: string; url?: string; position?: number; published?: boolean },
) {
  return apiRequest<ContentBlock>('/admin/content', { method: 'POST', headers: adminHeaders(token), body: JSON.stringify(body) });
}

export async function adminUpdateContent(
  token: string,
  id: string,
  body: Partial<{ kind: ContentKind; title: string; body: string; url: string; position: number; published: boolean }>,
) {
  return apiRequest<ContentBlock>(`/admin/content/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: adminHeaders(token),
    body: JSON.stringify(body),
  });
}

export async function adminDeleteContent(token: string, id: string) {
  return apiRequest<{ deleted: boolean }>(`/admin/content/${encodeURIComponent(id)}`, { method: 'DELETE', headers: adminHeaders(token) });
}

export async function adminSaveTheme(token: string, theme: ThemeSettings) {
  return apiRequest<ThemeSettings>('/admin/settings/theme', { method: 'PATCH', headers: adminHeaders(token), body: JSON.stringify(theme) });
}



export interface RedemptionToken {
  token: string;
  url: string;
  vendorName: string;
  discountLabel: string;
  discountDescription: string;
  terms: string;
  amountApplied: number;
  expiresAt: string;
}

export async function createRedemptionToken(vendorId: string): Promise<RedemptionToken> {
  return apiRequest<RedemptionToken>('/discounts/tokens', { method: 'POST', body: JSON.stringify({ vendorId }) });
}

export async function affirmRedemptionToken(token: string, affirmationName: string): Promise<{ ok: boolean; discountLabel: string; amountApplied: number; redemptionId: string }> {
  return apiRequest(`/discounts/tokens/${encodeURIComponent(token)}/affirm`, { method: 'POST', body: JSON.stringify({ affirmationName }) });
}

export interface PasswordResetRequest {
  message: string;
  verificationCode?: string;
}

export interface PasswordReset {
  success: boolean;
}


