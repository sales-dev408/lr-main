// Enrich unmatched records: Mapbox geocode + DuckDuckGo Lite website lookup.
const fs = require('fs');
const records = JSON.parse(fs.readFileSync('out/unmatched.json', 'utf8'));
const stops = JSON.parse(fs.readFileSync('out/db_stops.json', 'utf8'));

const MAPBOX = 'pk.eyJ1Ijoic2FsZXMtZGV2MTIzIiwiYSI6ImNtc2kyYmJiOTA2d24yeG4xemxya3ZyNzYifQ.CynLROdxurBurDNpKJTfFQ';
const stopCity = new Map(stops.map(s => [s.name, s.city]));

// Well-known chain/brand domains (avoid searches where confident)
const KNOWN = {
  "fry's food & drug": 'https://www.frysfood.com', "fry's food stores": 'https://www.frysfood.com', "fry's pharmacy": 'https://www.frysfood.com',
  'cvs pharmacy': 'https://www.cvs.com', 'cvs pharmacy at target': 'https://www.cvs.com',
  'the ups store': 'https://www.theupsstore.com', 'fedex office': 'https://www.fedex.com',
  'cityscape phoenix': 'https://www.cityscapephoenix.com', 'arizona center': 'https://arizonacenter.com',
  'sixt rent a car': 'https://www.sixt.com', 'enterprise truck rental': 'https://www.enterprisetrucks.com',
  'enterprise rent-a-car': 'https://www.enterprise.com',
  'phoenix sky harbor international airport': 'https://www.skyharbor.com', 'phx sky harbor international airport': 'https://www.skyharbor.com',
  'phx rental cars': 'https://www.skyharbor.com', 'asu downtown phoenix campus': 'https://www.asu.edu',
  'a.e. england building': 'https://www.asu.edu', 'university center': 'https://www.asu.edu',
  'walter cronkite school / cronkite building': 'https://cronkite.asu.edu',
  'asu beus center for law and society': 'https://law.asu.edu', "sandra day o'connor college of law": 'https://law.asu.edu',
  'edson college of nursing and health innovation': 'https://nursingandhealth.asu.edu',
  'health north': 'https://www.asu.edu', 'health south': 'https://www.asu.edu',
  'sun devil fitness complex': 'https://fitness.asu.edu', 'asu post office': 'https://www.asu.edu',
  'asu prep academy': 'https://asuprep.asu.edu', 'thunderbird school of global management': 'https://thunderbird.asu.edu',
  'lincoln family downtown ymca': 'https://valleyymca.org', 'lincoln family ymca': 'https://valleyymca.org',
  'herberger theater center': 'https://www.herbergertheater.org',
  'sun devil marketplace': 'https://www.bkstr.com', 'sun devil campus store': 'https://www.bkstr.com',
  'arizona state university': 'https://www.asu.edu', 'asu sun devil stadium': 'https://thesundevils.com',
  'urban outfitters': 'https://www.urbanoutfitters.com', 'amc centerpoint 11': 'https://www.amctheatres.com',
  'zia records': 'https://www.ziarecords.com', 'trader joes': 'https://www.traderjoes.com', "trader joe's": 'https://www.traderjoes.com',
  'tempe marketplace': 'https://www.tempemarketplace.com', 'target': 'https://www.target.com',
  'target uptown camelback': 'https://www.target.com', 'target optical': 'https://www.targetoptical.com',
  'barnes & noble': 'https://www.barnesandnoble.com', 'harkins theatres tempe marketplace 16': 'https://www.harkins.com',
  'harkins theatres christown': 'https://www.harkins.com', "dave & buster's": 'https://www.daveandbusters.com',
  'miniso': 'https://www.miniso.com', 'meet fresh': 'https://meetfresh.com', 'haidilao': 'https://www.haidilao.com',
  'h mart': 'https://www.hmart.com', 'walmart supercenter': 'https://www.walmart.com', 'walmart-area retail': 'https://www.walmart.com',
  'safeway': 'https://www.safeway.com', 'albertsons': 'https://www.albertsons.com', 'albertsons pharmacy': 'https://www.albertsons.com',
  'sprouts farmers market': 'https://www.sprouts.com', 'bookmans entertainment exchange': 'https://bookmans.com',
  't-mobile authorized retailer': 'https://www.t-mobile.com', 'metro by t-mobile': 'https://www.metrobyt-mobile.com',
  'walgreens': 'https://www.walgreens.com', 'ross dress for less': 'https://www.rossstores.com',
  'burlington': 'https://www.burlington.com', 'big 5 sporting goods': 'https://www.big5sportinggoods.com',
  'foot locker': 'https://www.footlocker.com', 'famous footwear': 'https://www.famousfootwear.com',
  'journeys': 'https://www.journeys.com', 'petsmart': 'https://www.petsmart.com', 'hobby lobby': 'https://www.hobbylobby.com',
  'ulta beauty': 'https://www.ulta.com', "america's best": 'https://www.americasbest.com', 'visionworks': 'https://www.visionworks.com',
  'gamestop': 'https://www.gamestop.com', 'bank of america': 'https://www.bankofamerica.com',
  'wells fargo': 'https://www.wellsfargo.com', 'west elm': 'https://www.westelm.com',
  'road runner sports': 'https://www.roadrunnersports.com', "aj's fine foods": 'https://www.ajsfinefoods.com',
  'flagstar bank': 'https://www.flagstar.com', 'capsule': 'https://www.capsule.com',
  'shake shack': 'https://www.shakeshack.com', 'salt & straw': 'https://www.saltandstraw.com',
  'uptown plaza': 'https://uptownplazaphx.com', 'pxg parsons xtreme golf': 'https://www.pxg.com',
  'mesa arts center': 'https://www.mesaartscenter.com', 'arizona museum of natural history': 'https://www.arizonamuseum.org',
  'phoenix college': 'https://www.phoenixcollege.edu',
  'phoenix college center for nursing excellence': 'https://www.phoenixcollege.edu',
  'phoenix college center of excellence for healthcare education': 'https://www.phoenixcollege.edu',
  'brophy college preparatory': 'https://www.brophybroncos.org', 'brophy graham family sports campus': 'https://www.brophybroncos.org',
  'south mountain park and preserve': 'https://www.phoenix.gov/parks',
  'maxine o. bush elementary school': 'https://www.phoenixelementary.org',
  // hotel brands
  'the westin phoenix downtown': 'https://www.marriott.com', 'hyatt place phoenix / downtown': 'https://www.hyatt.com',
  'hilton garden inn phoenix downtown': 'https://www.hilton.com', 'renaissance phoenix downtown hotel': 'https://www.marriott.com',
  'ac hotel phoenix downtown': 'https://www.marriott.com', 'ac hotel phoenix tempe/downtown': 'https://www.marriott.com',
  'cambria hotel downtown phoenix convention center': 'https://www.choicehotels.com',
  'hyatt regency phoenix': 'https://www.hyatt.com', 'hampton inn & suites phoenix downtown': 'https://www.hilton.com',
  'sheraton phoenix downtown': 'https://www.marriott.com', 'sheraton phoenix crescent hotel': 'https://www.marriott.com',
  'kimpton hotel palomar phoenix': 'https://www.ihg.com', 'moxy phoenix downtown': 'https://www.marriott.com',
  'moxy phoenix tempe/asu area': 'https://www.marriott.com', 'courtyard phoenix downtown': 'https://www.marriott.com',
  'courtyard phoenix north': 'https://www.marriott.com', 'residence inn phoenix downtown': 'https://www.marriott.com',
  'residence inn tempe downtown/university': 'https://www.marriott.com', 'towneplace suites phoenix north': 'https://www.marriott.com',
  'home2 suites by hilton phoenix downtown': 'https://www.hilton.com',
  'hotel san carlos': 'https://www.hotelsancarlos.com',
  'motel 6 phoenix - airport - 24th street': 'https://www.motel6.com', 'motel 6 mesa - downtown': 'https://www.motel6.com',
  'fairfield inn & suites phoenix midtown': 'https://www.marriott.com',
  'hampton inn phoenix-midtown-downtown area': 'https://www.hilton.com',
  'hampton inn phoenix-airport north': 'https://www.hilton.com',
  'extended stay america suites - phoenix - midtown': 'https://www.extendedstayamerica.com',
  'embassy suites by hilton phoenix downtown north': 'https://www.hilton.com',
  'hilton garden inn phoenix midtown': 'https://www.hilton.com', 'hilton garden inn phoenix airport north': 'https://www.hilton.com',
  'rise uptown hotel': 'https://www.riseuptownhotel.com', 'best western north phoenix hotel': 'https://www.bestwestern.com',
  'doubletree by hilton phoenix north': 'https://www.hilton.com', 'doubletree suites by hilton phoenix': 'https://www.hilton.com',
  'comfort suites phoenix north': 'https://www.choicehotels.com', 'aloft phoenix-airport': 'https://www.marriott.com',
  'crowne plaza phoenix airport': 'https://www.ihg.com', 'radisson hotel phoenix airport': 'https://www.radissonhotels.com',
  'holiday inn express & suites phoenix - airport north': 'https://www.ihg.com',
  'tempe mission palms': 'https://www.missionpalms.com', 'sonesta select tempe downtown': 'https://www.sonesta.com',
  'vib hotel by best western phoenix-tempe': 'https://www.bestwestern.com',
  'canopy by hilton tempe downtown': 'https://www.hilton.com', 'the westin tempe': 'https://www.marriott.com',
  'omni tempe hotel at asu': 'https://www.omnihotels.com', 'graduate by hilton tempe': 'https://www.hilton.com',
  'hyatt place tempe/phoenix/university': 'https://www.hyatt.com', 'hyatt house tempe/phoenix/university': 'https://www.hyatt.com',
  'super 8 by wyndham tempe/asu/airport': 'https://www.wyndhamhotels.com',
  'super 8 by wyndham mesa downtown near convention center': 'https://www.wyndhamhotels.com',
  'the 233 suites / unscripted by hyatt': 'https://www.hyatt.com',
  'delta hotels phoenix mesa': 'https://www.marriott.com', 'studio 6 mesa': 'https://www.staystudio6.com',
  'surestay by best western mesa downtown area': 'https://www.bestwestern.com',
};

