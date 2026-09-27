const { Client } = require('pg');
const DB = 'postgresql://postgres.okbolfpndeakmchpznmt:gfdsfgdfgsdrgeert@aws-1-us-east-2.pooler.supabase.com:5432/postgres';
const MAPBOX = 'pk.eyJ1Ijoic2FsZXMtZGV2MTIzIiwiYSI6ImNtc2kyYmJiOTA2d24yeG4xemxya3ZyNzYifQ.CynLROdxurBurDNpKJTfFQ';

const SPECIAL = {
  'Metro Parkway': { lat: 33.6357, lng: -112.1168 },
  'Thelda Williams Transit Center': { lat: 33.6352, lng: -112.1166 },
  'Downtown Phx Hub / Jefferson St': { lat: 33.4453, lng: -112.0743 },
  'Downtown Phx Hub / Washington St': { lat: 33.4483, lng: -112.0738 },
  'Downtown Phx Hub / Central Ave': { lat: 33.4476, lng: -112.0736 },
  'Downtown Phx Hub / 1st Ave': { lat: 33.4464, lng: -112.0762 },
};

async function geo(q) {
  const r = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX}&limit=1&country=US&bbox=-112.6,33.1,-111.4,33.8`,
  );
  const d = await r.json();
  const f = d.features && d.features[0];
  return f ? { lng: f.center[0], lat: f.center[1], place: f.place_name } : null;
}

(async () => {
  const c = new Client(DB);
  await c.connect();
  const stops = (await c.query('select id,name,city from stops')).rows;
  let n = 0;
  for (const s of stops) {
    let g = SPECIAL[s.name] || null;
    if (!g) {
      // "19th Ave / Camelback" -> "19th Ave & Camelback Rd, Phoenix, AZ"
      const inter = s.name.split('/').map((p) => p.trim()).join(' & ');
      const query = `${inter}, ${s.city || 'Phoenix'}, AZ`;
      g = await geo(query);
      if (!g) g = await geo(`${s.name} station, ${s.city || 'Phoenix'}, AZ`);
      if (g) {
        // sanity: result should share at least one street token with the name
        const toks = s.name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter((t) => t.length > 3);
        const ok = toks.some((t) => g.place.toLowerCase().includes(t));
        if (!ok) console.log('  weak match:', s.name, '->', g.place);
      }
    }
    if (g) {
      await c.query('update stops set "latitude"=$1, "longitude"=$2 where id=$3', [g.lat, g.lng, s.id]);
      n++;
      console.log(s.name.padEnd(40), g.lat.toFixed(5), g.lng.toFixed(5));
    } else {
      console.log('NO GEO:', s.name);
    }
  }
  console.log('geocoded', n, 'of', stops.length);
  await c.end();
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
