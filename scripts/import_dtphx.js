// One-off import of the DTPHX (Downtown Phoenix Inc.) directory list.
// - Inserts each business as an approved vendor at 0% off on the membership card
//   (same convention as import_staged_vendors.js / seed_rail_stop_vendors.ts).
// - Skips any business whose normalized name already exists in `vendors`
//   or `apartments_hotels` (i.e. already in the system).
// - Geocodes via Mapbox and assigns the nearest light-rail stop.
// Read-only against the app; only inserts rows.
const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');

const DB = process.env.DATABASE_URL;
const MAPBOX = process.env.MAPBOX_ACCESS_TOKEN;
if (!DB) { console.error('DATABASE_URL required'); process.exit(1); }
if (!MAPBOX) { console.error('MAPBOX_ACCESS_TOKEN required'); process.exit(1); }

const DEFAULT_TERMS = 'Cannot be applied with any other offer\nNot redeemable for cash\nCan be used 1 time per week';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomSuffix(length = 4) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}
function generateDiscountCode(name) {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const merchant = cleaned.length >= 6 ? cleaned.slice(0, 6) : (cleaned + randomSuffix(6)).slice(0, 6);
  return `VEND-${merchant}-0PCT-${randomSuffix(4)}`;
}
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(query) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX}&limit=1&country=US&bbox=-112.6,33.1,-111.4,33.8`;
  try {
    const r = await fetch(url);
    const d = await r.json();
    const f = d.features && d.features[0];
    if (!f) return null;
    return { lng: f.center[0], lat: f.center[1], place: f.place_name };
  } catch { return null; }
}

function haversineMi(aLat, aLng, bLat, bLng) {
  const R = 3958.8, toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(bLat - aLat), dLng = toR(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

(async () => {
  const list = JSON.parse(fs.readFileSync(__dirname + '/dtphx_vendors.json', 'utf8'));

  const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const existing = new Set((await c.query('SELECT name FROM vendors')).rows.map((r) => norm(r.name)));
    const stops = (await c.query('SELECT name, latitude, longitude FROM stops WHERE latitude IS NOT NULL')).rows;

    const mc = await c.query('SELECT id FROM cards WHERE is_membership = true LIMIT 1');
    const cardId = mc.rows[0] && mc.rows[0].id;
    if (!cardId) throw new Error('membership card not found');

    // Explicit skip list resolved from the dedupe review:
    // same property already listed under a different brand name.
    // Hotels that only exist in apartments_hotels (FOUND:RE, Hampton, Home2,
    // Hyatt Place, Residence Inn & Courtyard) still get a vendor row — same
    // convention as the 8 downtown hotels already present in both tables.
    const SKIP = new Set([
      'hotelpalomarcityscapeakimptonhotel', // = vendor "Kimpton Hotel Palomar Phoenix"
      'achotelphoenixdowntown',           // = vendor "AC Phoenix Downtown"
    ]);

    await c.query('BEGIN');
    let inserted = 0, skipped = 0, ungeocoded = 0;
    for (const b of list) {
      const key = norm(b.name);
      if (existing.has(key) || SKIP.has(key)) {
        skipped++;
        continue;
      }

      const hasStreet = /^\d/.test(b.address);
      let geo = await geocode(b.address);
      if (!geo && hasStreet) geo = await geocode(`${b.name}, Phoenix, AZ`);
      if (!geo) { ungeocoded++; console.log('  no-geocode:', b.name); }
      await sleep(120);

      let station = null;
      if (geo) {
        let best = Infinity;
        for (const s of stops) {
          const d = haversineMi(geo.lat, geo.lng, s.latitude, s.longitude);
          if (d < best) { best = d; station = s.name; }
        }
        if (best > 1.5) station = null; // don't attach if far from any stop
      }

      const ins = await c.query(
        `INSERT INTO vendors (name, location, address, city, category, vendor_type, cuisine, station, phone, website, latitude, longitude, discount_terms, status)
         VALUES ($1,$2,$2,'Phoenix',$3,$4,$5,$6,$7,$8,$9,$10,$11,'approved') RETURNING id`,
        [b.name, b.address, b.category, b.vendor_type, b.cuisine || null, station, b.phone || null, b.website || null,
         geo ? geo.lat : null, geo ? geo.lng : null, DEFAULT_TERMS],
      );
      const vid = ins.rows[0].id;
      existing.add(key);

      await c.query('INSERT INTO card_vendors (card_id, vendor_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [cardId, vid]);
      await c.query(
        `INSERT INTO discounts (card_id, vendor_id, type, value, discount_code, description, active)
         VALUES ($1,$2,'percent',0,$3,$4,true) ON CONFLICT (card_id, vendor_id) DO NOTHING`,
        [cardId, vid, generateDiscountCode(b.name), `${b.name} member discount`],
      );
      inserted++;
      console.log(`  + ${b.vendor_type.padEnd(10)} ${b.name} -> ${station || '-'} @ ${geo ? geo.lat.toFixed(5) + ',' + geo.lng.toFixed(5) : 'no-coords'}`);
    }
    if (process.env.DRY_RUN === '1') {
      await c.query('ROLLBACK');
      console.log('\nDRY RUN — rolled back, nothing written');
    } else {
      await c.query('COMMIT');
    }
    console.log(`\nDONE inserted=${inserted} skipped-existing=${skipped} ungeocoded=${ungeocoded}`);
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
