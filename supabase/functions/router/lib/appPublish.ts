import { dbQuery } from './db.ts';
import { listContentBlocks, getTheme, type ThemeSettings } from './content.ts';
import { getVendorDirectory, type VendorDirectoryItem } from './vendors.ts';
import { listApartments } from './apartments.ts';
import { listRealEstate, type RealEstateRecord } from './realEstate.ts';
import { fetchPublicEvents, type RssEvent } from './events.ts';
import { listStops, type StopRecord } from './stops.ts';

export interface PublicApartment {
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

export interface PublicStop {
  id: string;
  name: string;
  city: string | null;
  line: string | null;
  position: number | null;
  latitude: number | null;
  longitude: number | null;
}

export interface PublicAd {
  id: string;
  slot: number;
  image_url: string;
  link_url: string | null;
  active: boolean;
}

export interface PublicRealEstate {
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

export interface AppState {
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
// Folds row counts and last-modified epochs across every table that feeds the
// snapshot into a single monotonically-changing number.
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
    dbQuery<{ count: number }>("SELECT COUNT(*)::int AS count FROM content_blocks").then((r) => r[0]?.count ?? 0),
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
    // ignore; fall back to zero published counts
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

function toPublicApartment(row: {
  id: string;
  name: string;
  listing_type: 'apartment' | 'hotel';
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
  near_rail: boolean;
  distance_miles: number | null;
  created_at: string;
  updated_at: string;
}): PublicApartment {
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
    listContentBlocks({ publishedOnly: true }),
    getVendorDirectory(),
    listApartments({ nearRail: true }).then((rows) => rows.map(toPublicApartment)),
    listRealEstate({ activeOnly: true }).then((rows) => rows.map(toPublicRealEstate)),
    fetchPublicEvents().catch((err) => {
      console.warn('[publish] events fetch failed, continuing without events:', err);
      return [] as RssEvent[];
    }),
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
