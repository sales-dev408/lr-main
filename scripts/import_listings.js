// Insert new apartment/hotel records into apartments_hotels with listing_type,
// near_rail/distance_miles (vendor-derived station centroids), then refresh the
// published snapshot's apartments array.
const fs = require('fs');
const { Client } = require('pg');
const DB = 'postgresql://postgres.okbolfpndeakmchpznmt:gfdsfgdfgsdrgeert@aws-1-us-east-2.pooler.supabase.com:5432/postgres';

const enriched = JSON.parse(fs.readFileSync('out/enriched.json', 'utf8'));

function norm(s) {
  return (s || '').toLowerCase().replace(/[''’]/g, "'").replace(/[^a-z0-9]/g, '');
}
function haversine(lat1, lon1, lat2, lon2) {
  const R = 3958.8, rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function parseZip(addr) { const m = /\b(85\d{3})\b/.exec(addr || ''); return m ? m[1] : null; }
function sectionFor(city, lat) {
  if (/tempe/i.test(city)) return 'Tempe';
  if (/mesa/i.test(city)) return 'Mesa';
  if (lat == null) return 'Phoenix';
  if (lat < 33.47) return 'Downtown';
  if (lat > 33.515) return 'North Phoenix';
  return 'Central';
}

(async () => {
  const c = new Client(DB);
  await c.connect();

  const existing = await c.query('SELECT name FROM apartments_hotels');
  const existingNames = new Set(existing.rows.map((r) => norm(r.name)));

  const centroids = await c.query(
    `SELECT station, AVG(latitude) lat, AVG(longitude) lng FROM vendors
     WHERE station IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL GROUP BY station`,
  );

  const recs = enriched.filter((r) => (r.source === 'apts' || r.source === 'hotels') && r.geocode);
  let inserted = 0, skipped = 0, far = 0;

  await c.query('BEGIN');
  for (const r of recs) {
    if (existingNames.has(norm(r.name))) { skipped++; continue; }
    // nearest station centroid
    let best = Infinity, nearest = null;
    for (const s of centroids.rows) {
      const d = haversine(r.geocode.lat, r.geocode.lng, s.lat, s.lng);
      if (d < best) { best = d; nearest = s.station; }
    }
    const distance = nearest ? best : null;
    const nearRail = distance != null && distance <= 0.5;
    if (!nearRail) far++;
    const res = await c.query(
      `INSERT INTO apartments_hotels (name, listing_type, section, station, address, city, state, zip, phone, website, latitude, longitude, near_rail, distance_miles)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [r.name, r.source === 'hotels' ? 'hotel' : 'apartment', sectionFor(r.city, r.geocode.lat),
       r.station || nearest, r.address || null, r.city || null, 'AZ', parseZip(r.address),
       r.phone || null, r.website || null, r.geocode.lat, r.geocode.lng, nearRail, distance],
    );
    existingNames.add(norm(r.name));
    inserted++;
    if (!nearRail) console.log('  not near_rail:', r.name, distance?.toFixed(2));
  }
  await c.query('COMMIT');
  console.log(`inserted: ${inserted}, skipped existing: ${skipped}, not-near-rail: ${far}`);

  // Rebuild the apartments array of the latest published snapshot (same shape as
  // toPublicApartment) and store as a new version so the app picks it up.
  const rows = await c.query(
    `SELECT id, name, listing_type, section, station, address, city, state, zip, phone, website,
            latitude, longitude, near_rail, distance_miles, created_at, updated_at
     FROM apartments_hotels WHERE near_rail = true ORDER BY section NULLS LAST, name`,
  );
  const apartments = rows.rows.map((r) => ({
    id: r.id, name: r.name, listingType: r.listing_type, section: r.section, station: r.station,
    address: r.address, city: r.city, state: r.state, zip: r.zip, phone: r.phone, website: r.website,
    latitude: r.latitude, longitude: r.longitude, nearRail: r.near_rail, distanceMiles: r.distance_miles,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));
  const latest = await c.query('SELECT version, payload FROM app_published ORDER BY version DESC LIMIT 1');
  const payload = latest.rows[0].payload;
  payload.apartments = apartments;
  const v = await c.query(
    `INSERT INTO app_published (version, published_at, payload)
     SELECT COALESCE(MAX(version),0)+1, now(), $2::jsonb FROM app_published RETURNING version`,
    [JSON.stringify(payload)],
  );
  console.log('published snapshot version', v.rows[0].version, 'apartments in payload:', apartments.length);
  await c.end();
})().catch(async (e) => { console.error('FATAL', e); process.exit(1); });
