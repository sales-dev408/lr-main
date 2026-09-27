// Parse extracted docx text files into normalized records.
const fs = require('fs');

const STOP_MAP = {
  'downtown phoenix hub': 'Downtown Phx Hub / Washington St',
  'washington and central': 'Washington / Central Ave',
  'washington/central': 'Washington / Central Ave',
  'central/washington': 'Washington / Central Ave',
  '3rd street/jefferson': '3rd St / Jefferson',
  '3rd street / jefferson': '3rd St / Jefferson',
  '3rd st/jefferson': '3rd St / Jefferson',
  '3rd street/washington': '3rd St / Washington',
  '3rd street / washington': '3rd St / Washington',
  '3rd st/washington': '3rd St / Washington',
  '12th street/jefferson': '12th St / Jefferson',
  '12th street / jefferson & washington': '12th St / Jefferson',
  '12th street/jefferson & washington': '12th St / Jefferson',
  '12th st/washington-12th st/jefferson': '12th St / Washington',
  '12th st/washington': '12th St / Washington',
  '24th street/jefferson': '24th St / Jefferson',
  '24th street / jefferson & washington': '24th St / Jefferson',
  '24th street/washington': '24th St / Washington',
  '24th st/jefferson': '24th St / Jefferson',
  '38th street/washington': '38th St / Washington',
  '38th st/washington': '38th St / Washington',
  '44th street/washington': '44th St / Washington',
  '44th st/washington': '44th St / Washington',
  '50th street/washington': '50th St / Washington St',
  'priest and washington': 'Priest Dr / Washington St',
  'priest drive/washington': 'Priest Dr / Washington St',
  'priest/washington': 'Priest Dr / Washington St',
  'center parkway / washington': 'Center Pkwy / Washington',
  'center parkway/washington': 'Center Pkwy / Washington',
  'center pkwy/washington': 'Center Pkwy / Washington',
  'mill avenue/3rd street': 'Mill Ave / 3rd St',
  'mill avenue / 3rd street': 'Mill Ave / 3rd St',
  'mill ave/3rd st': 'Mill Ave / 3rd St',
  'veterans way/college avenue': 'Veterans Way / College Ave',
  'veterans way / college avenue': 'Veterans Way / College Ave',
  'veterans way/college ave': 'Veterans Way / College Ave',
  'veterans way/college': 'Veterans Way / College Ave',
  'university drive/rural': 'University Dr / Rural Rd',
  'university dr/rural rd': 'University Dr / Rural Rd',
  'dorsey/apache': 'Dorsey Ln / Apache Blvd',
  'dorsey/apache boulevard': 'Dorsey Ln / Apache Blvd',
  'dorsey/apache blvd': 'Dorsey Ln / Apache Blvd',
  'dorsey ln / apache blvd': 'Dorsey Ln / Apache Blvd',
  'dorsey / apache blvd': 'Dorsey Ln / Apache Blvd',
  'smith-martin/apache boulevard': 'Smith-Martin / Apache Blvd',
  'smith-martin / apache boulevard': 'Smith-Martin / Apache Blvd',
  'smith-martin/apache': 'Smith-Martin / Apache Blvd',
  'mcclintock/apache boulevard': 'McClintock Dr / Apache Blvd',
  'mcclintock / apache boulevard': 'McClintock Dr / Apache Blvd',
  'mcclintock/apache': 'McClintock Dr / Apache Blvd',
  'price-101 freeway/apache': 'Price-101 Fwy / Apache Blvd',
  'price-101 freeway / apache boulevard': 'Price-101 Fwy / Apache Blvd',
  'price-101/apache': 'Price-101 Fwy / Apache Blvd',
  'rural/apache': 'Dorsey Ln / Apache Blvd',
  'rural rd/apache blvd': 'Dorsey Ln / Apache Blvd',
  'sycamore/main': 'Sycamore / Main St',
  'sycamore/main street': 'Sycamore / Main St',
  'sycamore / main': 'Sycamore / Main St',
  'sycamore / main street': 'Sycamore / Main St',
  'alma school/main street': 'Alma School / Main St',
  'alma school / main street': 'Alma School / Main St',
  'alma school / main': 'Alma School / Main St',
  'alma school/main': 'Alma School / Main St',
  'country club/main street': 'Country Club / Main St',
  'country club / main street': 'Country Club / Main St',
  'country club/main': 'Country Club / Main St',
  'country club / main': 'Country Club / Main St',
  'center/main street': 'Center / Main St',
  'center / main street': 'Center / Main St',
  'center/main': 'Center / Main St',
  'center / main': 'Center / Main St',
  'mesa drive/main street': 'Mesa Dr / Main St',
  'mesa dr/main': 'Mesa Dr / Main St',
  'mesa dr/main st': 'Mesa Dr / Main St',
  'mesa dr / main': 'Mesa Dr / Main St',
  'stapley/main street': 'Stapley Dr / Main St',
  'stapley dr / main': 'Stapley Dr / Main St',
  'gilbert road/main street': 'Gilbert Rd / Main St',
  'gilbert road / main': 'Gilbert Rd / Main St',
  'gilbert rd/main': 'Gilbert Rd / Main St',
  'gilbert rd/main st': 'Gilbert Rd / Main St',
  // B line
  'metro parkway': 'Metro Parkway',
  'mountain view/25th avenue': 'Mountain View / 25th Ave',
  'mountain view/25th ave': 'Mountain View / 25th Ave',
  '25th avenue/dunlap': 'Dunlap / 25th Ave',
  '25th ave/dunlap': 'Dunlap / 25th Ave',
  '25th ave / dunlap': 'Dunlap / 25th Ave',
  '19th avenue/dunlap': '19th Ave / Dunlap',
  '19th ave/dunlap': '19th Ave / Dunlap',
  '19th ave / dunlap': '19th Ave / Dunlap',
  'northern/19th avenue': 'Northern / 19th Ave',
  'northern / 19th ave': 'Northern / 19th Ave',
  '19th ave & northern': 'Northern / 19th Ave',
  '19th ave and northern': 'Northern / 19th Ave',
  'glendale/19th avenue': 'Glendale / 19th Ave',
  'glendale / 19th ave': 'Glendale / 19th Ave',
  '19th ave and glendale': 'Glendale / 19th Ave',
  '19th ave. and glendale': 'Glendale / 19th Ave',
  'montebello/19th avenue': 'Montebello / 19th Ave',
  'montebello / 19th ave': 'Montebello / 19th Ave',
  '19th ave and montebello': 'Montebello / 19th Ave',
  '19th avenue/camelback': '19th Ave / Camelback',
  '19th ave and camelback': '19th Ave / Camelback',
  '19th ave/camelback': '19th Ave / Camelback',
  '7th avenue/camelback': '7th Ave / Camelback',
  '7th ave and camelback': '7th Ave / Camelback',
  '7th ave/camelback': '7th Ave / Camelback',
  'central avenue/camelback': 'Central Ave / Camelback',
  'central & camelback': 'Central Ave / Camelback',
  'central/camelback': 'Central Ave / Camelback',
  'camelback / central': 'Central Ave / Camelback',
  'campbell/central': 'Campbell / Central Ave',
  'campbell/central avenue': 'Campbell / Central Ave',
  'campbell / central': 'Campbell / Central Ave',
  'indian school/central': 'Indian School / Central Ave',
  'indian school/central avenue': 'Indian School / Central Ave',
  'indian school / central': 'Indian School / Central Ave',
  'central and indian school': 'Indian School / Central Ave',
  'osborn/central': 'Osborn / Central Ave',
  'osborn / central': 'Osborn / Central Ave',
  'central and osborn': 'Osborn / Central Ave',
  'central/osborn': 'Osborn / Central Ave',
  'thomas/central': 'Thomas / Central Ave',
  'thomas / central': 'Thomas / Central Ave',
  'central and thomas': 'Thomas / Central Ave',
  'central & thomas': 'Thomas / Central Ave',
  'encanto/central': 'Encanto / Central Ave',
  'encanto / central': 'Encanto / Central Ave',
  'central and encanto': 'Encanto / Central Ave',
  'central/encanto': 'Encanto / Central Ave',
  'mcdowell/central': 'McDowell / Central Ave',
  'mcdowell / central': 'McDowell / Central Ave',
  'central and mcdowell': 'McDowell / Central Ave',
  'central & mcdowell': 'McDowell / Central Ave',
  'roosevelt/central': 'Roosevelt / Central Ave',
  'roosevelt / central': 'Roosevelt / Central Ave',
  'central and roosevelt': 'Roosevelt / Central Ave',
  'central & roosevelt': 'Roosevelt / Central Ave',
  'van buren/central': 'Van Buren / Central Ave',
  'central and van buren': 'Van Buren / Central Ave',
  'central/van buren': 'Van Buren / Central Ave',
  'jefferson/1st ave': 'Jefferson / 1st Ave',
  'jefferson / 1st ave': 'Jefferson / 1st Ave',
  '3rd st/jefferson or 1st ave/jefferson': 'Jefferson / 1st Ave',
  'lincoln/central': 'Lincoln / Central Ave',
  'lincoln/1st avenue': 'Lincoln / 1st Ave',
  'lincoln / 1st ave': 'Lincoln / 1st Ave',
  'central and lincoln': 'Lincoln / Central Ave',
  'buckeye/central': 'Buckeye / Central Ave',
  'central and buckeye': 'Buckeye / Central Ave',
  'pioneer/central': 'Pioneer / Central Ave',
  'central and pioneer': 'Pioneer / Central Ave',
  'broadway/central': 'Broadway / Central Ave',
  'broadway and central': 'Broadway / Central Ave',
  'roeser/central': 'Roeser / Central Ave',
  'central and roeser': 'Roeser / Central Ave',
  'southern/central': 'Southern / Central Ave',
  'central and southern': 'Southern / Central Ave',
  'baseline/central': 'Baseline / Central Ave',
  'central and baseline': 'Baseline / Central Ave',
  'thelda williams transit center': 'Thelda Williams Transit Center',
  '19th avenue/montebello': 'Montebello / 19th Ave',
  '19th ave/montebello': 'Montebello / 19th Ave',
  'montebello (bethany home road)': 'Montebello / 19th Ave',
};

