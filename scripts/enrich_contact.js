// Fill missing vendor phone/website via DuckDuckGo Lite searches.
// Website: first result on a non-aggregator domain (falls back to any usable page).
// Phone: most frequent (NNN) NNN-NNNN-style number found in result text.
// Output: out/contact_found.json  [{ id, name, phone, website }]
const fs = require('fs');
const records = JSON.parse(fs.readFileSync(__dirname + '/out/need_contact.json', 'utf8'));

const AGGREGATORS = /^(www\.)?(yelp|tripadvisor|facebook|instagram|yellowpages|mapquest|bbb\.org|foursquare|google|bing|linkedin|nextdoor|reddit|apple|maps|duckduckgo|amazon|tiktok|x\.com|twitter)/i;
const SOFT_AGG = /^(www\.)?(yelp|tripadvisor|yellowpages|mapquest|bbb\.org|foursquare|nextdoor|reddit|facebook|instagram)/i;
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' };
const PHONE_RE = /(?:\(\d{3}\)\s?|\d{3}[.\-\s])\d{3}[.\-\s]\d{4}/g;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Strip tags to a fixpoint so broken/nested markup can't leave a tag behind.
const stripTags = (s) => {
  let prev;
  do { prev = s; s = s.replace(/<[^>]+>/g, ' '); } while (s !== prev);
  return s;
};

async function ddg(query, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch('https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(query), { headers: UA });
      const html = await r.text();
      const links = [...html.matchAll(/uddg=(https?%3A%2F%2F[^&"']+)/g)].map((m) => decodeURIComponent(m[1]));
      // Decode &amp; last so sequences like '&amp;quot;' only unescape once.
      const text = stripTags(html)
        .replace(/&#x27;|&quot;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ');
      if (links.length || /phone|tel/i.test(text)) return { links, text };
    } catch {}
    await sleep(2000);
  }
  return { links: [], text: '' };
}

function pickSite(urls, name) {
  const tokens = name.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter((t) => t.length > 3 && !/the|and|shop|store|hotel|bar|grill|cafe|restaurant/.test(t));
  for (const u of urls) {
    try {
      const host = new URL(u).hostname;
      if (!AGGREGATORS.test(host)) {
        const clean = u.split('?')[0].replace(/\/$/, '');
        return clean;
      }
    } catch {}
  }
  for (const u of urls) {
    try {
      const host = new URL(u).hostname;
      if (SOFT_AGG.test(host)) return u;
    } catch {}
  }
  for (const u of urls) {
    try {
      const host = new URL(u).hostname;
      if (!/google|bing|duckduckgo/.test(host)) return u;
    } catch {}
  }
  return null;
}

function pickPhone(text, name) {
  const counts = new Map();
  for (const m of text.matchAll(PHONE_RE)) {
    const raw = m[0].trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 10) continue;
    if (/^(800|888|877|866|855|844)/.test(digits)) continue; // skip toll-free when possible
    counts.set(raw, (counts.get(raw) || 0) + 1);
  }
  if (!counts.size) {
    // allow toll-free if that's all there is
    for (const m of text.matchAll(PHONE_RE)) {
      const raw = m[0].trim();
      const digits = raw.replace(/\D/g, '');
      if (digits.length === 10) counts.set(raw, (counts.get(raw) || 0) + 1);
    }
  }
  if (!counts.size) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].replace(/\s+/g, ' ');
}

(async () => {
  const out = [];
  let i = 0, gotPhone = 0, gotWeb = 0;
  for (const v of records) {
    i++;
    const city = v.city || 'Phoenix';
    const street = (v.address || '').split(',')[0];
    const needPhone = !v.phone, needWeb = !v.website;
    let phone = null, website = null;

    const q1 = `${v.name} ${street} ${city} AZ`.replace(/\s+/g, ' ');
    const r1 = await ddg(q1);
    if (needWeb) website = pickSite(r1.links, v.name);
    if (needPhone) phone = pickPhone(r1.text, v.name);
    await sleep(350);

    if (needPhone && !phone) {
      const r2 = await ddg(`${v.name} ${city} AZ phone number`);
      phone = pickPhone(r2.text, v.name);
      await sleep(350);
    }
    if (needWeb && !website) {
      const r3 = await ddg(`${v.name} ${city} AZ official site`);
      website = pickSite(r3.links, v.name);
      await sleep(350);
    }

    if (phone) gotPhone++;
    if (website) gotWeb++;
    out.push({ id: v.id, name: v.name, phone, website });
    if (i % 25 === 0) {
      fs.writeFileSync(__dirname + '/out/contact_found.json', JSON.stringify(out));
      console.log(`${i}/${records.length} phone:${gotPhone} web:${gotWeb}`);
    }
  }
  fs.writeFileSync(__dirname + '/out/contact_found.json', JSON.stringify(out));
  console.log(`DONE ${records.length} vendors — phone found:${gotPhone} web found:${gotWeb}`);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
