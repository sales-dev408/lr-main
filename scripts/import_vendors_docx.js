const { Client } = require('pg');
const fs = require('fs');

const DB = {
  host: 'aws-1-us-east-2.pooler.supabase.com',
  port: 5432,
  user: 'postgres.okbolfpndeakmchpznmt',
  password: process.env.PGPASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
};

const vendors = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

const DEFAULT_TERMS = 'Cannot be applied with any other offer\nNot redeemable for cash\nCan be used 1 time per week';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomSuffix(length = 4) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}
function generateDiscountCode(merchantName) {
  const cleaned = merchantName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const merchant = cleaned.length >= 6 ? cleaned.slice(0, 6) : (cleaned + randomSuffix(6)).slice(0, 6);
  return `VEND-${merchant}-0PCT-${randomSuffix(4)}`;
}

// Mirrors lib/vendors.ts inference (same rules as the seed script)
function inferVendorType(category) {
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
function inferCuisine(category, vendorType) {
  if (!category || vendorType !== 'restaurant') return null;
  const raw = category.trim();
  if (!raw || /^(restaurant|dining|food)$/i.test(raw)) return null;
  return raw.toLowerCase();
}

const NEW_STOPS = [
  { name: 'Thelda Williams Transit Center', city: 'Phoenix', line: 'B Line', position: 57 },
  { name: 'Pioneer / Central Ave', city: 'Phoenix', line: 'B Line', position: 31 },
];

(async () => {
  const c = new Client(DB);
  await c.connect();
  try {
    await c.query('BEGIN');

    // 1) clean up the earlier API test vendor
    const tv = await c.query(`SELECT id FROM vendors WHERE name = 'ZZ DEVIN TEST DELETE ME'`);
    for (const row of tv.rows) {
      await c.query('DELETE FROM discounts WHERE vendor_id = $1', [row.id]);
      await c.query('DELETE FROM card_vendors WHERE vendor_id = $1', [row.id]);
      await c.query('DELETE FROM vendors WHERE id = $1', [row.id]);
      console.log('removed test vendor', row.id);
    }

    // 2) missing stops
    for (const s of NEW_STOPS) {
      const r = await c.query(
        `INSERT INTO stops (name, city, line, position) VALUES ($1,$2,$3,$4)
         ON CONFLICT (name) DO UPDATE SET city = EXCLUDED.city, line = EXCLUDED.line, position = EXCLUDED.position
         RETURNING id`, [s.name, s.city, s.line, s.position]);
      console.log('stop upserted:', s.name);
    }

    // 3) membership card
    const mc = await c.query('SELECT id FROM cards WHERE is_membership = true LIMIT 1');
    const cardId = mc.rows[0]?.id;
    if (!cardId) throw new Error('membership card not found');

    // 4) vendors
    let inserted = 0;
    for (const v of vendors) {
      const kind = (v.kind || '').trim();
      const isBeauty = v.source === 'beauty';
      const category = kind || (isBeauty ? 'Beauty' : 'Restaurant');
      const vendorType = isBeauty ? 'beauty' : (inferVendorType(category) ?? 'restaurant');
      const cuisine = isBeauty ? null : inferCuisine(category, vendorType);
      const city = v.city || 'Phoenix';
      const station = v.station;

      const stopCheck = await c.query('SELECT id FROM stops WHERE name = $1 LIMIT 1', [station]);
      if (!stopCheck.rows[0]) {
        console.warn('NO STATION, skipping', v.name, '@', station);
        continue;
      }

      const ins = await c.query(
        `INSERT INTO vendors (name, location, address, city, category, vendor_type, cuisine, station, phone, website, latitude, longitude, discount_terms, status)
         VALUES ($1,$2,$2,$3,$4,$5,$6,$7,$8,NULL,$9,$10,$11,'approved') RETURNING id`,
        [v.name, v.address, city, category, vendorType, cuisine, station,
         v.phone && v.phone !== 'None' ? v.phone : null, v.lat ?? null, v.lng ?? null, DEFAULT_TERMS]);
      const vid = ins.rows[0].id;

      await c.query('INSERT INTO card_vendors (card_id, vendor_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [cardId, vid]);
      await c.query(
        `INSERT INTO discounts (card_id, vendor_id, type, value, discount_code, description, active)
         VALUES ($1,$2,'percent',0,$3,$4,true) ON CONFLICT (card_id, vendor_id) DO NOTHING`,
        [cardId, vid, generateDiscountCode(v.name), `${v.name} member discount`]);
      inserted++;
      console.log(' +', vendorType.padEnd(10), v.name, '@', station);
    }

    await c.query('COMMIT');
    console.log(`\nDONE: ${inserted}/${vendors.length} vendors inserted`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    await c.end();
  }
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
