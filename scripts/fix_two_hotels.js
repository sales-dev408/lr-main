const { Client } = require('pg');
const DB = 'postgresql://postgres.okbolfpndeakmchpznmt:gfdsfgdfgsdrgeert@aws-1-us-east-2.pooler.supabase.com:5432/postgres';
const MAPBOX = 'pk.eyJ1Ijoic2FsZXMtZGV2MTIzIiwiYSI6ImNtc2kyYmJiOTA2d24yeG4xemxya3ZyNzYifQ.CynLROdxurBurDNpKJTfFQ';
async function geo(q) {
  const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX}&limit=1&country=US&bbox=-112.6,33.1,-111.4,33.8`);
  const d = await r.json();
  const f = d.features && d.features[0];
  return f ? { lng: f.center[0], lat: f.center[1], place: f.place_name } : null;
}
(async () => {
  const c = new Client(DB);
  await c.connect();
  for (const [like, addr, zip] of [
    ['Extended Stay America%', '217 W Osborn Rd, Phoenix, AZ 85013', '85013'],
    ['TownePlace Suites Phoenix North', '9425 N Black Canyon Hwy, Phoenix, AZ 85021', '85021'],
  ]) {
    const g = await geo(addr);
    console.log(like, '->', g && g.place);
    await c.query(
      'update apartments_hotels set address=$1, city=$2, zip=$3, "latitude"=$4, "longitude"=$5 where name like $6',
      [addr, 'Phoenix', zip, g.lat, g.lng, like],
    );
  }
  await c.end();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
