// Match vendors needing contact info against Overture Maps places (name + proximity).
const fs = require('fs');
const need = JSON.parse(fs.readFileSync(__dirname + '/out/need_contact.json', 'utf8'));
const merged = JSON.parse(fs.readFileSync(__dirname + '/out/contact_merged.json', 'utf8'));
const overture = JSON.parse(fs.readFileSync(__dirname + '/out/overture_pois.json', 'utf8'));

const stillNeed = new Map(merged.filter((m) => !m.phone || !m.website).map((m) => [m.id, m]));

const norm = (s) => (s || '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]/g, '');
const STOP = new Set(['the', 'and', 'for', 'llc', 'inc', 'co', 'of', 'at', 'in', 'on', 'phoenix', 'az', 'arizona', 'downtown', 'bar', 'grill', 'cafe', 'restaurant', 'shop', 'store', 'suite', 'ste', 'tempe', 'mesa', 'center', 'street', 'st', 'ave', 'avenue', 'rd', 'road', 'dr']);
const tokens = (s) => new Set((s || '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t)));
const hav = (a, b, c, d) => { const R = 6371000, t = (x) => (x * Math.PI) / 180; const h = Math.sin(t(c - a) / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(t(d - b) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

const pois = overture
  .filter((p) => (p.phones && p.phones.length) || (p.websites && p.websites.length) || (p.socials && p.socials.length))
  .map((p) => ({
    name: p.name,
    brand: p.brand,
    lat: p.lat,
    lng: p.lon,
    phone: (p.phones && p.phones[0]) || null,
    web: (p.websites && p.websites[0]) || (p.socials && p.socials[0]) || null,
  }));

// grid index ~200m cells
const cell = (lat, lng) => `${Math.round(lat / 0.002)}:${Math.round(lng / 0.002)}`;
const grid = new Map();
const byName = new Map();
for (const p of pois) {
  const k = norm(p.name) || norm(p.brand);
  if (k) {
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(p);
  }
  if (p.brand) {
    const bk = norm(p.brand);
    if (bk && bk !== k) {
      if (!byName.has(bk)) byName.set(bk, []);
      byName.get(bk).push(p);
    }
  }
  const ck = cell(p.lat, p.lng);
  if (!grid.has(ck)) grid.set(ck, []);
  grid.get(ck).push(p);
}

function* neighbors(lat, lng, rings) {
  const cy = Math.round(lat / 0.002), cx = Math.round(lng / 0.002);
  for (let dy = -rings; dy <= rings; dy++)
    for (let dx = -rings; dx <= rings; dx++)
      yield grid.get(`${cy + dy}:${cx + dx}`) || [];
}

const results = [];
for (const v of need) {
  const cur = stillNeed.get(v.id) || v;
  if (cur.phone && cur.website) continue;
  let hit = (byName.get(norm(v.name)) || []).find((e) => hav(v.latitude, v.longitude, e.lat, e.lng) < 350);
  let how = 'exact';
  if (!hit) {
    const vt = tokens(v.name);
    if (vt.size) {
      let best = null, bestScore = 0;
      for (const cellPois of neighbors(v.latitude, v.longitude, 1)) {
        for (const e of cellPois) {
          const d = hav(v.latitude, v.longitude, e.lat, e.lng);
          if (d > 150) continue;
          const et = tokens(e.name);
          if (!et.size) continue;
          const inter = [...vt].filter((x) => et.has(x)).length;
          if (!inter) continue;
          const score = inter / Math.max(vt.size, et.size);
          const ok = (inter >= 2 && score >= 0.6 && d < 150) || (inter >= 1 && score >= 0.75 && d < 80);
          if (ok && score > bestScore) { best = e; bestScore = score; }
        }
      }
      hit = best;
      how = 'loose';
    }
  }
  if (hit) {
    results.push({
      id: v.id, name: v.name,
      phone: cur.phone || hit.phone || null,
      website: cur.website || hit.web || null,
      ov: hit.name, how,
    });
  } else {
    results.push({ id: v.id, name: v.name, phone: cur.phone || null, website: cur.website || null, ov: null, how: 'none' });
  }
}
fs.writeFileSync(__dirname + '/out/overture_matches.json', JSON.stringify(results, null, 1));
const matched = results.filter((r) => r.ov);
console.log('overture matched:', matched.length, 'of', need.length);
console.log(matched.filter((r) => r.how === 'loose').slice(0, 25).map((r) => `${r.name} ~ ${r.ov}`).join('\n'));