// Normalized (spaceless, lowercase, punctuation-stripped) keys sorted longest-first
// so prose headers like "Restaurants near Mountain View/25th Ave Station #26" match.
const NORM_KEYS = Object.keys(STOP_MAP)
  .map(k => [k.replace(/&/g, 'and').replace(/[^a-z0-9/]/g, ''), STOP_MAP[k]])
  .sort((a, b) => b[0].length - a[0].length);

function canonStop(raw, lineHint) {
  if (!raw) return null;
  let s = raw.toLowerCase().replace(/–/g, '-').replace(/&/g, 'and').replace(/[^a-z0-9/]/g, '');
  for (const [k, v] of NORM_KEYS) {
    if (s.includes(k)) {
      if (v === 'Downtown Phx Hub / Washington St' && lineHint === 'B') return 'Downtown Phx Hub / Central Ave';
      return v;
    }
  }
  return null;
}

const SKIP_NAME = /individual|to be verified|businesses\b|corridor|vicinity|park-and-ride|transit facility|no current|offices\b|government|rental-car|rental |automotive|district\b|neighborhood|various|salon-suite|^nearby|restaurants$|stores$|tenants|facilities|office buildings|flea|swap meet area/i;

function clean(v) { return (v || '').replace(/\[\[.*?\]\]/g, '').replace(/\s+/g, ' ').trim(); }
function cleanPhone(v) {
  v = clean(v);
  if (!v || /^[—\-?]$/.test(v) || /not verified|various|contact/i.test(v)) return null;
  if (v === '602-?') return null;
  return v;
}
function cleanWeb(v) {
  v = clean(v);
  if (!v || /^[—\-?]$/.test(v)) return null;
  return v;
}

