import type { FastifyInstance } from 'fastify';
import { dbQuery } from '../db/pool.js';
import { humanDiscountLabel } from '../services/discounts.js';
import { listApartments, type ApartmentRecord } from './apartments.js';
import { listRealEstate, type RealEstateRecord } from './realEstate.js';
import { listStops, type StopRecord } from './stops.js';
import { fetchPublicEvents, type RssEvent } from './events.js';

interface ThemeTab {
  key: string;
  label: string;
  color: string;
  gradient: [string, string];
}

interface ThemeSettings {
  brand: string;
  primaryGradient: [string, string];
  tabs: ThemeTab[];
}

const DEFAULT_THEME: ThemeSettings = {
  brand: '#0d9488',
  primaryGradient: ['#0d9488', '#6366f1'],
  tabs: [
    { key: 'index', label: 'Home', color: '#0d9488', gradient: ['#14b8a6', '#0d9488'] },
    { key: 'live', label: 'Train Schedule', color: '#f59e0b', gradient: ['#fbbf24', '#d97706'] },
    { key: 'browse', label: 'Browse', color: '#f43f5e', gradient: ['#fb7185', '#e11d48'] },
    { key: 'events', label: 'Events', color: '#8b5cf6', gradient: ['#a78bfa', '#7c3aed'] },
    { key: 'apartments', label: 'Apartments', color: '#f59e0b', gradient: ['#fbbf24', '#d97706'] },
    { key: 'discover', label: 'Discover', color: '#10b981', gradient: ['#34d399', '#059669'] },
    { key: 'profile', label: 'Profile', color: '#0ea5e9', gradient: ['#38bdf8', '#0284c7'] },
  ],
};

function mergeTabs(storedTabs: ThemeTab[] | undefined): ThemeTab[] {
  const stored = Array.isArray(storedTabs) ? storedTabs : [];
  const storedByKey = new Map(stored.map((tab) => [tab.key, tab]));
  return DEFAULT_THEME.tabs.map((tab) => storedByKey.get(tab.key) ?? tab);
}

async function getTheme(): Promise<ThemeSettings> {
  let stored: Partial<ThemeSettings> = DEFAULT_THEME;
  try {
    const rows = await dbQuery<{ value: unknown }>("SELECT value FROM app_settings WHERE key = 'theme' LIMIT 1");
    const value = rows[0]?.value;
    if (typeof value === 'string') {
      stored = { ...DEFAULT_THEME, ...(JSON.parse(value) as Partial<ThemeSettings>) };
    } else if (value && typeof value === 'object') {
      stored = { ...DEFAULT_THEME, ...(value as Partial<ThemeSettings>) };
    }
  } catch {
    stored = DEFAULT_THEME;
  }
  return {
    brand: stored.brand ?? DEFAULT_THEME.brand,
    primaryGradient: stored.primaryGradient ?? DEFAULT_THEME.primaryGradient,
    tabs: mergeTabs(stored.tabs),
  };
}

interface VendorDirectoryItem {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  location: string | null;
  category: string | null;
  vendorType: string | null;
  cuisine: string | null;
  station: string | null;
  latitude: number | null;
  longitude: number | null;
  posSystem: string | null;
  iconUrl: string | null;
  logoUrl: string | null;
  phone: string | null;
  website: string | null;
  membersOnly: boolean;
  discountTerms: string;
  discount: {
    type: 'fixed' | 'percent' | 'bogo';
    value: number;
    label: string;
    discountCode: string | null;
    description: string | null;
    startsAt: string | null;
    endsAt: string | null;
    boosted: boolean;
  };
  discountCode: string | null;
  discountDescription: string | null;
  boosted: boolean;
}

