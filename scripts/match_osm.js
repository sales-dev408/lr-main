// Match vendors needing contact info against OSM POIs (name + proximity).
const fs = require('fs');
const need = JSON.parse(fs.readFileSync(__dirname + '/out/need_contact.json', 'utf8'));
const osm = JSON.parse(fs.readFileSync(__dirname + '/out/osm_pois.json', 'utf8'));

const norm = (s) => (s || '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]/g, '');
const STOP = new Set(['the', 'and', 'for', 'llc', 'inc', 'co', 'of', 'at', 'in', 'on', 'phoenix', 'az', 'arizona', 'downtown', 'bar', 'grill', 'cafe', 'restaurant', 'shop', 'store', 'suite', 'ste', 'tempe', 'mesa', 'center', 'street', 'st', 'ave', 'avenue', 'rd', 'road']);
const tokens = (s) => new Set((s || '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t)));
const hav = (a, b, c, d) => { const R = 6371000, t = (x) => (x * Math.PI) / 180; const h = Math.sin(t(c - a) / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(t(d - b) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

const BIZ_KEYS = ['amenity', 'shop', 'tourism', 'office', 'craft', 'leisure'];
const pois = osm
  .filter((e) => e.tags && e.tags.name && BIZ_KEYS.some((k) => e.tags[k]))
  .map((e) => ({
    name: e.tags.name,
    lat: e.lat ?? e.center?.lat,
    lng: e.lon ?? e.center?.lon,
    phone: e.tags.phone || e.tags['contact:phone'] || null,
    web: e.tags.website || e.tags['contact:website'] || e.tags.url || e.tags['contact:url'] || null,
  }));

const byName = new Map();
for (const p of pois) {
  const k = norm(p.name);
  if (!byName.has(k)) byName.set(k, []);
  byName.get(k).push(p);
}

const results = [];
for (const v of need) {
  let hit = (byName.get(norm(v.name)) || []).find((e) => hav(v.latitude, v.longitude, e.lat, e.lng) < 350);
  let how = 'exact';
  if (!hit) {
    const vt = tokens(v.name);
    if (vt.size) {
      let best = null, bestScore = 0, bestD = 0;
      for (const e of pois) {
        const d = hav(v.latitude, v.longitude, e.lat, e.lng);
        if (d > 150) continue;
        const et = tokens(e.name);
        if (!et.size) continue;
        const inter = [...vt].filter((x) => et.has(x)).length;
        if (!inter) continue;
        const score = inter / Math.max(vt.size, et.size);
        const ok = (inter >= 2 && score >= 0.6 && d < 150) || (inter >= 1 && score >= 0.75 && d < 80);
        if (ok && score > bestScore) { best = e; bestScore = score; bestD = d; }
      }
      hit = best;
      how = `loose score=${bestScore.toFixed(2)} d=${Math.round(bestD)}m`;
    }
  }
  if (hit && (hit.phone || hit.web)) {
    results.push({ id: v.id, name: v.name, phone: hit.phone, website: hit.web, osm: hit.name, how });
  }
}
fs.writeFileSync(__dirname + '/out/osm_matches.json', JSON.stringify(results, null, 1));
console.log('matched:', results.length, 'of', need.length);
console.log('loose:', results.filter((r) => r.how !== 'exact').map((r) => `${r.name} ~ ${r.osm} (${r.how})`).join('\n'));
