import type { StopRecord } from './types';

export type RailStop = StopRecord;

/**
 * Stops are loaded from the published app snapshot instead of being hardcoded.
 * `setStops()` is called once by `getAppState()` after the snapshot is fetched.
 */
let RAIL_STOPS: RailStop[] = [];
const STOP_INDEX = new Map<string, number>();
const STOP_BY_KEY = new Map<string, RailStop>();

const STREET_TYPES = new Set([
  'st',
  'street',
  'ave',
  'avenue',
  'blvd',
  'boulevard',
  'dr',
  'drive',
  'rd',
  'road',
  'ln',
  'lane',
  'fwy',
  'freeway',
  'pkwy',
  'parkway',
]);

/**
 * Collapses cosmetic differences between stop labels ("50th St / Washington" vs
 * "50th St / Washington St", "Metro Pkwy" vs "Metro Parkway") so records can be
 * matched against the canonical route order.
 */
export function normalizeStopName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[.,'’]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !STREET_TYPES.has(token))
    .join(' ');
}

export function setStops(stops: StopRecord[]): void {
  RAIL_STOPS = [...stops];
  STOP_INDEX.clear();
  STOP_BY_KEY.clear();
  RAIL_STOPS.forEach((stop, index) => {
    const key = normalizeStopName(stop.name);
    if (!STOP_INDEX.has(key)) {
      STOP_INDEX.set(key, index);
      STOP_BY_KEY.set(key, stop);
    }
  });
}

export function getStops(): RailStop[] {
  return RAIL_STOPS;
}

export function findStop(name: string | null | undefined): RailStop | null {
  return STOP_BY_KEY.get(normalizeStopName(name)) ?? null;
}

/** Position of a stop along the route. Unknown stops sort after every known stop. */
export function stopOrder(name: string | null | undefined): number {
  const index = STOP_INDEX.get(normalizeStopName(name));
  return index == null ? Number.MAX_SAFE_INTEGER : index;
}

export function compareStops(a: string | null | undefined, b: string | null | undefined): number {
  const diff = stopOrder(a) - stopOrder(b);
  if (diff !== 0) return diff;
  return (a ?? '').localeCompare(b ?? '');
}

export type StopGroup = {
  city: string;
  stops: { name: string; count: number }[];
};

/**
 * Groups the supplied stop labels by city, keeping route order inside each city and
 * ordering cities by where they first appear along the route.
 */
export function groupStopsByCity(
  entries: { stop: string; count: number; city?: string | null }[],
): StopGroup[] {
  const sorted = [...entries].sort((a, b) => compareStops(a.stop, b.stop));
  const groups: StopGroup[] = [];
  const byCity = new Map<string, StopGroup>();
  for (const entry of sorted) {
    const known = findStop(entry.stop);
    const city = known?.city ?? entry.city?.trim() ?? '';
    const label = city || 'Other stops';
    let group = byCity.get(label);
    if (!group) {
      group = { city: label, stops: [] };
      byCity.set(label, group);
      groups.push(group);
    }
    group.stops.push({ name: entry.stop, count: entry.count });
  }
  return groups;
}
