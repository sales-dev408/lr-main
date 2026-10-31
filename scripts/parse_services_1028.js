// Parse out/services_102826.txt (extract_docx.py output) into staged vendor
// records at out/services_1028_parsed.json. Handles every table shape in the
// doc, dedupes the repeated drafts, and classifies each business into the
// app's vendor_type/category taxonomy.
const fs = require('fs');

const src = fs.readFileSync('out/services_102826.txt', 'utf8').split(/\r?\n/);

const norm = (s) => (s || '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[''’]/g, '')
  .replace(/[^a-z0-9]/g, '');

const cleanUrl = (u) => (u || '')
  .replace(/[?&]utm_[^&\]]*.*$/i, '')
  .replace(/[?&]$/, '')
  .trim();

const isPhone = (s) => /\(?\d{3}\)?[-.)\s]\s?\d{3}[-.\s]\d{4}/.test(s || '');
const looksAddress = (s) =>
  /\d+\s+([NSEW]\.?\s+)?[A-Z0-9][A-Za-z0-9.'-]*\s+(St|Ave|Av|Rd|Dr|Blvd|Way|Ln|Lane|Place|Pl|Ct|Cir|Pkwy|Terrace|Ter|Drive|Street|Avenue|Road|Boulevard)\b/i.test(s || '') ||
  /,\s*Phoenix/i.test(s || '');
const badPhone = (s) => !s || /verify|not (listed|confirmed|published)|needs|unverif|confirm|department|none/i.test(s);
const extractUrl = (s) => {
  const m = /\[\[([^\]]+)\]\]/.exec(s || '');
  if (m) return cleanUrl(m[1]);
  return null;
};

const HEADER_RE = /^(business|hotel|motel|property|vendor|name|store|bar|restaurant|salon|bank|office|category|business \/ attraction|merchant|field|requirement)$/i;
const SKIP_TABLE_RE = /correction|google-listed|google address|google listing|examples and leads|businesses\/services to inventory|official directory|directory source|current source|audit|requirement/i;
const SKIP_SECTION_RE = /completion status|recommended|final directory format|how i('| wi)ll|what remains|source coverage|source of record|three main directories|genuinely comprehensive|corrections|verification notes|audit findings/i;
const NAME_BLACKLIST = /^(address|boundary|google|phone|status|website|field|requirement|business|category|type|downtown phoenix inc\.?|dtphx|source|notes?)$/i;

const rows = [];
let lastHeading = '';
let lastMajor = '';
let inTable = false;
let headerCells = null;
let skipTable = false;

for (const raw of src) {
  if (raw.startsWith('P:')) {
    const text = raw.slice(3).trim();
    const major = /^(\d+)\.\s+(.+)/.exec(text);
    if (major) {
      lastMajor = major[2].replace(/[[\]()]/g, '').trim();
      lastHeading = lastMajor;
    } else if (text && text.length < 80 && !/[.!?:]$/.test(text) && !/^\+?\d+$/.test(text) && !/^(ad|you said|chatgpt said)/i.test(text)) {
      lastHeading = text.replace(/[[\]()]/g, '').trim();
    }
    continue;
  }
  if (raw.startsWith('TABLE:')) { inTable = true; headerCells = null; skipTable = false; continue; }
  if (raw.startsWith('END TABLE')) { inTable = false; headerCells = null; continue; }
  if (!inTable || !raw.startsWith('  ROW:')) continue;
  if (SKIP_SECTION_RE.test(lastHeading)) { continue; }

  const cells = raw.slice(6).split('||').map((c) => c.trim());
  if (!headerCells) {
    headerCells = cells.map((c) => c.toLowerCase().replace(/\[\[[^\]]*\]\]/g, '').trim());
    skipTable = SKIP_TABLE_RE.test(headerCells.join(' '));
    continue;
  }
  if (skipTable) continue;

  const name = cells[0].replace(/\[\[[^\]]*\]\]/g, '').trim();
  if (!name || HEADER_RE.test(name) || NAME_BLACKLIST.test(name)) continue;
  if ((name.match(/,/g) || []).length >= 2) continue;

  const rec = { name, address: null, phone: null, website: null, categoryCol: null, section: lastHeading, major: lastMajor };
  const catIdx = headerCells.findIndex((h) => h === 'category');
  const addrIdx = headerCells.findIndex((h) => /address/.test(h));
  const phoneIdx = headerCells.findIndex((h) => /phone|telephone/.test(h));
  for (let i = 1; i < cells.length; i++) {
    const cell = cells[i];
    const url = extractUrl(cell);
    if (url && !rec.website) rec.website = url;
    const bare = cell.replace(/\[\[[^\]]*\]\]/g, '').trim();
    if (i === catIdx) { rec.categoryCol = bare || null; continue; }
    if (i === addrIdx && looksAddress(bare)) { rec.address = bare; continue; }
    if (i === phoneIdx && isPhone(bare)) { rec.phone = bare; continue; }
    if (!rec.address && looksAddress(bare)) { rec.address = bare; continue; }
    if (!rec.phone && isPhone(bare)) { rec.phone = bare; continue; }
    if (!rec.website && /\.(com|org|net|io|co|us|az)\b/i.test(bare) && !/\s/.test(bare) && !/maps|listing|directory|website|details|information|official/i.test(bare)) {
      rec.website = /^https?:\/\//i.test(bare) ? bare : `https://${bare.replace(/^www\.?/i, 'www.')}`;
    }
  }
  if (rec.phone && badPhone(rec.phone)) rec.phone = null;
  rows.push(rec);
}