const records = [];

// ---------- hair_beauty.txt ----------
{
  const lines = fs.readFileSync('out/hair_beauty.txt', 'utf8').split('\n');
  let stop = null;
  for (const line of lines) {
    if (line.startsWith('P: ')) {
      const t = line.slice(3).trim();
      const c = canonStop(t);
      if (c) stop = c;
      continue;
    }
    if (line.startsWith('  ROW: ')) {
      const cells = line.slice(7).split('||').map(clean);
      if (/^business$/i.test(cells[0]) || cells.length < 3) continue;
      const [name, type, addr, phone, , web] = cells;
      if (!name || SKIP_NAME.test(name)) continue;
      records.push({ source: 'beauty', name, type, address: addr, phone: cleanPhone(phone), station: stop, websiteHint: cleanWeb(web), kind: 'vendor' });
    }
  }
}

// ---------- a_line.txt ----------
{
  const lines = fs.readFileSync('out/a_line.txt', 'utf8').split('\n');
  let stop = null;
  for (const line of lines) {
    if (line.startsWith('P: ')) {
      const t = line.slice(3).trim();
      const c = canonStop(t);
      if (c) stop = c;
      continue;
    }
    if (line.startsWith('  ROW: ')) {
      const cells = line.slice(7).split('||').map(clean);
      if (cells.length < 3 || /^(restaurant|place|type)/i.test(cells[0]) || !cells[0]) continue;
      let name, type, addr, phone, web;
      if (cells.length >= 6) {
        [name, , addr, phone, type, , web] = cells;
      } else {
        [name, addr, phone, web] = cells;
        type = 'Restaurant / Bar';
      }
      if (!name || SKIP_NAME.test(name)) continue;
      records.push({ source: 'a_line', name, type: type || 'Restaurant / Bar', address: addr, phone: cleanPhone(phone), station: stop, websiteHint: cleanWeb(web), kind: 'vendor' });
    }
  }
}

