// Import staged vendors from out/services_1028_parsed.json into production.
// - Dedupes against existing vendors by normalized name OR normalized address
// - Mapbox-geocodes every row (address first, business name as fallback)
// - Assigns the nearest light-rail station (vendor-derived stop centroids)
// - Links each vendor to the membership card (card_vendors + active 0% discount)
// so they appear in the app directory, matching prior imports.
// Usage: DATABASE_URL=... node import_services_1028.js [--dry]
const { Client } = require('pg');
const crypto = require('crypto');
const staged = require('./out/services_1028_parsed.json');

const DB = process.env.DATABASE_URL;
if (!DB) { console.error('DATABASE_URL required'); process.exit(1); }
const DRY = process.argv.includes('--dry');
const MAPBOX = process.env.MAPBOX_ACCESS_TOKEN || 'pk.eyJ1Ijoic2FsZXMtZGV2MTIzIiwiYSI6ImNtc2kyYmJiOTA2d24yeG4xemxya3ZyNzYifQ.CynLROdxurBurDNpKJTfFQ';

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
const norm = (s) => (s || '').toLowerCase().replace(/&/g, ' and ').replace(/[''’]/g, '').replace(/[^a-z0-9]/g, '');
// Normalize street suffixes + strip suite/unit/city/zip so address dedupe
// catches '45 W Jefferson St, Suite L' vs '45 W. Jefferson Street'.
const normAddr = (s) => norm(s)
  .replace(/(suite|ste|unit|apt|bldg|floor|fl|room|rm)?\d*[a-z]?$/, '')
  .replace(/street$/, 'st').replace(/avenue$/, 'ave').replace(/road$/, 'rd')
  .replace(/drive$/, 'dr').replace(/boulevard$/, 'blvd').replace(/lane$/, 'ln')
  .replace(/phoenix(az)?\d*$/, '');

// True when two business names share most of their tokens — catches
// 'Dignity Health Cancer Institute' vs '... at St. Joseph's' without
// merging unrelated tenants of the same building.
function namesSimilar(a, b) {
  const ta = new Set((a || '').toLowerCase().replace(/&/g, ' and ').match(/[a-z0-9]+/g) || []);
  const tb = new Set((b || '').toLowerCase().replace(/&/g, ' and ').match(/[a-z0-9]+/g) || []);
  if (!ta.size || !tb.size) return false;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size) >= 0.7;
}

function haversine(lat1, lon1, lat2, lon2) {
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(name, address) {
  const queries = [];
  if (address) queries.push(`${address}, Phoenix, AZ`);
  queries.push(`${name}, Phoenix, AZ`);
  if (address) queries.push(`${name} ${address}, Phoenix, AZ`);
  for (const q of queries) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX}&limit=1&country=US&types=address,poi&proximity=-112.074,33.448`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const f = data.features && data.features[0];
      if (f && f.center) {
        const [lng, lat] = f.center;
        // sanity: keep results within the Phoenix metro
        if (lat > 33.1 && lat < 33.95 && lng > -112.6 && lng < -111.5) return { lat, lng };
      }
    } catch { /* try next */ }
    await sleep(120);
  }
  return null;
}

(async () => {
  const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const existing = (await c.query('SELECT name, address FROM vendors')).rows;
    const existingNames = new Set(existing.map((v) => norm(v.name)));
    const existingAddrs = existing.filter((v) => v.address).map((v) => ({ key: normAddr(v.address), name: v.name }));

    // Within-staged dedupe: same normalized address AND similar names.
    const seenAddr = new Map();
    const deduped = [];
    for (const v of staged) {
      const key = normAddr(v.address);
      if (key && seenAddr.has(key) && namesSimilar(seenAddr.get(key).name, v.name)) continue;
      if (key && !seenAddr.has(key)) seenAddr.set(key, v);
      deduped.push(v);
    }
    console.log(`staged ${staged.length} -> ${deduped.length} after same-address dedupe`);

    const mc = await c.query("SELECT id FROM cards WHERE is_membership = true LIMIT 1");
    const cardId = mc.rows[0]?.id;
    if (!cardId) throw new Error('membership card not found');

    const centroids = (await c.query(
      `SELECT station, AVG(latitude) lat, AVG(longitude) lng FROM vendors
       WHERE station IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL GROUP BY station`,
    )).rows;
    const stopNames = new Set((await c.query('SELECT name FROM stops')).rows.map((s) => s.name));

    let inserted = 0, skipped = 0, noGeo = 0;
    const report = [];
    for (const v of deduped) {
      if (existingNames.has(norm(v.name))) { skipped++; report.push(`  skip(name): ${v.name}`); continue; }
      const addrKey = normAddr(v.address);
      const addrHit = addrKey && existingAddrs.find((e) => e.key === addrKey && namesSimilar(e.name, v.name));
      if (addrHit) { skipped++; report.push(`  skip(addr): ${v.name} @ ${v.address} (as '${addrHit.name}')`); continue; }

      const geo = await geocode(v.name, v.address);
      await sleep(80);
      let station = null;
      if (geo) {
        let best = Infinity;
        for (const s of centroids) {
          const d = haversine(geo.lat, geo.lng, s.lat, s.lng);
          if (d < best) { best = d; station = s.station; }
        }
        if (station && !stopNames.has(station)) station = null;
      } else {
        noGeo++;
      }

      report.push(`  + ${v.vendorType.padEnd(10)} ${(v.category || '').padEnd(24)} ${v.name} | ${v.address || 'no-addr'} | ${station || 'no-station'} | ${geo ? 'geo' : 'NOGEO'}`);
      if (DRY) continue;

      const ins = await c.query(
        `INSERT INTO vendors (name, location, address, city, category, vendor_type, cuisine, station, phone, website, latitude, longitude, discount_terms, status)
         VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'approved') RETURNING id`,
        [v.name, v.address || null, 'Phoenix', v.category, v.vendorType, v.cuisine, station,
         v.phone || null, v.website || null, geo?.lat ?? null, geo?.lng ?? null, DEFAULT_TERMS],
      );
      const vid = ins.rows[0].id;
      existingNames.add(norm(v.name));
      await c.query('INSERT INTO card_vendors (card_id, vendor_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [cardId, vid]);
      await c.query(
        `INSERT INTO discounts (card_id, vendor_id, type, value, discount_code, description, active)
         VALUES ($1,$2,'percent',0,$3,$4,true) ON CONFLICT (card_id, vendor_id) DO NOTHING`,
        [cardId, vid, generateDiscountCode(v.name), 'No discount'],
      );
      inserted++;
    }
    console.log(report.join('\n'));
    console.log(`\n${DRY ? 'DRY RUN — ' : ''}inserted=${inserted} skipped-existing=${skipped} no-geocode=${noGeo} of ${staged.length}`);
  } finally {
    await c.end();
  }
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
