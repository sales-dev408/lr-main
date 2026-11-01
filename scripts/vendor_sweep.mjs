// Vendor health sweep: checks every approved vendor against the Mapbox
// Places/Geocoding API. A vendor is flagged "possibly closed" when no POI
// matching its name exists near its coordinates. For each closed candidate it
// finds a nearby open replacement of a similar category. Emits:
//   out/report.md          — human-readable report
//   out/vendor_sweep.sql   — DELETEs for closed vendors + INSERTs for
//                            suggested replacements (NEVER executed here)
// Env: DATABASE_URL (pg connection string), MAPBOX_ACCESS_TOKEN.
import { writeFileSync, mkdirSync } from 'node:fs';
import pg from 'pg';

const { DATABASE_URL, MAPBOX_ACCESS_TOKEN } = process.env;
if (!DATABASE_URL || !MAPBOX_ACCESS_TOKEN) {
  console.error('DATABASE_URL and MAPBOX_ACCESS_TOKEN are required');
  process.exit(1);
}

const norm = (s) => (s || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
const namesSimilar = (a, b) => {
  const ta = new Set((a || '').toLowerCase().match(/[a-z0-9]+/g) || []);
  const tb = new Set((b || '').toLowerCase().match(/[a-z0-9]+/g) || []);
  if (!ta.size || !tb.size) return false;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size) >= 0.6;
};
const meters = (lat1, lon1, lat2, lon2) => {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);

async function geocode(query, proximity) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
    + `?access_token=${MAPBOX_ACCESS_TOKEN}&limit=3&country=US&types=poi,address`
    + (proximity ? `&proximity=${proximity.lng},${proximity.lat}` : '');
  const res = await fetch(url);
  if (!res.ok) return [];
  return (await res.json()).features || [];
}

// Is this vendor still operating? Search for the business name near its
// coordinates; a POI match within 400 m of the same-ish name means open.
async function checkVendor(v) {
  const anchor = v.latitude != null ? { lat: v.latitude, lng: v.longitude } : { lat: 33.448, lng: -112.074 };
  const features = await geocode(v.name, anchor);
  const match = features.find((f) => {
    if (!f.center) return false;
    const d = meters(anchor.lat, anchor.lng, f.center[1], f.center[0]);
    const name = f.text || f.place_name?.split(',')[0] || '';
    return d <= 400 && namesSimilar(name, v.name);
  });
  return { closed: !match, match: match ? match.place_name : null, anchor };
}

// Find an open nearby business of the same general kind as a closed vendor.
async function findReplacement(v, anchor) {
  const queries = [v.cuisine, v.category, v.vendor_type].filter(Boolean);
  for (const q of queries) {
    const features = await geocode(q, anchor);
    for (const f of features) {
      const name = f.text || f.place_name?.split(',')[0] || '';
      const d = f.center ? meters(anchor.lat, anchor.lng, f.center[1], f.center[0]) : Infinity;
      if (d <= 800 && !namesSimilar(name, v.name)) {
        return { name, address: (f.place_name || '').split(',').slice(1).join(',').trim(), lat: f.center[1], lng: f.center[0], source: q };
      }
    }
    await sleep(150);
  }
  return null;
}

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const vendors = (await client.query(
  `SELECT id, name, address, city, category, vendor_type, cuisine, station, latitude, longitude
   FROM vendors WHERE status = 'approved' ORDER BY name${process.env.VENDOR_SWEEP_LIMIT ? ' LIMIT ' + Number(process.env.VENDOR_SWEEP_LIMIT) : ''}`,
)).rows;
console.log(`sweeping ${vendors.length} vendors`);

const closed = [];
for (const v of vendors) {
  try {
    const r = await checkVendor(v);
    if (r.closed) {
      const replacement = await findReplacement(v, r.anchor);
      closed.push({ vendor: v, replacement });
      console.log(`CLOSED? ${v.name} -> ${replacement ? replacement.name : 'no replacement found'}`);
    }
  } catch (e) {
    console.log(`ERROR ${v.name}: ${e.message}`);
  }
  await sleep(120);
}
await client.end();

mkdirSync('out', { recursive: true });
const now = new Date().toISOString().slice(0, 10);
let md = `# Vendor sweep — ${now}\n\nChecked ${vendors.length} vendors via the Mapbox Places API. ${closed.length} could not be found near their coordinates and may be closed. Review before running the SQL.\n\n| Vendor | Address | Station | Status | Suggested replacement |\n|---|---|---|---|---|\n`;
let statements = '-- Vendor sweep SQL. Review carefully before executing.\nBEGIN;\n\n';
for (const { vendor: v, replacement: r } of closed) {
  md += `| ${v.name} | ${v.address || ''} | ${v.station || ''} | possibly closed | ${r ? `${r.name} — ${r.address}` : '_none found_'} |\n`;
  statements += `-- ${v.name} (${v.address || 'no address'})\n`
    + `DELETE FROM discounts WHERE vendor_id = '${v.id}';\n`
    + `DELETE FROM card_vendors WHERE vendor_id = '${v.id}';\n`
    + `DELETE FROM vendors WHERE id = '${v.id}';\n`;
  if (r) {
    const terms = 'Cannot be applied with any other offer\\nNot redeemable for cash\\nCan be used 1 time per week';
    statements += `INSERT INTO vendors (name, location, address, city, category, vendor_type, station, latitude, longitude, discount_terms, status)\n`
      + `VALUES (${sql(r.name)}, ${sql(r.address)}, ${sql(r.address)}, ${sql(v.city || 'Phoenix')}, ${sql(v.category)}, ${sql(v.vendor_type)}, ${sql(v.station)}, ${r.lat}, ${r.lng}, ${sql(terms)}, 'approved')\n`
      + `RETURNING id; -- then link: INSERT INTO card_vendors + discounts (see import scripts)\n\n`;
  }
}
statements += 'COMMIT;\n';
md += `\n_SQL written to vendor_sweep.sql. Nothing was modified in the database._\n`;
writeFileSync('out/report.md', md);
writeFileSync('out/vendor_sweep.sql', statements);
console.log(`done: ${closed.length} closed candidates; see out/report.md and out/vendor_sweep.sql`);
