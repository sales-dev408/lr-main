import { dbQuery } from './db.ts';
import { listContentBlocks, getTheme, type ThemeSettings } from './content.ts';
import { getVendorDirectory, type VendorDirectoryItem } from './vendors.ts';
import { listApartments } from './apartments.ts';
import { fetchPublicEvents, type RssEvent } from './events.ts';

export interface PublicApartment {
  id: string;
  name: string;
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

export interface AppState {
  version: number;
  publishedAt: string;
  content: unknown[];
  vendors: VendorDirectoryItem[];
  apartments: PublicApartment[];
  events: RssEvent[];
  theme: ThemeSettings;
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

export async function publishApp(): Promise<{ version: number; publishedAt: string }> {
  const [content, vendors, apartments, events, theme] = await Promise.all([
    listContentBlocks({ publishedOnly: true }),
    getVendorDirectory(),
    listApartments({ nearRail: true }).then((rows) => rows.map(toPublicApartment)),
    fetchPublicEvents().catch((err) => {
      console.warn('[publish] events fetch failed, continuing without events:', err);
      return [] as RssEvent[];
    }),
    getTheme(),
  ]);

  const publishedAt = new Date().toISOString();
  const payload: AppState = {
    version: 0,
    publishedAt,
    content,
    vendors,
    apartments,
    events,
    theme,
  };

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