async function getVendorDirectory(): Promise<VendorDirectoryItem[]> {
  const rows = await dbQuery<{
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    location: string | null;
    category: string | null;
    vendor_type: string | null;
    cuisine: string | null;
    station: string | null;
    latitude: number | null;
    longitude: number | null;
    pos_system: string | null;
    icon_url: string | null;
    logo_url: string | null;
    discount_terms: string | null;
    discount_type: string | null;
    discount_value: number | null;
    discount_code: string | null;
    discount_description: string | null;
    starts_at: string | null;
    ends_at: string | null;
    boosted: boolean;
    phone: string | null;
    website: string | null;
    members_only: boolean;
    card_icon: string | null;
    card_logo: string | null;
  }>(
    `SELECT v.id, v.name, v.address, v.city, v.location, v.category, v.vendor_type, v.cuisine, v.station, v.latitude, v.longitude, v.pos_system, v.icon_url, v.logo_url, v.discount_terms,
            v.phone, v.website, d.members_only,
            d.type AS discount_type, d.value AS discount_value, d.discount_code, d.description AS discount_description,
            d.starts_at, d.ends_at, d.boosted, c.id AS card_id, c.icon_url AS card_icon, c.logo_url AS card_logo
     FROM vendors v
     JOIN cards c ON c.is_membership = true AND c.status = 'active'
     JOIN discounts d ON d.vendor_id = v.id AND d.card_id = c.id AND d.active = true
     WHERE v.status = 'approved'
       AND (d.starts_at IS NULL OR d.starts_at <= now())
       AND (d.ends_at IS NULL OR d.ends_at >= now())
     ORDER BY CASE WHEN d.boosted THEN 0 ELSE 1 END, v.station NULLS LAST, v.name`,
  );

  return rows.map((row) => {
    const type = (row.discount_type ?? 'fixed') as 'fixed' | 'percent' | 'bogo';
    const value = Number(row.discount_value ?? 0);
    const label = humanDiscountLabel(type, value);
    return {
      id: row.id,
      name: row.name,
      address: row.address ?? row.location,
      city: row.city,
      location: row.location,
      category: row.category,
      vendorType: row.vendor_type,
      cuisine: row.cuisine,
      station: row.station,
      latitude: row.latitude,
      longitude: row.longitude,
      posSystem: row.pos_system,
      iconUrl: row.icon_url ?? row.card_icon,
      logoUrl: row.logo_url ?? row.card_logo,
      phone: row.phone,
      website: row.website,
      membersOnly: row.members_only,
      discountTerms: row.discount_terms ?? 'Cannot be applied with any other offer\nNot redeemable for cash\nCan be used 1 time per week',
      discount: {
        type,
        value,
        label,
        discountCode: row.discount_code,
        description: row.discount_description,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        boosted: row.boosted,
      },
      discountCode: row.discount_code,
      discountDescription: row.discount_description,
      boosted: row.boosted,
    };
  });
}

interface PublicApartment {
  id: string;
  name: string;
  listingType: 'apartment' | 'hotel';
  section: string | null;
  station: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  nearRail: boolean;
  distanceMiles: number | null;
  createdAt: string;
  updatedAt: string;
}

interface PublicStop {
  id: string;
  name: string;
  city: string | null;
  line: string | null;
  position: number | null;
  latitude: number | null;
  longitude: number | null;
}

interface PublicAd {
  id: string;
  slot: number;
  image_url: string;
  link_url: string | null;
  active: boolean;
}

interface PublicRealEstate {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  propertyType: string | null;
  listingStatus: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  imageUrl: string | null;
  station: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface AppState {
  version: number;
  publishedAt: string;
  content: unknown[];
  vendors: VendorDirectoryItem[];
  apartments: PublicApartment[];
  realEstate: PublicRealEstate[];
  events: RssEvent[];
  theme: ThemeSettings;
  stops: PublicStop[];
  ads: PublicAd[];
}

function parseJsonValue<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return null;
}

export async function getLatestAppSnapshot(): Promise<AppState | null> {
  const rows = await dbQuery<{ version: number; published_at: string; payload: AppState }>(
    'SELECT version, published_at, payload FROM app_published ORDER BY version DESC, published_at DESC LIMIT 1',
  );
  const row = rows[0];
  if (!row) return null;
  const payload = parseJsonValue<AppState>(row.payload);
  if (!payload) return null;
  return { ...payload, version: row.version, publishedAt: row.published_at };
}

