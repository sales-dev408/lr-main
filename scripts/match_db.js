// Match parsed doc records against existing DB vendors / apartments_hotels.
const fs = require('fs');
const docs = JSON.parse(fs.readFileSync('out/parsed.json', 'utf8'));
const vendors = JSON.parse(fs.readFileSync('out/db_vendors.json', 'utf8'));
const apts = JSON.parse(fs.readFileSync('out/db_apts.json', 'utf8'));

function norm(n) {
  return (n || '').toLowerCase()
    .replace(/[''’`]/g, '').replace(/&/g, 'and')
    .replace(/\b(at|the|of)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '');
}
function normLoose(n) {
  // also drop trailing location qualifiers ("- CityScape Phoenix", "– Bethany Home", "— Thomas Rd")
  let s = (n || '').toLowerCase()
    .replace(/[''’`]/g, '').replace(/&/g, 'and')
    .replace(/[–—-]\s*\(?\s*(cityscape|bethany|downtown|tempe|central|southern|19th|walmart|asu|phoenix|thomas|treat|north).*$/i, '')
    .replace(/[–—]\s*.*$/, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\b(at|the|of)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '');
  return s;
}
function normAddr(a) {
  if (!a) return '';
  return a.toLowerCase().replace(/[.,#]/g, ' ').replace(/\b(street|st)\b/g, 'st').replace(/\b(avenue|ave)\b/g, 'ave')
    .replace(/\b(road|rd)\b/g, 'rd').replace(/\b(boulevard|blvd)\b/g, 'blvd').replace(/\b(drive|dr)\b/g, 'dr')
    .replace(/\s+/g, ' ').trim();
}
function addrNum(a) { const m = (a || '').match(/\b(\d+)\b/); return m ? m[1] : null; }

const vendorByName = new Map();
for (const v of vendors) {
  for (const k of [norm(v.name), normLoose(v.name)]) {
    if (!k) continue;
    if (!vendorByName.has(k)) vendorByName.set(k, []);
    vendorByName.get(k).push(v);
  }
}
const aptByName = new Map();
for (const a of apts) {
  for (const k of [norm(a.name), normLoose(a.name)]) {
    if (!k) continue;
    if (!aptByName.has(k)) aptByName.set(k, []);
    aptByName.get(k).push(a);
  }
}

const matched = [], unmatched = [], ambiguous = [];

for (const r of docs) {
  const table = r.kind === 'apt_hotel' ? aptByName : vendorByName;
  const keys = [norm(r.name), normLoose(r.name)];
  let cands = [];
  for (const k of keys) if (k && table.has(k)) cands = cands.concat(table.get(k));
  // dedupe cands
  cands = [...new Map(cands.map(c => [c.id, c])).values()];

  // prefix matching fallback (e.g. "Bitter & Twisted" vs "Bitter & Twisted Cocktail Parlour")
  if (!cands.length) {
    const nk = norm(r.name), nl = normLoose(r.name);
    const pool = r.kind === 'apt_hotel' ? apts : vendors;
    for (const v of pool) {
      for (const vk of [norm(v.name), normLoose(v.name)]) {
        if (!vk) continue;
        if ((nk.length >= 6 && vk.startsWith(nk)) || (nl.length >= 6 && vk.startsWith(nl)) ||
            (vk.length >= 6 && nk.startsWith(vk)) || (vk.length >= 6 && nl.startsWith(vk))) {
          cands.push(v); break;
        }
      }
    }
    cands = [...new Map(cands.map(c => [c.id, c])).values()];
  }

  if (!cands.length) { unmatched.push(r); continue; }
  if (cands.length === 1) { matched.push({ rec: r, row: cands[0], how: 'name' }); continue; }

  // disambiguate by station, then address number, then city
  let pick = cands.filter(c => c.station === r.station);
  if (pick.length !== 1) {
    const num = addrNum(r.address);
    if (num) {
      const pn = cands.filter(c => addrNum(c.address || c.location) === num);
      if (pn.length) pick = pn;
    }
  }
  if (pick.length !== 1 && cands.length > 0) pick = cands;
  if (pick.length === 1) matched.push({ rec: r, row: pick[0], how: 'disambig' });
  else { matched.push({ rec: r, row: pick[0], how: 'ambiguous-took-first' }); ambiguous.push({ rec: r, cands: pick.map(c => ({ id: c.id, name: c.name, station: c.station, address: c.address })) }); }
}

// Consolidate unmatched: same normalized name + same street number => same physical
// business listed at multiple stops; keep first (docs list nearest first).
function streetOf(a) {
  const m = (a || '').match(/\b\d+\s+([NSEW]?\s*[A-Za-z.]+)/);
  return m ? m[1].toLowerCase().replace(/\./g, '') : null;
}
const seen = new Map();
const consolidated = [];
for (const r of unmatched) {
  const key = norm(r.name) + '|' + (addrNum(r.address) || '') + '|' + (streetOf(r.address) || '');
  const key2 = norm(r.name) + '|' + (addrNum(r.address) || 'x');
  if (seen.has(key) || seen.has(key2)) {
    const prev = seen.get(key) || seen.get(key2);
    for (const f of ['type', 'address', 'phone', 'websiteHint']) if (!prev[f] && r[f]) prev[f] = r[f];
    continue;
  }
  seen.set(key, r); seen.set(key2, r);
  consolidated.push(r);
}

fs.writeFileSync('out/matched.json', JSON.stringify(matched, null, 1));
fs.writeFileSync('out/unmatched.json', JSON.stringify(consolidated, null, 1));
fs.writeFileSync('out/ambiguous.json', JSON.stringify(ambiguous, null, 1));
console.log('matched:', matched.length, 'unmatched(raw):', unmatched.length, 'unmatched(consolidated):', consolidated.length, 'ambiguous:', ambiguous.length);
const unBySrc = {}; consolidated.forEach(r => unBySrc[r.source] = (unBySrc[r.source] || 0) + 1);
console.log('unmatched by source:', unBySrc);
console.log('\n--- UNMATCHED ---');
consolidated.forEach(r => console.log(`${r.source.padEnd(7)} | ${r.name} | ${r.station} | ${r.address} | ${r.phone || '-'} | ${r.type}`));
console.log('\n--- AMBIGUOUS ---');
ambiguous.forEach(a => console.log(a.rec.name, '|', a.rec.station, '=>', JSON.stringify(a.cands.map(c => c.name + '@' + c.station))));
