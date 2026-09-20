import { config } from '../config.js';
import { withDbClient, closePool } from './pool.js';

// One-off import of the "Restaurants & Bars by Rail Stop" list (Phoenix, Tempe,
// Mesa). Keys are the exact `stops.name` values from the database so every
// vendor lands on the correct light-rail stop.
interface SeedVendor {
  name: string;
  address: string;
  phone: string | null;
  category: string;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomSuffix(length = 4): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) out += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return out;
}

function generateDiscountCode(merchantName: string): string {
  const cleaned = merchantName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const merchant = (cleaned.length >= 6 ? cleaned.slice(0, 6) : (cleaned + randomSuffix(6)).slice(0, 6));
  return `VEND-${merchant}-0PCT-${randomSuffix(4)}`;
}

// Mirrors lib/vendors.ts inferVendorType/inferCuisine.
function inferVendorType(category: string | null | undefined): string | null {
  if (!category) return null;
  const raw = category.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === 'restaurant' || lower === 'bar' || lower === 'cafe' || lower === 'other') return lower;
  if (/(bar|pub|brew|tavern|lounge|cocktail|wine|beer|rooftop|live music)/i.test(raw)) return 'bar';
  if (/(caf|coffee)/i.test(raw)) return 'cafe';
  if (/(convenience|market|store|retail|shop|sport|entertainment|music)/i.test(raw)) return 'other';
  return 'restaurant';
}

function inferCuisine(category: string | null | undefined, vendorType: string | null): string | null {
  if (!category || vendorType !== 'restaurant') return null;
  const raw = category.trim();
  if (!raw || /^(restaurant|dining|food)$/i.test(raw)) return null;
  return raw.toLowerCase();
}

const DEFAULT_TERMS = 'Cannot be applied with any other offer\nNot redeemable for cash\nCan be used 1 time per week';

