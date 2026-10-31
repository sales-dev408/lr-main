// Find duplicate vendors created in the last N hours by the services import:
// same normalized address AND (similar name OR same website domain) as another
// vendor row. Keeps pre-existing rows over new ones, and the richest new row
// among themselves. --dry to preview. Deleting removes vendor + card_vendors +
// discounts rows.
const { Client } = require('pg');
const DB = process.env.DATABASE_URL;
const DRY = process.argv.includes('--dry');
const HOURS = Number(process.env.HOURS || 3);

const norm = (s) => (s || '').toLowerCase().replace(/&/g, ' and ').replace(/[''’]/g, '').replace(/[^a-z0-9]/g, '');
const normAddr = (s) => norm(s)
  .replace(/(suite|ste|unit|apt|bldg|floor|fl|room|rm)[a-z0-9]*$/, '')
  .replace(/street$/, 'st').replace(/avenue$/, 'ave').replace(/road$/, 'rd')
  .replace(/drive$/, 'dr').replace(/boulevard$/, 'blvd').replace(/lane$/, 'ln')
  .replace(/phoenix(az)?\d*$/, '');
const tokens = (s) => new Set((s || '').toLowerCase().replace(/&/g, ' and ').match(/[a-z0-9]+/g) || []);
function namesSimilar(a, b) {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.size || !tb.size) return false;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size) >= 0.7;
}
const GENERIC_DOMAINS = new Set(['dtphx.org', 'google.com', 'www.google.com', 'maps.google.com', 'yelp.com', 'www.yelp.com', 'facebook.com', 'instagram.com']);
const domain = (u) => {
  if (!u) return null;
  const m = /^(?:https?:\/\/)?(?:www\.)?([^/]+)/i.exec(u.trim());
  const d = m ? m[1].toLowerCase() : null;
  return d && !GENERIC_DOMAINS.has(d) ? d : null;
};

(async () => {
  const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const all = (await c.query(
      `SELECT id, name, address, phone, website, created_at,
              (created_at > now() - interval '${HOURS} hours') AS is_new
       FROM vendors ORDER BY created_at`,
    )).rows;
    const byAddr = new Map();
    for (const v of all) {
      const key = normAddr(v.address);
      if (!key) continue;
      if (!byAddr.has(key)) byAddr.set(key, []);
      byAddr.get(key).push(v);
    }
    const byName = new Map();
    for (const v of all) {
      const key = norm(v.name);
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(v);
    }

    const toDelete = new Map(); // id -> reason
    for (const group of byAddr.values()) {
      if (group.length < 2) continue;
      for (const v of group) {
        if (!v.is_new || toDelete.has(v.id)) continue;
        const dup = group.find((o) => o.id !== v.id && (namesSimilar(o.name, v.name) || (domain(o.website) && domain(o.website) === domain(v.website))));
        if (dup) {
          // prefer keeping the row with a phone, else the pre-existing one,
          // else the shorter name
          const keepWins = (!dup.is_new) || (!!dup.phone && !v.phone) || (dup.phone === v.phone && dup.name.length <= v.name.length);
          if (!keepWins) continue;
          toDelete.set(v.id, `addr-dup of '${dup.name}'`);
        }
      }
    }
    // same normalized name (any address) — keep the older row
    for (const group of byName.values()) {
      if (group.length < 2) continue;
      const news = group.filter((v) => v.is_new);
      const olds = group.filter((v) => !v.is_new);
      for (const v of news.slice(olds.length ? 0 : 1)) {
        if (!toDelete.has(v.id)) toDelete.set(v.id, `name-dup of '${(olds[0] || news[0]).name}'`);
      }
    }

    // Same-name-token collisions that are really distinct venues sharing an
    // address (arena vs. its team shop, hotel vs. in-house restaurant).
    const KEEP = new Set(['mortgagematchupcenter', 'residenceinncourtyardbymarriott']);
    const rows = all.filter((v) => toDelete.has(v.id) && !KEEP.has(norm(v.name)));
    for (const v of rows) console.log(`DEL ${v.name} | ${v.address} | ${toDelete.get(v.id)}`);
    console.log(`\n${DRY ? 'DRY ' : ''}duplicates to remove: ${rows.length}`);
    if (!DRY && rows.length) {
      const ids = rows.map((v) => v.id);
      await c.query('DELETE FROM discounts WHERE vendor_id = ANY($1::uuid[])', [ids]);
      await c.query('DELETE FROM card_vendors WHERE vendor_id = ANY($1::uuid[])', [ids]);
      await c.query('DELETE FROM vendors WHERE id = ANY($1::uuid[])', [ids]);
      console.log('deleted.');
    }
  } finally {
    await c.end();
  }
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