function nrm(n) {
  return n.toLowerCase().replace(/[''’`]/g, "'").replace(/–/g, '-').replace(/ī/g, 'i').replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
}
const KNOWN_N = {};
for (const k of Object.keys(KNOWN)) KNOWN_N[nrm(k)] = KNOWN[k];

const AGGREGATORS = /^(www\.)?(yelp|tripadvisor|facebook|instagram|yellowpages|mapquest|bbb\.org|foursquare|google|bing|linkedin|nextdoor|reddit|apple|maps)/i;
const SOFT_AGG = /^(www\.)?(yelp|tripadvisor|yellowpages|mapquest|bbb\.org|foursquare|nextdoor|reddit)/i;

async function geocode(addr, name) {
  const q = encodeURIComponent(addr || name);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${MAPBOX}&limit=1&country=US&bbox=-112.6,33.1,-111.4,33.8`;
  const r = await fetch(url);
  const d = await r.json();
  if (d.features && d.features[0]) return { lng: d.features[0].center[0], lat: d.features[0].center[1], place: d.features[0].place_name };
  return null;
}

async function ddgSite(query) {
  const url = 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(query);
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' } });
  const html = await r.text();
  const links = [...html.matchAll(/uddg=(https?%3A%2F%2F[^&"']+)/g)].map(m => decodeURIComponent(m[1]));
  return links;
}

function pickSite(urls, name) {
  const nameTokens = nrm(name).replace(/[^a-z0-9 ]/g, '').split(' ').filter(t => t.length > 3 && !/salon|shop|store|hotel|apartments|the|and/.test(t));
  for (const u of urls) {
    try {
      const host = new URL(u).hostname;
      if (!AGGREGATORS.test(host)) return { url: u.split('?')[0].replace(/\/$/, ''), how: 'ddg' };
    } catch {}
  }
  // fall back to first soft aggregator (it's still a usable page for the biz)
  for (const u of urls) {
    try {
      const host = new URL(u).hostname;
      if (SOFT_AGG.test(host)) return { url: u, how: 'ddg-agg' };
    } catch {}
  }
  for (const u of urls) {
    try { const host = new URL(u).hostname; if (!/google|bing|duckduckgo/.test(host)) return { url: u, how: 'ddg-any' }; } catch {}
  }
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const enriched = [];
  let i = 0;
  for (const r of records) {
    i++;
    const city = stopCity.get(r.station) || (/(mesa|tempe|phoenix)/i.exec(r.address || '') || [null])[0] || 'Phoenix';
    const addrFull = r.address && /\d/.test(r.address)
      ? (/,/.test(r.address) ? r.address : `${r.address}, ${city}, AZ`)
      : `${r.name} ${r.address || ''} ${city} AZ`.trim();
    const geo = await geocode(addrFull, r.name + ' ' + city + ' AZ');

    let website = null, webHow = null;
    if (r.websiteHint && /^https?:\/\//.test(r.websiteHint)) { website = r.websiteHint; webHow = 'doc'; }
    else if (KNOWN_N[nrm(r.name)]) { website = KNOWN_N[nrm(r.name)]; webHow = 'known'; }
    else if (r.websiteHint && /^(target|walmart|fry|cvs|walgreens|starbucks|mcdonald|subway|dunkin|taco bell|chick-fil|chipotle|panda|sonic|jack in the box|popeyes|arbys|burger king|kfc|domino|pizza hut|little caesar|jimmy john|panera|five guys|wingstop|raising cane|in-n-out|del taco|rally|dairy queen|peter piper|barro|filiberto)/i.test(r.websiteHint)) {
      const urls = await ddgSite(`${r.websiteHint} official site`);
      const p = pickSite(urls, r.name);
      if (p) { website = p.url; webHow = p.how; }
      await sleep(400);
    } else {
      const q = `${r.name} ${city} AZ${r.address && /\d/.test(r.address) ? ' ' + r.address.split(',')[0] : ''}`;
      const urls = await ddgSite(q);
      const p = pickSite(urls, r.name);
      if (p) { website = p.url; webHow = p.how; }
      await sleep(400);
    }
    enriched.push({ ...r, city, geocode: geo, website, webHow });
    console.log(`${String(i).padStart(3)}/${records.length} ${r.name.slice(0, 38).padEnd(38)} geo:${geo ? 'Y' : 'N'} web:${website || '-'} (${webHow || '-'})`);
  }
  fs.writeFileSync('out/enriched.json', JSON.stringify(enriched, null, 1));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