const vendorsByStation: Record<string, SeedVendor[]> = {
  // ---- Phoenix ----
  'Downtown Phx Hub / Jefferson St': [
    { name: 'Eden Rooftop Bar', address: '2 E Jefferson St, Phoenix, AZ 85004', phone: '602-258-0231', category: 'Rooftop bar / cocktails / Mediterranean' },
    { name: "Pa'La Kitchen", address: '132 E Washington St, Phoenix, AZ 85004', phone: '602-368-3052', category: 'Mediterranean / seafood / wood-fired' },
  ],
  '12th St / Jefferson': [
    { name: "Mrs. White's Golden Rule Cafe", address: "Mrs. White's Golden Rule Cafe, Phoenix, AZ", phone: null, category: 'Soul food / Southern' },
  ],
  '24th St / Washington': [
    { name: 'Menuderia Guanajuato', address: 'Menuderia Guanajuato, Phoenix, AZ', phone: null, category: 'Mexican / soups' },
  ],
  '38th St / Washington': [
    { name: "Phoenix Park 'n Swap", address: '3801 E Washington St, Phoenix, AZ 85034', phone: '602-273-1250', category: 'Food trucks / Mexican / casual food / beer & cocktails' },
    { name: 'Mesquite Fresh Street Mex', address: '4002 E Washington St, Phoenix, AZ 85034', phone: '602-231-0800', category: 'Mexican / tacos / 24-hour restaurant' },
    { name: 'Knock Kneed Lobster', address: '3202 E Washington St, Phoenix, AZ 85034', phone: '602-273-1068', category: 'Seafood / fish & chips' },
  ],
  '44th St / Washington': [
    { name: 'The Perch Restaurant & Lounge', address: '4300 E Washington St, Phoenix, AZ 85034', phone: '602-273-7778', category: 'American / hotel restaurant / cocktails' },
    { name: 'The Post', address: '4300 E Washington St, Phoenix, AZ 85034', phone: '602-273-7778', category: 'American / breakfast / hotel restaurant' },
  ],
  '50th St / Washington St': [
    { name: 'The Stockyards Steakhouse & 1889 Saloon', address: '5009 E Washington St, Phoenix, AZ 85034', phone: '602-273-7378', category: 'Steakhouse / American / historic saloon & bar' },
  ],
  // ---- Tempe ----
  'Priest Dr / Washington St': [
    { name: 'Princess Pita', address: '1201 W Washington St, Tempe, AZ 85281', phone: '480-921-4100', category: 'Mediterranean / Middle Eastern' },
    { name: 'Starbucks', address: '1158 W Washington St, Tempe, AZ 85288', phone: '602-225-0212', category: 'Coffee / breakfast / pastries' },
    { name: "Papago's Cafe Grill & Deli", address: '1500 N Priest Dr, Tempe, AZ 85281', phone: '480-273-9044', category: 'Deli / breakfast / lunch' },
  ],
  'Mill Ave / 3rd St': [
    { name: 'Loco Patron', address: '222 S Mill Ave #115, Tempe, AZ 85281', phone: '480-699-0922', category: 'Mexican / bar' },
    { name: 'Caffe Boa', address: '398 S Mill Ave, Tempe, AZ 85281', phone: '480-968-9112', category: 'Italian / wine bar' },
    { name: 'Cornish Pasty Co.', address: '425 S Mill Ave #111, Tempe, AZ 85281', phone: '480-284-5442', category: 'British pub / pasties / full bar' },
    { name: 'Snakes & Lattes', address: '20 W 6th St, Tempe, AZ 85281', phone: '480-361-6644', category: 'Board-game bar / American / café' },
    { name: 'Sunbar', address: '24 W 5th St, Tempe, AZ 85281', phone: null, category: 'Nightclub / bar / live music' },
    { name: 'Pedal Haus Brewery', address: '730 S Mill Ave #102, Tempe, AZ 85281', phone: '480-314-2337', category: 'Brewery / burgers / pizza / pub' },
    { name: 'Filthy Animal', address: '740 S Mill Ave #140, Tempe, AZ 85281', phone: '480-397-1046', category: 'Live-fire / contemporary American' },
  ],
  'Veterans Way / College Ave': [
    { name: 'Alter Ego', address: '108 E University Dr, Tempe, AZ 85281', phone: '602-612-7871', category: 'Asian-inspired / American / cocktails' },
    { name: 'Alibi', address: '108 E University Dr, Tempe, AZ 85281', phone: '602-612-7872', category: 'Rooftop bar / cocktails' },
    { name: 'Postino Annex', address: '615 S College Ave, Tempe, AZ 85281', phone: '480-927-1111', category: 'Wine bar / bruschetta / Italian-inspired' },
    { name: "Casey Moore's Oyster House", address: '850 S Ash Ave, Tempe, AZ 85281', phone: null, category: 'Seafood / oysters / Irish pub' },
  ],
  'University Dr / Rural Rd': [
    { name: 'Blanco Cocina + Cantina', address: '717 S Novus Pl, Tempe, AZ 85281', phone: '480-366-3717', category: 'Mexican / cocktails' },
    { name: 'Blue Sushi Sake Grill', address: '690 S Novus Pl #183, Tempe, AZ 85281', phone: '480-977-2583', category: 'Sushi / Japanese / sake' },
    { name: 'Eureka! Tempe', address: '690 S Novus Pl #173, Tempe, AZ 85281', phone: '602-242-4431', category: 'American / burgers / cocktails' },
    { name: 'North Italia', address: '697 S Novus Pl, Tempe, AZ 85281', phone: '928-588-1007', category: 'Italian / pizza / pasta' },
    { name: 'Flower Child', address: '737 S Novus Pl, Tempe, AZ 85281', phone: '480-366-3030', category: 'Healthy / bowls / salads / vegetarian' },
    { name: 'The Melt', address: '777 S Novus Pl #111, Tempe, AZ 85281', phone: '480-660-9716', category: 'Burgers / grilled cheese / sandwiches' },
    { name: 'Over Easy', address: '690 S Novus Pl #187, Tempe, AZ 85281', phone: '480-912-6294', category: 'Breakfast / brunch' },
    { name: 'Nautical Bowls', address: '690 S Novus Pl #185, Tempe, AZ 85281', phone: '602-647-5146', category: 'Açaí / smoothie bowls' },
    { name: 'The Alley Tempe', address: '707 E 6th St, Tempe, AZ 85281', phone: '602-869-9353', category: 'Boba / tea / snacks' },
    { name: 'Salt & Straw', address: '690 S Novus Pl #175, Tempe, AZ 85281', phone: '602-898-1455', category: 'Ice cream / dessert' },
    { name: 'First Watch', address: '111 W University Dr, Tempe, AZ 85281', phone: '480-498-4100', category: 'Breakfast / brunch / lunch' },
    { name: 'The Chuckbox', address: '202 E University Dr, Tempe, AZ 85281', phone: '480-968-4712', category: 'Mesquite burgers / American' },
    { name: 'Original ChopShop', address: '222 E University Dr, Tempe, AZ 85281', phone: '480-307-9336', category: 'Healthy / bowls / salads / sandwiches' },
    { name: 'Society', address: '920 E University Dr #204, Tempe, AZ 85281', phone: '480-550-7801', category: 'Italian / Mediterranean / cocktails' },
    { name: 'CAVA', address: '920 E University Dr, Tempe, AZ 85288', phone: '480-480-5504', category: 'Mediterranean / bowls / pitas' },
    { name: 'Sushi 101', address: '1435 E University Dr, Tempe, AZ 85281', phone: '480-317-0101', category: 'Sushi / Japanese' },
    { name: 'Delhi Palace', address: 'Delhi Palace, Tempe, AZ', phone: null, category: 'Indian / Pakistani' },
    { name: "Gus's New York Pizza", address: "Gus's New York Pizza, University Dr, Tempe, AZ", phone: null, category: 'New York pizza' },
  ],
  'Dorsey Ln / Apache Blvd': [
    { name: 'Curry Corner', address: '1212 E Apache Blvd, Tempe, AZ 85281', phone: '480-894-1276', category: 'Pakistani / Indian' },
    { name: 'Kungfu Kitchen', address: '1250 E Apache Blvd #101, Tempe, AZ 85281', phone: '480-557-8888', category: 'Chinese / noodles / dumplings' },
    { name: 'Haji-Baba', address: '1513 E Apache Blvd, Tempe, AZ 85281', phone: '480-894-1905', category: 'Middle Eastern / Mediterranean' },
    { name: 'Taco Boys', address: '1015 S Rural Rd #101, Tempe, AZ 85281', phone: '480-597-5623', category: 'Mexican / tacos' },
    { name: 'Board & Brew', address: '1015 S Rural Rd #105, Tempe, AZ 85281', phone: '480-781-2900', category: 'Sandwiches / beer' },
    { name: 'Ahipoki', address: '1015 S Rural Rd, Tempe, AZ 85281', phone: '480-248-9834', category: 'Hawaiian / poke' },
  ],
  'Smith-Martin / Apache Blvd': [
    { name: 'The Dhaba', address: '1872 E Apache Blvd, Tempe, AZ 85281', phone: null, category: 'Indian / Punjabi' },
  ],
  // ---- Mesa ----
  'Sycamore / Main St': [
    { name: 'Mangos Mexican Cafe', address: '44 W Main St, Mesa, AZ 85201', phone: '480-464-5700', category: 'Mexican' },
    { name: 'Margaritas Fresh Cocina', address: '10 W Main St, Mesa, AZ 85201', phone: '480-969-5812', category: 'Mexican / cocktails' },
    { name: 'Jao Sua Thai & Sushi Bar', address: '17 W Main St, Mesa, AZ 85201', phone: null, category: 'Thai / sushi' },
    { name: 'Blue Corn Cafe & Bakery', address: '19 W Main St, Mesa, AZ 85201', phone: null, category: 'Mexican / bakery' },
    { name: 'Novel Ice Cream', address: '40 N Macdonald, Mesa, AZ 85201', phone: null, category: 'Ice cream / dessert' },
  ],
  'Country Club / Main St': [
    { name: 'il Vinaio', address: '270 W Main St, Mesa, AZ 85201', phone: '480-649-6476', category: 'Italian / wine bar' },
    { name: 'Worth Takeaway', address: '218 W Main St, Mesa, AZ 85201', phone: '480-833-2180', category: 'Sandwiches / American' },
    { name: "Gus's World Famous Fried Chicken", address: '212 W Main St, Mesa, AZ 85201', phone: '480-590-0404', category: 'Southern / fried chicken' },
    { name: 'Burritoholics', address: '216 W Main St, Mesa, AZ 85201', phone: '480-306-4632', category: 'Mexican / burritos / tacos' },
    { name: 'Pedal Haus Brewery', address: '201 W Main St, Mesa, AZ 85201', phone: null, category: 'Brewery / beer / burgers / pizza' },
    { name: 'Goat and Ram', address: '150 W Main St, Mesa, AZ 85201', phone: null, category: 'Pizza / American / beer' },
    { name: 'Phantom Fox Beer Co.', address: '150 W Main St, Mesa, AZ 85201', phone: null, category: 'Brewery / beer' },
    { name: 'Main Burgers', address: '161 W Main St, Mesa, AZ 85201', phone: null, category: 'Burgers / American' },
  ],
  'Center / Main St': [
    { name: 'Espiritu Mesa', address: '123 W Main St, Mesa, AZ 85201', phone: '480-272-6825', category: 'Contemporary Mexican / seafood / cocktails' },
    { name: 'Tacos Chiwas', address: '127 W Main St, Mesa, AZ 85201', phone: '480-590-7163', category: 'Chihuahua-style Mexican / tacos' },
    { name: 'Que Chevere', address: '142 W Main St, Mesa, AZ 85201', phone: '480-474-4954', category: 'Venezuelan / Latin American' },
    { name: 'Against The Grain Food', address: '124 W Main St, Mesa, AZ 85201', phone: '602-350-2082', category: 'Gluten-free / American / café' },
    { name: 'Proof Bread', address: '125 W Main St, Mesa, AZ 85201', phone: null, category: 'Bakery / sandwiches / café' },
    { name: 'Lonestar Coffee Bar', address: '126 W Main St, Mesa, AZ 85201', phone: null, category: 'Coffee / café' },
    { name: 'The Nile Coffee Shop', address: '105 W Main St, Mesa, AZ 85201', phone: null, category: 'Coffee / café' },
    { name: 'Arizona Distilling Co.', address: '155 W Main St, Mesa, AZ 85201', phone: null, category: 'Distillery / cocktails / bar' },
    { name: 'B.R.I. Taproom & Arcade', address: '213 W Main St, Mesa, AZ 85201', phone: null, category: 'Beer / bar / arcade' },
    { name: 'The Sacred Pint', address: '214 W Main St, Mesa, AZ 85201', phone: null, category: 'Beer / bar' },
  ],
  'Mesa Dr / Main St': [
    { name: 'Organic Bean Café', address: '40 N Macdonald, Mesa, AZ 85201', phone: null, category: 'Coffee / café' },
    { name: 'Lost Dutchman Coffee Roasters', address: '12 N Center St, Mesa, AZ 85201', phone: null, category: 'Coffee' },
    { name: "Hope's Frybread", address: '144 S Mesa Dr, Mesa, AZ 85210', phone: null, category: 'Native American / frybread' },
    { name: 'The Bread and Honey House', address: '144 S Mesa Dr, Mesa, AZ 85210', phone: null, category: 'Breakfast / brunch / American' },
    { name: "Paco's Tacos & Sip", address: '144 S Mesa Dr, Mesa, AZ 85210', phone: null, category: 'Mexican / tacos' },
    { name: 'Cider Corps Mesa', address: '31 S Robson St #103, Mesa, AZ 85210', phone: '480-993-3164', category: 'Cidery / taproom / pizza / coffee' },
    { name: 'República Empanada Restaurant', address: '204 E 1st Ave, Mesa, AZ 85210', phone: '480-969-1343', category: 'Pan-Latin / empanadas / Caribbean / South American' },
    { name: 'UNOS TACOS Y BIRRIA', address: '1859 S Stapley Dr #106, Mesa, AZ 85204', phone: '480-256-1314', category: 'Mexican / tacos / birria' },
    { name: "Pete's Fish & Chips", address: '22 S Mesa Dr, Mesa, AZ 85210', phone: '480-964-7242', category: 'Seafood / fish & chips' },
  ],
  'Stapley Dr / Main St': [
    { name: 'Guadalupe On Main', address: '1526 E Main St, Mesa, AZ 85203', phone: '480-272-7220', category: 'Mexican / Southwestern / cocktails' },
    { name: 'Mr. Pancho', address: '1700 E Main St, Mesa, AZ 85203', phone: null, category: 'Mexican' },
    { name: "McDonald's", address: '1730 E Main St, Mesa, AZ 85203', phone: null, category: 'Fast food / American' },
    { name: "Garcia's", address: "Garcia's Mexican Restaurant, Main St, Mesa, AZ", phone: null, category: 'Mexican / American' },
  ],
};

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function geocodeAddress(query: string): Promise<{ latitude: number; longitude: number } | null> {
  const token = config.mapboxAccessToken;
  if (!token || !query.trim()) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1&country=US&proximity=-112.074,33.448`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json() as { features?: Array<{ center: [number, number] }> };
    const feature = data.features?.[0];
    if (!feature) return null;
    const [longitude, latitude] = feature.center;
    return { latitude, longitude };
  } catch (error) {
    console.warn(`Geocoding error for ${query}:`, error);
    return null;
  }
}

async function main(): Promise<void> {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to seed the database');
  }

  await withDbClient(async (client) => {
    await client.query('BEGIN');
    try {
      // Existing vendor names per city, for dedupe — the current directory is
      // Phoenix-only, so same-name businesses in Tempe/Mesa are new locations.
      const existing = await client.query<{ name: string; city: string | null }>(
        'SELECT name, city FROM vendors',
      );
      const existingKeys = new Set(
        existing.rows.map((row) => `${normalizeName(row.name)}|${(row.city ?? 'Phoenix').toLowerCase()}`),
      );

      const membership = await client.query<{ id: string }>(
        'SELECT id FROM cards WHERE is_membership = true LIMIT 1',
      );
      const membershipCardId = membership.rows[0]?.id ?? null;

      const seenAddresses = new Set<string>();
      let inserted = 0;
      let skipped = 0;

      for (const [station, vendors] of Object.entries(vendorsByStation)) {
        const stationCheck = await client.query<{ id: string }>(
          'SELECT id FROM stops WHERE name = $1 LIMIT 1',
          [station],
        );
        if (!stationCheck.rows[0]) {
          console.warn(`Station not found in database: ${station}, skipping ${vendors.length} vendors`);
          continue;
        }

        for (const vendor of vendors) {
          const cityMatch = vendor.address.match(/,\s*([^,]+),\s*AZ/);
          const city = cityMatch?.[1]?.trim() ?? 'Phoenix';

          // Within-list dedupe: same normalized name + street address.
          const addressKey = `${normalizeName(vendor.name)}|${normalizeName(vendor.address)}`;
          if (seenAddresses.has(addressKey)) {
            console.log(`Skipping duplicate list entry: ${vendor.name}`);
            skipped++;
            continue;
          }
          seenAddresses.add(addressKey);

          // DB dedupe: same normalized name in the same city.
          if (existingKeys.has(`${normalizeName(vendor.name)}|${city.toLowerCase()}`)) {
            console.log(`Skipping existing vendor: ${vendor.name} (${city})`);
            skipped++;
            continue;
          }

          // Geocode the street address; fall back to a POI name search for the
          // few vendors listed without a full street address.
          const hasStreetAddress = /^\d+\s/.test(vendor.address);
          const query = hasStreetAddress ? vendor.address : `${vendor.name}, ${city}, AZ`;
          const coordinates = await geocodeAddress(query);

          const vendorType = inferVendorType(vendor.category);
          const insertedVendor = await client.query<{ id: string }>(
            `INSERT INTO vendors (name, location, address, city, category, vendor_type, cuisine, station, phone, latitude, longitude, discount_terms, status)
             VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'approved')
             RETURNING id`,
            [
              vendor.name,
              vendor.address,
              city,
              vendor.category,
              vendorType,
              inferCuisine(vendor.category, vendorType),
              station,
              vendor.phone,
              coordinates?.latitude ?? null,
              coordinates?.longitude ?? null,
              DEFAULT_TERMS,
            ],
          );
          const vendorId = insertedVendor.rows[0]!.id;

          // The app only lists vendors that carry an active discount on the
          // shared membership card, so attach one for every imported vendor.
          if (membershipCardId) {
            await client.query(
              'INSERT INTO card_vendors (card_id, vendor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [membershipCardId, vendorId],
            );
            await client.query(
              `INSERT INTO discounts (card_id, vendor_id, type, value, discount_code, description, active)
               VALUES ($1, $2, 'percent', 0, $3, $4, true)
               ON CONFLICT (card_id, vendor_id) DO NOTHING`,
              [membershipCardId, vendorId, generateDiscountCode(vendor.name), `${vendor.name} member discount`],
            );
          }

          console.log(`Inserted: ${vendor.name} (${station})${coordinates ? ` @ ${coordinates.latitude},${coordinates.longitude}` : ' — no coordinates'}`);
          inserted++;
        }
      }

      await client.query('COMMIT');
      console.log(`\nCompleted: ${inserted} vendors inserted, ${skipped} skipped`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  await closePool();
}

void main().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exitCode = 1;
});
