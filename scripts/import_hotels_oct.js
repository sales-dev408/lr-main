// Insert staged hotels (out/hotels_oct_parsed.json) into apartments_hotels:
// geocoded, nearest light-rail station centroid, near_rail/distance_miles,
// section from latitude — same shape as import_listings.js. --dry to preview.
const { Client } = require('pg');
const staged = require('./out/hotels_oct_parsed.json');

const DB = process.env.DATABASE_URL;
const DRY = process.argv.includes('--dry');
const MAPBOX = process.env.MAPBOX_ACCESS_TOKEN || 'pk.eyJ1Ijoic2FsZXMtZGV2MTIzIiwiYSI6ImNtc2kyYmJiOTA2d24yeG4xemxya3ZyNzYifQ.CynLROdxurBurDNpKJTfFQ';

const norm = (s) => (s || '').normalize('NFKD').toLowerCase().replace(/[''’]/g, '').replace(/[^a-z0-9]/g, '');
const namesSimilar = (a, b) => {
  const ta = new Set((a || '').toLowerCase().match(/[a-z0-9]+/g) || []);
  const tb = new Set((b || '').toLowerCase().match(/[a-z0-9]+/g) || []);
  if (!ta.size || !tb.size) return false;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  if (shared / Math.min(ta.size, tb.size) >= 0.7) return true;
  const na = norm(a), nb = norm(b);
  return na.length >= 8 && nb.length >= 8 && (na.startsWith(nb) || nb.startsWith(na));
};
const haversine = (a, b, c2, d) => {
  const rad = (x) => (x * Math.PI) / 180;
  const h = Math.sin(rad(c2 - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c2)) * Math.sin(rad(d - b) / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
const parseZip = (a) => (/\b(85\d{3})\b/.exec(a || '') || [])[1] || null;
const sectionFor = (city, lat) => {
  if (/tempe/i.test(city || '')) return 'Tempe';
  if (/mesa/i.test(city || '')) return 'Mesa';
  if (lat == null) return 'Phoenix';
  if (lat < 33.47) return 'Downtown';
  if (lat > 33.515) return 'North Phoenix';
  return 'Central';
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(name, address) {
  const queries = [];
  if (address) queries.push(address);
  queries.push(`${name}, Phoenix, AZ`);
  for (const q of queries) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX}&limit=1&country=US&types=address,poi&proximity=-112.074,33.448`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const f = (await res.json()).features?.[0];
      if (f?.center) {
        const [lng, lat] = f.center;
        if (lat > 33.1 && lat < 33.95 && lng > -112.6 && lng < -111.5) return { lat, lng };
      }
    } catch { /* next */ }
    await sleep(120);
  }
  return null;
}

(async () => {
  const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const existing = (await c.query("SELECT name FROM apartments_hotels WHERE listing_type='hotel'")).rows;
    const names = new Set(existing.map((r) => norm(r.name)));
    const centroids = (await c.query(
      `SELECT station, AVG(latitude) lat, AVG(longitude) lng FROM vendors
       WHERE station IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL GROUP BY station`,
    )).rows;

    let inserted = 0, skipped = 0, far = 0;
    for (const r of staged) {
      if (names.has(norm(r.name)) || existing.some((e) => namesSimilar(e.name, r.name))) { skipped++; console.log('  skip:', r.name); continue; }
      const geo = await geocode(r.name, r.address);
      await sleep(80);
      let station = null, dist = null;
      if (geo) {
        let best = Infinity;
        for (const s of centroids) {
          const d = haversine(geo.lat, geo.lng, s.lat, s.lng);
          if (d < best) { best = d; station = s.station; }
        }
        dist = best;
      }
      const nearRail = dist != null && dist <= 0.5;
      if (!nearRail) far++;
      console.log(`  + ${r.name} | ${station || 'no-station'} | ${dist == null ? 'NOGEO' : dist.toFixed(2) + 'mi'} | ${nearRail ? 'near' : 'FAR'}`);
      if (DRY) continue;
      await c.query(
        `INSERT INTO apartments_hotels (name, listing_type, section, station, address, city, state, zip, phone, website, latitude, longitude, near_rail, distance_miles)
         VALUES ($1,'hotel',$2,$3,$4,$5,'AZ',$6,$7,$8,$9,$10,$11,$12)`,
        [r.name, sectionFor(r.city || 'Phoenix', geo?.lat ?? null), station, r.address || null, r.city || 'Phoenix',
         parseZip(r.address), r.phone || null, r.website || null, geo?.lat ?? null, geo?.lng ?? null, nearRail, dist],
      );
      names.add(norm(r.name));
      inserted++;
    }
    console.log(`\n${DRY ? 'DRY ' : ''}inserted=${inserted} skipped=${skipped} beyond-0.5mi=${far}`);
  } finally {
    await c.end();
  }
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
