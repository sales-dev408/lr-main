// Insert staged vendors from out/enriched.json (sources: biz, beauty).
// Idempotent: skips vendors whose normalized name already exists.
const { Client } = require('pg');
const crypto = require('crypto');
const enriched = require('./out/enriched.json');

const DB = 'postgresql://postgres.okbolfpndeakmchpznmt:gfdsfgdfgsdrgeert@aws-1-us-east-2.pooler.supabase.com:5432/postgres';
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

// Map the doc's free-text category/type to the app's filterable vendor_type.
function vendorTypeFor(v) {
  const t = (v.type || '').toLowerCase();
  const cat = (v.category || '').toLowerCase();
  const s = `${t} ${cat}`.trim();
  if (v.source === 'beauty' || /(^|[\/\s])(beauty|barber|salon|nails?|lashes?|brows?|spa|hair|skincare|esthetic|grooming|scalp)([\/\s]|$)/.test(s)) return 'beauty';
  if (/(^|[\/\s])(bar|pub|brew|tavern|lounge|cocktail|wine|beer)([\/\s]|$)/.test(s) || /music venue/.test(s)) return 'bar';
  if (/café|cafe|coffee|dessert|bakery/.test(s)) return 'cafe';
  if (/restaurant|dim sum|hot pot|asian food|thai|vietnamese|bánh|seafood market|eater|diner|pizza|grill|kitchen|taqueria|sushi/.test(s)) return 'restaurant';
  if (/repair|rental|shipping|mailbox|atm|bank|pharmacy|convenience|liquor|grocery|market|library|school|university|college|asu\b|church|religious|worship|ymca|fitness|athletic facility|medical|clinic|hormone|health|travel|theater|theatre|movie|arcade|entertainment|recreation|museum|center|plaza|postal|printing|courier|notary|wireless|optical|services|tenants|businesses|housing|community|housing|public|law|journalism|performing|airport|car wash|gas|hotel/.test(s)) return 'other';
  if (/boutique|clothing|apparel|jewelry|gift|fashion|vintage|records|music|books?|comics|shoes?|footwear|sporting|sports|crafts|florist|flower|pet|furniture|home|décor|collectibles|toys|mercantile|antique|retail|shop|wear|denim|trading|feed/.test(s)) return 'boutique';
  return 'other';
}

function cuisineFor(v, vendorType) {
  if (vendorType !== 'restaurant') return null;
  const t = (v.type || '').trim().toLowerCase();
  if (!t || /^(restaurant|dining|food|restaurant\/.*(generic|general))$/.test(t)) return null;
  return t;
}

(async () => {
  const c = new Client(DB);
  await c.connect();
  try {
    const staged = enriched.filter((r) => ['biz', 'beauty'].includes(r.source));
    const existing = (await c.query('SELECT id, name FROM vendors')).rows;
    const existingNames = new Map(existing.map((v) => [norm(v.name), v.id]));

    const mc = await c.query('SELECT id FROM cards WHERE is_membership = true LIMIT 1');
    const cardId = mc.rows[0]?.id;
    if (!cardId) throw new Error('membership card not found');

    let inserted = 0, skipped = 0, noStation = 0;
    const stopRows = (await c.query('SELECT name FROM stops')).rows;
    const stopNames = new Set(stopRows.map((s) => s.name));

    await c.query('BEGIN');
    for (const v of staged) {
      const key = norm(v.name);
      if (existingNames.has(key)) {
        skipped++;
        console.log('  skip (exists):', v.name);
        continue;
      }
      const station = v.station;
      if (!station || !stopNames.has(station)) {
        noStation++;
        console.log('  NO STATION:', v.name, '@', station);
      }
      const vendorType = vendorTypeFor(v);
      const cuisine = cuisineFor(v, vendorType);
      const category = (v.type || v.category || (vendorType === 'beauty' ? 'Beauty' : vendorType === 'boutique' ? 'Boutique' : 'Other')).trim();

      const ins = await c.query(
        `INSERT INTO vendors (name, location, address, city, category, vendor_type, cuisine, station, phone, website, latitude, longitude, discount_terms, status)
         VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'approved') RETURNING id`,
        [
          v.name,
          v.address || null,
          v.city || 'Phoenix',
          category,
          vendorType,
          cuisine,
          station || null,
          v.phone && v.phone !== 'None' ? v.phone : null,
          v.website || null,
          v.geocode ? v.geocode.lat : null,
          v.geocode ? v.geocode.lng : null,
          DEFAULT_TERMS,
        ],
      );
      const vid = ins.rows[0].id;
      existingNames.set(key, vid);

      await c.query('INSERT INTO card_vendors (card_id, vendor_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [cardId, vid]);
      await c.query(
        `INSERT INTO discounts (card_id, vendor_id, type, value, discount_code, description, active)
         VALUES ($1,$2,'percent',0,$3,$4,true) ON CONFLICT (card_id, vendor_id) DO NOTHING`,
        [cardId, vid, generateDiscountCode(v.name), `${v.name} member discount`],
      );
      inserted++;
      console.log('  +', vendorType.padEnd(10), (cuisine || '-').padEnd(14), v.name, '@', station || 'no-station');
    }
    await c.query('COMMIT');
    console.log(`\nDONE: inserted=${inserted} skipped-existing=${skipped} no-station=${noStation} total=${staged.length}`);
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