// ---------- b_line.txt ----------
{
  const lines = fs.readFileSync('out/b_line.txt', 'utf8').split('\n');
  let stop = null;
  const isWalk = s => /min|mi\b|at station|steps|adjacent/i.test(s || '');
  const isAddr = s => /\d+\s+[NSEW]?\s*\w+.*(ave|st|rd|blvd|dr|hwy|ln)/i.test(s || '') || /^\d+\s+[NSEW]\s/i.test(s || '');
  const isPhone = s => /^\(?\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}/.test((s || '').trim());

  for (const line of lines) {
    if (line.startsWith('P: ')) {
      const t = line.slice(3).trim();
      // paragraph-format entries: "NameAddress: ...Phone: ...Website: ..." (Thomas section)
      if (/Address:/i.test(t) && !canonStop(t)) {
        const m = t.match(/^(.*?)\s*Address:\s*(.*?)\s*Phone:\s*(.*?)\s*Website:\s*(.*)$/i);
        if (m && m[1].length < 60 && stop) {
          records.push({ source: 'b_line', name: clean(m[1]), type: 'Restaurant / Bar', address: clean(m[2]), phone: cleanPhone(m[3]), station: stop, websiteHint: cleanWeb(m[4]), kind: 'vendor' });
          continue;
        }
      }
      // paragraph entries "Name — address — walk/desc" (Encanto block)
      if (stop === 'Encanto / Central Ave' && /—/.test(t)) {
        const m = t.match(/^(.*?)\s*—\s*(\d+\s+.*?)\s*—\s*(.*)$/);
        if (m) {
          let nm = clean(m[1]).replace(/^.*line\s*b[:\s]*/i, '').trim();
          const pm = (t).match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}/);
          if (nm) records.push({ source: 'b_line', name: nm, type: 'Restaurant / Bar', address: clean(m[2]), phone: pm ? pm[0] : null, station: stop, websiteHint: null, kind: 'vendor' });
          continue;
        }
      }
      const c = canonStop(t, 'B');
      if (c) stop = c;
      continue;
    }
    if (line.startsWith('  ROW: ')) {
      const cells = line.slice(7).split('||').map(clean);
      if (cells.every(x => !x)) continue;
      const first = cells[0];
      if (!first) continue;
      if (/^(restaurant|place|business|type|hotel)/i.test(first)) continue;
      if (SKIP_NAME.test(first)) continue;
      let name = first, type = '', addr = '', phone = '', web = '';
      if (cells.length === 6) {
        if (isWalk(cells[1]) && isAddr(cells[2])) { addr = cells[2]; phone = cells[3]; web = cells[5]; }
        else if (isWalk(cells[2]) && isAddr(cells[3])) { type = cells[1]; addr = cells[3]; phone = cells[4]; web = cells[5]; }
        else if (isAddr(cells[1])) { addr = cells[1]; if (isWalk(cells[2])) { phone = cells[3]; web = cells[5]; } else { phone = cells[2]; web = cells[3]; } }
        else { addr = cells[2]; phone = cells[3]; web = cells[5]; }
      } else if (cells.length === 5) {
        if (isWalk(cells[1])) { addr = cells[2]; phone = cells[3]; web = cells[4]; }
        else if (isAddr(cells[1])) { addr = cells[1]; if (isWalk(cells[2])) { phone = cells[3]; web = cells[4]; } else { phone = cells[2]; web = cells[3]; if (cells[4]) type = cells[4]; } }
        else if (isWalk(cells[2])) { type = cells[1]; addr = cells[3]; phone = cells[4]; }
        else { addr = cells[1]; phone = cells[2]; web = cells[3]; }
      } else if (cells.length === 4) {
        if (isAddr(cells[1])) { addr = cells[1]; phone = isPhone(cells[2]) ? cells[2] : ''; web = cells[3] || ''; }
        else { addr = cells[2]; phone = cells[3]; }
      } else {
        addr = cells[1] || ''; phone = cells[2] || '';
      }
      records.push({ source: 'b_line', name, type: type || 'Restaurant / Bar', address: addr, phone: cleanPhone(phone), station: stop, websiteHint: cleanWeb(web), kind: 'vendor' });
    }
  }

  // Indian School run-in paragraph lines (doc has them flattened, no table)
  let inIS = false;
  for (const line of lines) {
    if (!line.startsWith('P: ')) continue;
    const t = line.slice(3).trim();
    if (/central and indian school/i.test(t)) { inIS = true; continue; }
    if (inIS) {
      if (/central and osborn/i.test(t)) break;
      const m = t.match(/^(.*?)(\d+–\d+ min|\d+ min)/);
      if (!m) continue;
      let pre = m[1];
      const rest = t.slice(m[0].length);
      const pm = rest.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}/);
      const am = rest.match(/\d+\s+[NSEW]\s*[\w.]+[^0-9]*?(?=\(?\d{3}|$)/);
      // split name vs type: type words start where a known keyword appears
      const tm = pre.match(/^(.*?)(Asian|Japanese|Thai|British|Bar|Sushi|Fast food|restaurant|pub|ramen|cocktail|teriyaki).*$/i);
      const name = clean(tm ? tm[1] : pre);
      const type = clean(tm ? tm[2] : 'Restaurant / Bar');
      if (name && !SKIP_NAME.test(name)) {
        records.push({ source: 'b_line', name, type, address: am ? clean(am[0]) : null, phone: pm ? pm[0] : null, station: 'Indian School / Central Ave', websiteHint: null, kind: 'vendor' });
      }
    }
  }
}