// Pass 1: dedupe by normalized name, keeping the richest row and merging.
const byName = new Map();
const richness = (r) => (r.phone ? 2 : 0) + (r.website ? 2 : 0) + (r.address ? 1 : 0) + (r.address || '').length / 100;
const merge = (keep, drop) => {
  keep.address = keep.address || drop.address;
  keep.phone = keep.phone || drop.phone;
  keep.website = keep.website || drop.website;
  keep.categoryCol = keep.categoryCol || drop.categoryCol;
  if (drop.section && !(keep.section || '').includes(drop.section)) keep.section = `${keep.section} ${drop.section}`.trim();
  if (drop.major && !(keep.major || '').includes(drop.major)) keep.major = `${keep.major} ${drop.major}`.trim();
  return keep;
};
for (const r of rows) {
  const key = norm(r.name);
  if (!key) continue;
  const prev = byName.get(key);
  byName.set(key, prev ? merge(richness(r) >= richness(prev) ? r : prev, richness(r) >= richness(prev) ? prev : r) : r);
}

// Pass 2: dedupe "Name — Location" style variants that share the same address
// (or same base name with no address distinguishing them).
const baseName = (n) => n.replace(/\s*[—–-]\s*(cityscape|asu|central|roosevelt|downtown|midtown|phoenix convention center.*)$/i, '').trim();
const byKey = new Map();
for (const r of byName.values()) {
  const key = norm(baseName(r.name)) + '|' + norm(r.address);
  const prev = byKey.get(key);
  byKey.set(key, prev ? merge(richness(r) >= richness(prev) ? r : prev, richness(r) >= richness(prev) ? prev : r) : r);
}

// --- Classification -------------------------------------------------------
// Phase 1 matches on the business name + free-text category column; phase 2
// falls back to the doc section the row was listed under.
const NAME_RULES = [
  [/\bhotel\b|\bmotel\b|\binn\b|suites|resort|hostel|lodge|lodging/, () => ({ vendorType: 'other', category: 'Hotel' })],
  [/\bbarber|\bsalon|hair\b|nail|lash|brow|wax|groom|beauty|esthetic|thread|manicur|style suite|\bspa\b|medspa|med spa|massage/, () => ({ vendorType: 'services', category: 'Beauty/Barber/Tattoo' })],
  [/dry clean|laundr|alteration|tailor|shoe (shine|repair|cobbl)|cobbler|fedex|ups store|mailbox|\bprint|shipping|notary|courier|packing|\brepair\b/, () => ({ vendorType: 'services', category: 'Contracted Services' })],
  [/dental|dentist|urgent care|medical|clinic|eyecare|optical|chiroprac|physical therap|pharmacy|iv bar|cancer|hospital|orthodont|dermatolog|hearing|vision|spinal|hormone/, () => ({ vendorType: 'services', category: 'Health & Wellness' })],
  [/fitness|\bgym\b|yoga|pilates|training|jiu-jitsu|f45|cycle|athletic|crossfit|orangetheory|mountainside|weight room|ymca|wellness|health|quickness/, () => ({ vendorType: 'services', category: 'Health & Wellness' })],
  [/\bbank\b|credit union/, () => ({ vendorType: 'services', category: 'Banks' })],
  [/insurance/, () => ({ vendorType: 'services', category: 'Insurance' })],
  [/legal|\blaw\b|attorney|account|tax\b|\bcpa\b|financ(?!ial theatre)/, () => ({ vendorType: 'services', category: 'Finance & Legal' })],
  [/photo/, () => ({ vendorType: 'services', category: 'Photography' })],
  [/\bchurch\b|\bchapel\b|cathedral|synagog|mosque|temple\b|parish|ministr/, () => ({ vendorType: 'services', category: 'Religious Centers' })],
  [/non-?profit|foundation|charity|community (care|center|organization|service)/, () => ({ vendorType: 'services', category: 'Non-Profit' })],
  [/ballroom|studios?\b|event space|\bvenue\b/, () => ({ vendorType: 'services', category: 'Venue' })],
  [/arcade|escape|\bvr\b|cinema|bowling|entertainment/, () => ({ vendorType: 'services', category: 'Entertainment' })],
  [/grocery|market|convenience|liquor|food & drug|farmers|supermarket/, () => ({ vendorType: 'other', category: 'grocery/convenience' })],
  [/pharmacy|\bdrug\b/, () => ({ vendorType: 'other', category: 'pharmacy' })],
  [/coffee|café|cafe\b|espresso|boba|\btea\b|juice/, () => ({ vendorType: 'cafe', category: 'Cafe, Coffee, & Tea' })],
  [/book|jewel|boutique|gift|cloth|apparel|florist|flower|pet\b|records|comic|vintage|collect|toy|mercant|antique|sport|fashion|marketplace|letterpress|glass|thrift|\bshop\b|\bstore\b|suits\b|retail/, () => ({ vendorType: 'boutique', category: 'specialty retail' })],
  [/museum|gallery|opera|ballet|symphony|theatr|library|\barts?\b|cultural|capitol|science center|zoo|garden|historic|artlink|artspace/, () => ({ vendorType: 'other', category: 'museum' })],
  [/deli|sandwich/, () => ({ vendorType: 'restaurant', category: 'Deli', cuisine: 'deli' })],
  [/sushi|japanese|ramen|hibachi/, () => ({ vendorType: 'restaurant', category: 'Japanese', cuisine: 'japanese' })],
  [/thai/, () => ({ vendorType: 'restaurant', category: 'Thai', cuisine: 'thai' })],
  [/mexic|taco|agavers|burrito|latin|mariscos/, () => ({ vendorType: 'restaurant', category: 'Mexican', cuisine: 'mexican' })],
  [/pizza|pizzeria/, () => ({ vendorType: 'restaurant', category: 'Pizza', cuisine: 'pizza' })],
  [/burger/, () => ({ vendorType: 'restaurant', category: 'American', cuisine: 'burgers' })],
  [/bakery|pastry|donut|bagel/, () => ({ vendorType: 'cafe', category: 'Bakery / Café' })],
  [/candy|dessert|sweet|ice cream|milkshake|shave ice/, () => ({ vendorType: 'restaurant', category: 'Ice cream / dessert', cuisine: 'dessert' })],
  [/\bbar\b|\bpub\b|tavern|cocktail|brewery|brewing|\bwine\b|whiskey|speakeasy|lounge|spirits|meadery|cidery|\bbeer\b|agavers/, () => ({ vendorType: 'bar', category: 'Bar' })],
  [/restaurant|eatery|diner|grill|kitchen|dining|\bfood|breakfast|brunch|soul|vegan|steak|seafood|bbq|wings|noodle|curry|sammich|hoagie|pita|poke|bowl|bistro|buffet|catering|chophouse/, () => ({ vendorType: 'restaurant', category: 'Dining' })],
  [/school|university|college|\basu\b|academy|prep\b/, () => ({ vendorType: 'other', category: 'university' })],
];

