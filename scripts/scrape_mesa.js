// Scrape downtownmesa.com directory profiles (/go/{slug}) for phone + website.
const fs = require('fs');
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Strip tags to a fixpoint so broken/nested markup can't leave a tag behind.
const stripTags = (s) => {
  let prev;
  do { prev = s; s = s.replace(/<[^>]+>/g, ''); } while (s !== prev);
  return s;
};

(async () => {
  const slugs = new Set();
  for (const cat of ['dining', 'shopping', 'services']) {
    try {
      const t = await (await fetch(`https://www.downtownmesa.com/shop-and-dine/${cat}`, { headers: UA })).text();
      [...t.matchAll(/href="(\/go\/[^"]+)"/g)].forEach((m) => slugs.add(m[1]));
      console.log(cat, '->', slugs.size);
      await sleep(250);
    } catch (e) { console.log(cat, 'ERR', e.message); }
  }
  const out = [];
  let i = 0;
  for (const slug of slugs) {
    i++;
    try {
      const t = await (await fetch('https://www.downtownmesa.com' + slug, { headers: UA })).text();
      const name = (t.match(/<h1>([^<]+)<\/h1>/) || [])[1] || slug;
      const web = (t.match(/class="btn btn-brand-pill"[^>]*href="(https?:[^"]+)"/i) || t.match(/href="(https?:[^"]+)"[^>]*class="btn btn-brand-pill"/i) || [])[1] || null;
      const block = t.match(/<h2 class="on-detail">Address<\/h2>\s*<p>([\s\S]*?)<\/p>/);
      let phone = null, street = null;
      if (block) {
        const parts = block[1].split(/<br\s*\/?>/i).map((x) => stripTags(x).replace(/&amp;/g, '&').trim());
        street = parts[0] || null;
        const pm = block[1].match(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/);
        if (pm) phone = pm[0];
      }
      out.push({ slug, name: name.trim(), street, phone, website: web });
    } catch { out.push({ slug, name: slug, street: null, phone: null, website: null }); }
    if (i % 50 === 0) console.log(i + '/' + slugs.size);
    await sleep(120);
  }
  fs.writeFileSync(__dirname + '/out/mesa_profiles.json', JSON.stringify(out, null, 1));
  console.log('done:', out.length, 'with phone:', out.filter((r) => r.phone).length, 'with web:', out.filter((r) => r.website).length);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