// ---------- biz_list.txt ----------
{
  const lines = fs.readFileSync('out/biz_list.txt', 'utf8').split('\n');
  let stop = null;
  for (const line of lines) {
    if (!line.startsWith('P: ')) continue;
    const t = line.slice(3).trim();
    const m = t.match(/^([AB])\s*[—–-]\s*(.+)$/);
    if (m) {
      let c = canonStop(m[2], m[1]);
      if (!c) c = canonStop(m[2].split(/[—–]/)[0], m[1]);
      if (c) { stop = c; continue; }
    }
    if (!t.includes('|') || !stop) continue;
    const em = t.indexOf(' — ');
    if (em < 0) continue;
    const name = t.slice(0, em).trim();
    const parts = t.slice(em + 3).split('|').map(clean);
    const [type, phone, addr, , web] = parts;
    if (!name || SKIP_NAME.test(name)) continue;
    if (/(park-and-ride|transit facility)/i.test(type || '')) continue;
    records.push({ source: 'biz', name, type, address: addr, phone: cleanPhone(phone), station: stop, websiteHint: cleanWeb(web), kind: 'vendor' });
  }
}

// ---------- hotels.txt ----------
{
  const lines = fs.readFileSync('out/hotels.txt', 'utf8').split('\n');
  let stop = null;
  for (const line of lines) {
    if (line.startsWith('P: ')) {
      const t = line.slice(3).trim();
      const m = t.match(/^(A\/B|A|B)\s*[—–-]\s*(.+)$/);
      if (m) { const c = canonStop(m[2], m[1] === 'B' ? 'B' : 'A'); if (c) { stop = c; continue; } }
      const c = canonStop(t);
      if (c) stop = c;
      continue;
    }
    if (line.startsWith('  ROW: ')) {
      const cells = line.slice(7).split('||').map(clean);
      if (cells.length < 3 || /^hotel/i.test(cells[0]) || !cells[0]) continue;
      const [name, addr, phone, , web] = cells;
      if (!name || /no current qualifying/i.test(name)) continue;
      records.push({ source: 'hotels', name, type: 'Hotel', address: addr, phone: cleanPhone(phone), station: stop, websiteHint: cleanWeb(web), kind: 'apt_hotel' });
    }
  }
}

