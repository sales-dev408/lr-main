// Rebuild vendors/apartments/stops arrays from live tables and publish a new
// snapshot version, preserving content/theme/events from the latest payload.
const { Client } = require('pg');
const DB = 'postgresql://postgres.okbolfpndeakmchpznmt:gfdsfgdfgsdrgeert@aws-1-us-east-2.pooler.supabase.com:5432/postgres';

function humanDiscountLabel(type, value) {
  if (type === 'bogo') return 'BOGO';
  if (type === 'fixed') return `$${value} off`;
  if (value === 0) return 'Member exclusive';
  return `${value}% off`;
}

(async () => {
  const c = new Client(DB);
  await c.connect();

  const vendors = (await c.query(
    `SELECT v.id, v.name, v.address, v.city, v.location, v.category, v.vendor_type, v.cuisine, v.station, v.latitude, v.longitude, v.pos_system, v.icon_url, v.logo_url, v.discount_terms,
            d.type AS discount_type, d.value AS discount_value, d.discount_code, d.description AS discount_description,
            d.starts_at, d.ends_at, d.boosted, c.id AS card_id, c.icon_url AS card_icon, c.logo_url AS card_logo
     FROM vendors v
     JOIN cards c ON c.is_membership = true AND c.status = 'active'
     JOIN discounts d ON d.vendor_id = v.id AND d.card_id = c.id AND d.active = true
     WHERE v.status = 'approved'
       AND (d.starts_at IS NULL OR d.starts_at <= now())
       AND (d.ends_at IS NULL OR d.ends_at >= now())
     ORDER BY CASE WHEN d.boosted THEN 0 ELSE 1 END, v.station NULLS LAST, v.name`,
  )).rows.map((row) => {
    const type = row.discount_type ?? 'fixed';
    const value = Number(row.discount_value ?? 0);
    return {
      id: row.id, name: row.name, address: row.address ?? row.location, city: row.city,
      location: row.location, category: row.category, vendorType: row.vendor_type,
      cuisine: row.cuisine, station: row.station, latitude: row.latitude, longitude: row.longitude,
      posSystem: row.pos_system, iconUrl: row.icon_url ?? row.card_icon,
      logoUrl: row.logo_url ?? row.card_logo,
      discountTerms: row.discount_terms ?? 'Cannot be applied with any other offer\nNot redeemable for cash\nCan be used 1 time per week',
      discount: {
        type, value, label: humanDiscountLabel(type, value), discountCode: row.discount_code,
        description: row.discount_description, startsAt: row.starts_at, endsAt: row.ends_at, boosted: row.boosted,
      },
      discountCode: row.discount_code, discountDescription: row.discount_description,
      boosted: row.boosted, startsAt: row.starts_at, endsAt: row.ends_at,
      cardId: row.card_id, walletUrl: null,
    };
  });

  const apartments = (await c.query(
    `SELECT id, name, listing_type, section, station, address, city, state, zip, phone, website,
            "latitude", "longitude", near_rail, distance_miles, created_at, updated_at
     FROM apartments_hotels WHERE near_rail = true ORDER BY section NULLS LAST, name`,
  )).rows.map((r) => ({
    id: r.id, name: r.name, listingType: r.listing_type, section: r.section, station: r.station,
    address: r.address, city: r.city, state: r.state, zip: r.zip, phone: r.phone, website: r.website,
    latitude: r.latitude, longitude: r.longitude, nearRail: r.near_rail, distanceMiles: r.distance_miles,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));

  const stops = (await c.query('SELECT id, name, city, line, position, "latitude", "longitude" FROM stops ORDER BY COALESCE(line,\'\'), COALESCE(position, 0), name')).rows.map((r) => ({
    id: r.id, name: r.name, city: r.city, line: r.line, position: r.position,
    latitude: r.latitude, longitude: r.longitude,
  }));

  const latest = await c.query('SELECT payload FROM app_published ORDER BY version DESC, published_at DESC LIMIT 1');
  const payload = latest.rows[0].payload;
  payload.vendors = vendors;
  payload.apartments = apartments;
  payload.stops = stops;

  const v = await c.query(
    `INSERT INTO app_published (version, published_at, payload)
     SELECT COALESCE(MAX(version),0)+1, now(), $1::jsonb FROM app_published RETURNING version`,
    [JSON.stringify(payload)],
  );
  console.log('published v' + v.rows[0].version, '| vendors:', vendors.length, '| listings:', apartments.length, '| stops:', stops.length);
  await c.end();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
