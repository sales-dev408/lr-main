// Scrape dtphx.org directory: landing pages -> /go/{slug} profiles -> phone/website.
const fs = require('fs');
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Strip tags to a fixpoint so broken/nested markup can't leave a tag behind.
const stripTags = (s) => {
  let prev;
  do { prev = s; s = s.replace(/<[^>]+>/g, ''); } while (s !== prev);
  return s;
};

const CATEGORIES = [
  'eat-drink', 'shopping', 'hotels', 'entertainment', 'public-art',
  'parks', 'education', 'tours', 'nightlife', 'attractions', 'services',
];

(async () => {
  // 1) collect /go/ profile URLs + card info from landing pages
  const profiles = new Map(); // slug -> {name, addr}
  for (const cat of CATEGORIES) {
    try {
      const t = await (await fetch(`https://dtphx.org/things-to-do/${cat}`, { headers: UA })).text();
      const cards = [...t.matchAll(/<a href="(\/go\/[^"]+)"[\s\S]*?place-card-content-headline">([^<]+)<[\s\S]*?place-card-content-address">([^<]+)</g)];
      for (const m of cards) {
        const slug = m[1];
        if (!profiles.has(slug)) profiles.set(slug, { name: m[2].trim(), addr: m[3].trim(), cat });
      }
      console.log(cat, '->', cards.length, 'cards');
      await sleep(250);
    } catch (e) { console.log(cat, 'ERR', e.message); }
  }
  console.log('total profiles:', profiles.size);

  // 2) fetch each profile for phone + website
  const out = [];
  let i = 0;
  for (const [slug, info] of profiles) {
    i++;
    try {
      const t = await (await fetch('https://dtphx.org' + slug, { headers: UA })).text();
      const web = (t.match(/class="btn btn-brand-pill"[^>]*href="(https?:[^"]+)"/i) || t.match(/href="(https?:[^"]+)"[^>]*class="btn btn-brand-pill"/i) || [])[1] || null;
      // address+phone block: <p>street<br />city<br />(phone)</p>
      const block = t.match(/<h2 class="on-detail">Address<\/h2>\s*<p>([\s\S]*?)<\/p>/);
      let phone = null, street = null;
      if (block) {
        const parts = block[1].split(/<br\s*\/?>/i).map((x) => stripTags(x).replace(/&amp;/g, '&').trim());
        street = parts[0] || null;
        const pm = block[1].match(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/);
        if (pm) phone = pm[0];
      }
      out.push({ slug, name: info.name, cat: info.cat, street: street || info.addr, phone, website: web });
    } catch (e) { out.push({ slug, name: info.name, cat: info.cat, street: info.addr, phone: null, website: null }); }
    if (i % 50 === 0) console.log(i + '/' + profiles.size);
    await sleep(120);
  }
  fs.writeFileSync(__dirname + '/out/dtphx_profiles.json', JSON.stringify(out, null, 1));
  console.log('done:', out.length, 'with phone:', out.filter((r) => r.phone).length, 'with web:', out.filter((r) => r.website).length);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
