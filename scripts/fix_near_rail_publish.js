// Recompute station/distance_miles/near_rail for apartments_hotels using the
// now-geocoded stops table, then publish a new snapshot with updated apartments.
const { Client } = require('pg');
const DB = 'postgresql://postgres.okbolfpndeakmchpznmt:gfdsfgdfgsdrgeert@aws-1-us-east-2.pooler.supabase.com:5432/postgres';

function haversine(lat1, lon1, lat2, lon2) {
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

(async () => {
  const c = new Client(DB);
  await c.connect();
  const stops = (await c.query('select name,"latitude" lat,"longitude" lng from stops where "latitude" is not null')).rows;
  const listings = (await c.query('select id,name,station,"latitude","longitude" from apartments_hotels where "latitude" is not null and "longitude" is not null')).rows;

  let updated = 0, far = 0;
  await c.query('BEGIN');
  for (const l of listings) {
    let best = Infinity, nearest = null;
    for (const s of stops) {
      const d = haversine(l.latitude, l.longitude, s.lat, s.lng);
      if (d < best) { best = d; nearest = s.name; }
    }
    if (!nearest) continue;
    const near = best <= 0.5;
    if (!near) far++;
    await c.query(
      'update apartments_hotels set station=$2, distance_miles=$3, near_rail=$4 where id=$1',
      [l.id, nearest, best, near],
    );
    updated++;
    if (!near) console.log('  far:', l.name, '->', nearest, best.toFixed(2));
  }
  await c.query('COMMIT');
  console.log('updated', updated, 'rows;', far, 'beyond 0.5mi');

  const rows = await c.query(
    `SELECT id, name, listing_type, section, station, address, city, state, zip, phone, website,
            "latitude", "longitude", near_rail, distance_miles, created_at, updated_at
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
     SELECT COALESCE(MAX(version),0)+1, now(), $1::jsonb FROM app_published RETURNING version`,
    [JSON.stringify(payload)],
  );
  console.log('published snapshot version', v.rows[0].version, '| apartments in payload:', apartments.length);
  await c.end();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
