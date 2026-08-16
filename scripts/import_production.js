const fs = require('fs');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const https = require('https');

const DATABASE_URL = process.env.DATABASE_URL || '';
const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@lightraildeals.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Lightrail2025!';

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePhone(p) {
  return (p || '').replace(/\D/g, '');
}

function cleanName(name) {
  return (name || '')
    .replace(/&#8203;/g, '')
    .replace(/[\u00a0\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanCategory(section) {
  return (section || '')
    .replace(/phx|PHX/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

function parseMetroStop(file, stationName) {
  const html = fs.readFileSync(file, 'utf8');
  const start = html.indexOf('id="wsite-content"');
  const end = html.indexOf('class="footer-wrap"');
  const content = end > start && start > -1 ? html.slice(start, end) : html;
  const text = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#[xX]?[0-9a-fA-F]+;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u00a0\u200B-\u200D\uFEFF]/g, ' ');
  const chunks = text.split(/\n{2,}/).map((c) => c.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
  const vendors = [];
  for (const chunk of chunks) {
    const phoneRe = /\(\d{3}\)\s*\d{3}-\d{4}/;
    const lines = chunk.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
    const phoneIdx = lines.findIndex((l) => phoneRe.test(l));
    if (phoneIdx === -1) continue;
    const phone = lines[phoneIdx].match(phoneRe)[0];
    const name = cleanName(lines[0]);
    const address = lines.slice(1, phoneIdx).join(' ').replace(/\s+/g, ' ').trim();
    if (!name) continue;
    const zipMatch = address.match(/\bAZ\s+(\d{5})\b/);
    const zip = zipMatch ? zipMatch[1] : '';
    vendors.push({ name, address, phone, station: stationName, zip });
  }
  return vendors;
}

function loadVendors() {
  const rows = JSON.parse(fs.readFileSync('vendors_raw.json', 'utf8'));
  const vendors = [];
  const seen = new Set();
  for (const r of rows) {
    const name = cleanName(r.Name);
    const address = (r.Address || '').trim();
    const city = (r.City || '').trim();
    const phone = (r.Phone || '').trim();
    const zip = (r.Zip || '').trim();
    if (!name || !address) continue;
    const key = `${name.toLowerCase()}|${address.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    vendors.push({
      name,
      address,
      city,
      state: 'AZ',
      zip,
      phone,
      category: cleanCategory(r.section),
      station: null,
      website: null,
    });
  }
  return vendors;
}

function loadApartments() {
  const apartments = JSON.parse(fs.readFileSync('apartments_raw.json', 'utf8'));
  const seen = new Set();
  return apartments.filter((a) => {
    const name = cleanName(a.name);
    if (!name) return false;
    const key = `${name.toLowerCase()}|${(a.address || '').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    a.name = name;
    return true;
  });
}

function geocode(query) {
  return new Promise((resolve) => {
    if (!MAPBOX_TOKEN) return resolve(null);
    const encoded = encodeURIComponent(query);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=address,place,poi`;
    https
      .get(url, { timeout: 15000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.features && json.features[0]) {
              const [lng, lat] = json.features[0].center;
              resolve({ lat, lng });
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      })
      .on('error', () => resolve(null))
      .on('timeout', function () {
        this.destroy();
        resolve(null);
      });
  });
}

async function geocodeItems(items) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const query = item.city
      ? `${item.address}, ${item.city}, ${item.state || 'AZ'} ${item.zip || ''}`.replace(/\s+/g, ' ').trim()
      : `${item.address}, AZ`.replace(/\s+/g, ' ').trim();
    const coords = await geocode(query);
    if (coords) {
      item.latitude = coords.lat;
      item.longitude = coords.lng;
    } else {
      // Retry without zip
      const fallback = `${item.address}, ${item.city || ''}, AZ`.replace(/\s+/g, ' ').trim();
      const coords2 = await geocode(fallback);
      if (coords2) {
        item.latitude = coords2.lat;
        item.longitude = coords2.lng;
      }
    }
    if (i % 10 === 0) {
      console.log(`geocoded ${i + 1}/${items.length}`);
    }
    await sleep(80);
  }
}

function randomDiscountSuffix(length = 4) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function generateDiscountCode(name) {
  const clean = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const merchant = clean.length >= 6 ? clean.slice(0, 6) : clean + randomDiscountSuffix(6 - clean.length);
  return `VEND-${merchant}-0PCT-${randomDiscountSuffix(4)}`;
}

async function main() {
  console.log('Parsing vendors...');
  const vendors = loadVendors();
  console.log(`Loaded ${vendors.length} vendors`);

  // Apply station mapping from stop pages
  const metro = parseMetroStop('metro-pkwy.html', 'Metro Pkwy');
  const stationByPhone = new Map();
  const stationByName = new Map();
  for (const m of metro) {
    const digits = normalizePhone(m.phone);
    if (digits) stationByPhone.set(digits, m.station);
    const key = m.name.toLowerCase();
    if (!stationByName.has(key)) stationByName.set(key, m.station);
  }
  for (const v of vendors) {
    const digits = normalizePhone(v.phone);
    if (digits && stationByPhone.has(digits)) {
      v.station = stationByPhone.get(digits);
    } else if (stationByName.has(v.name.toLowerCase())) {
      v.station = stationByName.get(v.name.toLowerCase());
    }
  }

  console.log('Parsing apartments...');
  const apartments = loadApartments();
  console.log(`Loaded ${apartments.length} apartments`);

  console.log('Geocoding vendors...');
  await geocodeItems(vendors);
  console.log('Geocoding apartments...');
  await geocodeItems(apartments);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Deleting existing vendors and apartments...');
    await client.query('DELETE FROM vendors');
    await client.query('DELETE FROM apartments_hotels');

    const membership = await client.query('SELECT id FROM cards WHERE is_membership = true LIMIT 1');
    const membershipId = membership.rows[0]?.id;
    if (!membershipId) throw new Error('Membership card not found');
    console.log('Membership card:', membershipId);

    console.log('Inserting vendors...');
    let vendorCount = 0;
    for (const v of vendors) {
      const fullAddress = `${v.address}, ${v.city}, ${v.state} ${v.zip}`.replace(/\s+/g, ' ').trim();
      const location = fullAddress;
      const vendorRes = await client.query(
        `INSERT INTO vendors (name, location, address, city, category, phone, status, latitude, longitude, website, station)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [v.name, location, v.address, v.city, v.category, v.phone, 'approved', v.latitude || null, v.longitude || null, v.website, v.station],
      );
      const vendorId = vendorRes.rows[0].id;

      await client.query(
        `INSERT INTO card_vendors (card_id, vendor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [membershipId, vendorId],
      );

      const discountCode = generateDiscountCode(v.name);
      await client.query(
        `INSERT INTO discounts (card_id, vendor_id, type, value, discount_code, description, active, boosted)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (card_id, vendor_id) DO UPDATE SET type = EXCLUDED.type, value = EXCLUDED.value, discount_code = EXCLUDED.discount_code, description = EXCLUDED.description, active = true, boosted = EXCLUDED.boosted, updated_at = now()`,
        [membershipId, vendorId, 'percent', 0, discountCode, 'No discount', true, false],
      );
      vendorCount++;
    }

    console.log('Inserting apartments...');
    let aptCount = 0;
    for (const a of apartments) {
      const fullAddress = `${a.address}, ${a.city}, ${a.state} ${a.zip || ''}`.replace(/\s+/g, ' ').trim();
      const location = fullAddress;
      await client.query(
        `INSERT INTO apartments_hotels (name, section, station, address, city, state, zip, phone, website, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [a.name, a.section, a.station || null, a.address, a.city, a.state, a.zip || null, a.phone || null, a.website, a.latitude || null, a.longitude || null],
      );
      aptCount++;
    }

    console.log('Ensuring admin user...');
    const existingAdmin = await client.query('SELECT id FROM admins WHERE email = $1 LIMIT 1', [ADMIN_EMAIL]);
    if (existingAdmin.rows.length === 0) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await client.query('INSERT INTO admins (email, password_hash, role) VALUES ($1, $2, $3)', [ADMIN_EMAIL, hash, 'owner']);
      console.log('Created admin', ADMIN_EMAIL);
    } else {
      console.log('Admin already exists');
    }

    await client.query('COMMIT');
    console.log(`Inserted ${vendorCount} vendors and ${aptCount} apartments`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    throw err;
  } finally {
    client.release();
  }
  await pool.end();
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