export async function getAppVersion(): Promise<{ version: number; publishedAt: string | null }> {
  const rows = await dbQuery<{ version: number; published_at: string }>(
    'SELECT version, published_at FROM app_published ORDER BY version DESC, published_at DESC LIMIT 1',
  );
  return { version: rows[0]?.version ?? 0, publishedAt: rows[0]?.published_at ?? null };
}

// Live fingerprint of the public data set. The app polls this version and
// re-downloads /api/app whenever it changes — which removes the old
// requirement that an admin click "Publish" before edits reach devices.
async function tableFingerprint(table: string, extraWhere = ''): Promise<number> {
  try {
    const rows = await dbQuery<{ n: string | number }>(
      `SELECT (COUNT(*) + COALESCE(EXTRACT(EPOCH FROM MAX(updated_at))::bigint, 0))::bigint AS n FROM ${table} ${extraWhere}`,
    );
    return Number(rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

export async function getLiveAppVersion(): Promise<{ version: number; publishedAt: string | null }> {
  const parts = await Promise.all([
    tableFingerprint('vendors', "WHERE status = 'approved'"),
    tableFingerprint('apartments_hotels', 'WHERE near_rail = true'),
    tableFingerprint('content_blocks', 'WHERE published = true'),
    tableFingerprint('admin_events'),
    tableFingerprint('stops'),
    tableFingerprint('app_settings'),
    tableFingerprint('ads', 'WHERE active = true'),
    tableFingerprint('real_estate', 'WHERE active = true'),
  ]);
  return { version: parts.reduce((sum, n) => sum + n, 0), publishedAt: new Date().toISOString() };
}

export interface AppStatus {
  currentVersion: number;
  publishedAt: string | null;
  publishedCount: number;
  draftCount: number;
  publishedCounts: { vendors: number; apartments: number; events: number; content: number };
  draftCounts: { vendors: number; apartments: number; events: number; content: number };
}

export async function getAppStatus(): Promise<AppStatus> {
  const [version, vendorDrafts, apartmentDrafts, contentDrafts, eventDrafts] = await Promise.all([
    getAppVersion(),
    dbQuery<{ count: number }>("SELECT COUNT(*)::int AS count FROM vendors WHERE status = 'approved'").then((r) => r[0]?.count ?? 0),
    dbQuery<{ count: number }>('SELECT COUNT(*)::int AS count FROM apartments_hotels WHERE near_rail = true').then((r) => r[0]?.count ?? 0),
    dbQuery<{ count: number }>('SELECT COUNT(*)::int AS count FROM content_blocks').then((r) => r[0]?.count ?? 0),
    dbQuery<{ count: number }>('SELECT COUNT(*)::int AS count FROM admin_events').then((r) => r[0]?.count ?? 0),
  ]);

  const publishedCounts = { vendors: 0, apartments: 0, events: 0, content: 0 };
  try {
    const latest = await dbQuery<{ payload: AppState }>(
      'SELECT payload FROM app_published ORDER BY version DESC, published_at DESC LIMIT 1',
    );
    const payload = parseJsonValue<AppState>(latest[0]?.payload);
    if (payload) {
      publishedCounts.vendors = Array.isArray(payload.vendors) ? payload.vendors.length : 0;
      publishedCounts.apartments = Array.isArray(payload.apartments) ? payload.apartments.length : 0;
      publishedCounts.events = Array.isArray(payload.events) ? payload.events.length : 0;
      publishedCounts.content = Array.isArray(payload.content) ? payload.content.length : 0;
    }
  } catch {
    // fall back to zero published counts
  }

  const draftCounts = {
    vendors: vendorDrafts,
    apartments: apartmentDrafts,
    events: eventDrafts,
    content: contentDrafts,
  };

  return {
    currentVersion: version.version,
    publishedAt: version.publishedAt,
    publishedCount: publishedCounts.vendors,
    draftCount: draftCounts.vendors,
    publishedCounts,
    draftCounts,
  };
}

function toPublicApartment(row: ApartmentRecord): PublicApartment {
  return {
    id: row.id,
    name: row.name,
    listingType: row.listing_type,
    section: row.section,
    station: row.station,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    phone: row.phone,
    website: row.website,
    latitude: row.latitude,
    longitude: row.longitude,
    nearRail: row.near_rail,
    distanceMiles: row.distance_miles,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPublicStop(row: StopRecord): PublicStop {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    line: row.line,
    position: row.position,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

function toPublicRealEstate(row: RealEstateRecord): PublicRealEstate {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: row.price,
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft,
    propertyType: row.property_type,
    listingStatus: row.listing_status,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    phone: row.phone,
    email: row.email,
    website: row.website,
    imageUrl: row.image_url,
    station: row.station,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

// Assembles the full public app state directly from the live tables. Served
// by GET /api/app so admin edits reach devices immediately — no publish step.
export async function buildLiveAppState(): Promise<AppState> {
  const [content, vendors, apartments, realEstate, events, theme, stops, ads] = await Promise.all([
    dbQuery('SELECT id, kind, title, body, url, position, published, created_at, updated_at FROM content_blocks WHERE published = true ORDER BY position ASC, created_at DESC'),
    getVendorDirectory(),
    listApartments({ nearRail: true }).then((rows) => rows.map(toPublicApartment)),
    listRealEstate({ activeOnly: true }).then((rows) => rows.map(toPublicRealEstate)),
    fetchPublicEvents().catch(() => [] as RssEvent[]),
    getTheme(),
    listStops().then((rows) => rows.map(toPublicStop)),
    dbQuery<PublicAd>(
      'SELECT id, slot, image_url, link_url, active FROM ads WHERE active = true ORDER BY slot',
    ).catch(() => [] as PublicAd[]),
  ]);

  return {
    version: 0,
    publishedAt: new Date().toISOString(),
    content,
    vendors,
    apartments,
    realEstate,
    events,
    theme,
    stops,
    ads,
  };
}

export async function publishApp(): Promise<{ version: number; publishedAt: string }> {
  const publishedAt = new Date().toISOString();
  const payload = { ...(await buildLiveAppState()), publishedAt };

  const result = await dbQuery<{ version: number; published_at: string }>(
    `INSERT INTO app_published (version, published_at, payload)
     SELECT COALESCE(MAX(version), 0) + 1, $1, $2::jsonb
     FROM app_published
     RETURNING version, published_at`,
    [publishedAt, payload],
  );

  const row = result[0];
  if (!row) {
    throw new Error('Publish failed: no row returned from app_published insert');
  }

  return { version: row.version, publishedAt: row.published_at };
}

export async function registerAppPublishRoutes(fastify: FastifyInstance): Promise<void> {
  // Public: live snapshot of the public app state. Built fresh from the tables
  // on every request so admin edits reach devices immediately — the manual
  // publish step is no longer required. Falls back to the last published
  // snapshot if the live build fails (e.g. a transient DB issue).
  fastify.get('/api/app', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    try {
      return await buildLiveAppState();
    } catch (err) {
      request.log.error({ err }, '[app] live state build failed, falling back to snapshot');
      const snapshot = await getLatestAppSnapshot();
      if (!snapshot) return reply.code(404).send({ error: 'No published app state' });
      return snapshot;
    }
  });

  fastify.get('/api/app/version', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async () => getLiveAppVersion());

  fastify.get(
    '/api/admin/app/status',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async () => getAppStatus(),
  );

  fastify.post(
    '/api/admin/app/publish',
    { preHandler: fastify.requireRole(['admin']), config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const result = await publishApp();
      return reply.code(201).send(result);
    },
  );
}