const SECTION_RULES = [
  [/barber|salon|shoe care|grooming|personal (care|grooming)|beauty/, () => ({ vendorType: 'services', category: 'Beauty/Barber/Tattoo' })],
  [/dry clean|laundry|tailor|shoe repair/, () => ({ vendorType: 'services', category: 'Contracted Services' })],
  [/dentist|medical|urgent care|health|wellness|emergency care/, () => ({ vendorType: 'services', category: 'Health & Wellness' })],
  [/bank|money|shipping|practical services/, () => ({ vendorType: 'services', category: 'Contracted Services' })],
  [/hotel|accommodation/, () => ({ vendorType: 'other', category: 'Hotel' })],
  [/arts|culture|museum|attraction|entertainment|activities/, () => ({ vendorType: 'other', category: 'Entertainment' })],
  [/dining|eat & drink|restaurant|food|cafes|casual dining/, () => ({ vendorType: 'restaurant', category: 'Dining' })],
  [/shopping|retail|stores/, () => ({ vendorType: 'boutique', category: 'specialty retail' })],
  [/grocery|pharmacy|market|essentials|visitor services/, () => ({ vendorType: 'other', category: 'Specialty' })],
  [/services/, () => ({ vendorType: 'services', category: 'Contracted Services' })],
];

function classify(r) {
  const nameHay = `${r.categoryCol || ''} ${r.name}`.toLowerCase();
  for (const [re, fn] of NAME_RULES) if (re.test(nameHay)) return fn();
  const secHay = `${r.section} ${r.major}`.toLowerCase();
  for (const [re, fn] of SECTION_RULES) if (re.test(secHay)) return fn();
  return { vendorType: 'other', category: r.categoryCol || 'Specialty' };
}

const out = [];
for (const r of byKey.values()) {
  const cls = classify(r);
  out.push({ name: r.name, address: r.address, phone: r.phone, website: r.website, vendorType: cls.vendorType, category: cls.category, cuisine: cls.cuisine || null, section: r.section });
}
out.sort((a, b) => a.vendorType.localeCompare(b.vendorType) || a.name.localeCompare(b.name));
fs.writeFileSync('out/services_1028_parsed.json', JSON.stringify(out, null, 1));
const counts = {};
for (const r of out) counts[r.vendorType] = (counts[r.vendorType] || 0) + 1;
console.log('parsed rows:', rows.length, 'unique:', out.length, counts);