// ---------- apts.txt ----------
{
  const lines = fs.readFileSync('out/apts.txt', 'utf8').split('\n');
  let stop = null, curLine = 'A';
  for (const line of lines) {
    if (!line.startsWith('P: ')) continue;
    const t = line.slice(3).trim();
    const lineHdr = t.match(/^(A|B)\s+LINE\s*[—–-]\s*(.*)$/i);
    if (lineHdr) {
      curLine = lineHdr[1].toUpperCase();
      const c2 = canonStop(lineHdr[2], curLine);
      if (c2) { stop = c2; }
      continue;
    }
    if (/^(A|B)\s+(LINE|Line)\b/i.test(t)) continue;
    if (/^PHOENIX|^TEMPE|^MESA|^ADDITIONAL/i.test(t)) continue;
    const c = canonStop(t, curLine);
    if (c) { stop = c; continue; }
    const m = t.match(/^(.*?)\s*[—–-]\s*[^📍]*📍\s*(.*)$/);
    if (m && stop) {
      const name = clean(m[1]);
      const rest = m[2];
      const addrM = rest.match(/^(.*?)(?:☎️|🌐|$)/);
      const addr = clean(addrM ? addrM[1] : rest);
      const phoneM = rest.match(/☎️\s*(.*?)(?:🌐|$)/);
      const webM = rest.match(/🌐\s*(.*)$/);
      const phone = cleanPhone(phoneM ? phoneM[1] : null);
      let web = clean(webM ? webM[1] : '');
      const dm = web.match(/([\w-]+(?:\.[\w-]+)+(?:\/[\w\/-]*)?)/);
      const webUrl = dm ? 'https://' + dm[1] : null;
      if (!name || SKIP_NAME.test(name) || name.length < 3) continue;
      records.push({ source: 'apts', name, type: 'Apartment', address: addr, phone, station: stop, websiteHint: webUrl || cleanWeb(web), kind: 'apt_hotel' });
    }
  }
}

// Dedupe: same normalized name + same canonical station collapses; merge fields.
function normName(n) {
  return n.toLowerCase().replace(/[''’`]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
}
const byKey = new Map();
for (const r of records) {
  const key = normName(r.name) + '|' + (r.station || '');
  const prev = byKey.get(key);
  if (!prev) { byKey.set(key, r); continue; }
  for (const f of ['type', 'address', 'phone', 'websiteHint']) {
    if (!prev[f] && r[f]) prev[f] = r[f];
    else if (f === 'address' && r[f] && prev[f] && r[f].length > prev[f].length) prev[f] = r[f];
  }
}
const out = [...byKey.values()];
fs.writeFileSync('out/parsed.json', JSON.stringify(out, null, 1));
const bySrc = {};
out.forEach(r => bySrc[r.source] = (bySrc[r.source] || 0) + 1);
console.log(bySrc, 'total', out.length);
const noStop = out.filter(r => !r.station);
console.log('no station:', noStop.length);
noStop.slice(0, 40).forEach(r => console.log(' ', r.source, '|', r.name));
