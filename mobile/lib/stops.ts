export type RailLine = 'A Line' | 'B Line';

export type RailStop = {
  name: string;
  city: string;
  line: RailLine;
};

/**
 * Valley Metro rail stops in route order. This list is the authoritative ordering
 * used everywhere stops (and the vendors/apartments attached to them) are listed.
 * Never sort these alphabetically.
 */
export const RAIL_STOPS: RailStop[] = [
  // A Line — westernmost Phoenix terminus east through Tempe to Mesa.
  { name: 'Downtown Phx Hub / Jefferson St', city: 'Phoenix', line: 'A Line' },
  { name: 'Downtown Phx Hub / Washington St', city: 'Phoenix', line: 'A Line' },
  { name: '3rd St / Jefferson', city: 'Phoenix', line: 'A Line' },
  { name: '3rd St / Washington', city: 'Phoenix', line: 'A Line' },
  { name: '12th St / Jefferson', city: 'Phoenix', line: 'A Line' },
  { name: '12th St / Washington', city: 'Phoenix', line: 'A Line' },
  { name: '24th St / Jefferson', city: 'Phoenix', line: 'A Line' },
  { name: '24th St / Washington', city: 'Phoenix', line: 'A Line' },
  { name: '38th St / Washington', city: 'Phoenix', line: 'A Line' },
  { name: '44th St / Washington', city: 'Phoenix', line: 'A Line' },
  { name: '50th St / Washington St', city: 'Phoenix', line: 'A Line' },
  { name: 'Priest Dr / Washington St', city: 'Tempe', line: 'A Line' },
  { name: 'Center Pkwy / Washington', city: 'Tempe', line: 'A Line' },
  { name: 'Veterans Way / College Ave', city: 'Tempe', line: 'A Line' },
  { name: 'Mill Ave / 3rd St', city: 'Tempe', line: 'A Line' },
  { name: 'University Dr / Rural Rd', city: 'Tempe', line: 'A Line' },
  { name: 'Dorsey Ln / Apache Blvd', city: 'Tempe', line: 'A Line' },
  { name: 'McClintock Dr / Apache Blvd', city: 'Tempe', line: 'A Line' },
  { name: 'Smith-Martin / Apache Blvd', city: 'Tempe', line: 'A Line' },
  { name: 'Price-101 Fwy / Apache Blvd', city: 'Tempe', line: 'A Line' },
  { name: 'Sycamore / Main St', city: 'Mesa', line: 'A Line' },
  { name: 'Alma School / Main St', city: 'Mesa', line: 'A Line' },
  { name: 'Country Club / Main St', city: 'Mesa', line: 'A Line' },
  { name: 'Center / Main St', city: 'Mesa', line: 'A Line' },
  { name: 'Mesa Dr / Main St', city: 'Mesa', line: 'A Line' },
  { name: 'Stapley Dr / Main St', city: 'Mesa', line: 'A Line' },
  { name: 'Gilbert Rd / Main St', city: 'Mesa', line: 'A Line' },

  // B Line — south Phoenix north to Metro Parkway.
  { name: 'Baseline / Central Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Southern / Central Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Roeser / Central Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Broadway / Central Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Buckeye / Central Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Lincoln / Central Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Lincoln / 1st Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Jefferson / 1st Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Washington / Central Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Downtown Phx Hub / Central Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Downtown Phx Hub / 1st Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Van Buren / Central Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Van Buren / 1st Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Roosevelt / Central Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'McDowell / Central Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Encanto / Central Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Thomas / Central Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Osborn / Central Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Indian School / Central Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Campbell / Central Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Central Ave / Camelback', city: 'Phoenix', line: 'B Line' },
  { name: '7th Ave / Camelback', city: 'Phoenix', line: 'B Line' },
  { name: '19th Ave / Camelback', city: 'Phoenix', line: 'B Line' },
  { name: 'Montebello / 19th Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Glendale / 19th Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Northern / 19th Ave', city: 'Phoenix', line: 'B Line' },
  { name: '19th Ave / Dunlap', city: 'Phoenix', line: 'B Line' },
  { name: 'Dunlap / 25th Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Mountain View / 25th Ave', city: 'Phoenix', line: 'B Line' },
  { name: 'Metro Parkway', city: 'Phoenix', line: 'B Line' },
];

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
    .replace(/[./,'’]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !STREET_TYPES.has(token))
    .join(' ');
}

const STOP_INDEX = new Map<string, number>();
const STOP_BY_KEY = new Map<string, RailStop>();
RAIL_STOPS.forEach((stop, index) => {
  const key = normalizeStopName(stop.name);
  if (!STOP_INDEX.has(key)) {
    STOP_INDEX.set(key, index);
    STOP_BY_KEY.set(key, stop);
  }
});

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
