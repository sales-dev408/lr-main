const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('apartments.html', 'utf8');
const $ = cheerio.load(html);
const htmlStr = $('#wsite-content .paragraph').first().html() ?? '';
const lines = htmlStr.split(/<br\s*\/?>/i)
  .map((l) => cheerio.load(l).text().replace(/[\u00a0\u200B-\u200D\uFEFF]/g, ' ').replace(/\s+/g, ' ').trim())
  .filter((l) => l && l !== 'Community Contact Station');

const sections = new Set(['North Phoenix', 'Central', 'Downtown', 'Tempe', 'Mesa']);
const phoneRe = /\(\d{3}\)\s*\d{3}-\d{4}/;
const urlRe = /(?:www\.)?([a-z0-9-]+\.(?:com|net|org)(?:\/[a-z0-9-]*)?)/i;

const knownStations = [
  'Camelback/7th Ave', '19th Ave/Camelback', 'McDowell/Central', 'Campbell/Central',
  'Indian School/Central', 'Van Buren/Central', 'Jefferson/12 St.', '12 St/Washington',
  'Portland/Central', 'Smith-Martin/Apache', 'Mill/3rd St', 'Dorsey/Apache',
  'Rural/University', 'Center Pkwy/Washington', '101/Apache', 'Sycamore/Main',
];

function stripWebsite(raw) {
  const urlMatch = raw.match(urlRe);
  let website = '';
  let text = raw;
  if (urlMatch) {
    website = urlMatch[0].startsWith('www.') ? urlMatch[0] : urlMatch[1];
    text = text.replace(new RegExp(website.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim();
  }
  return { website, text };
}

function splitStationAndAddress(raw) {
  let { website, text } = stripWebsite(raw);
  text = text.replace(/\[email protected\]/i, '').trim();
  for (const station of knownStations) {
    const esc = station.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const startRe = new RegExp(`^(${esc})\\s+(.*)$`, 'i');
    const endRe = new RegExp(`^(.*?)\\s+(${esc})$`, 'i');
    if (startRe.test(text)) {
      const m = text.match(startRe);
      return { station: m[1].trim(), address: m[2].trim(), website };
    }
    if (endRe.test(text)) {
      const m = text.match(endRe);
      return { station: m[2].trim(), address: m[1].trim(), website };
    }
  }
  const m = text.match(/^(.*?)\s+(\d+[A-Za-z]?\s+[A-Za-z].*)$/);
  if (m) {
    return { station: m[1].trim(), address: m[2].trim(), website };
  }
  return { station: '', address: text, website };
}

function parseEntry(communityLine, addressLine) {
  const phoneMatch = communityLine.match(/^(.*?)\s+(\(\d{3}\)\s*\d{3}-\d{4})\s*(.*)$/);
  let name = communityLine;
  let phone = '';
  let rest = '';
  if (phoneMatch) {
    name = phoneMatch[1].trim();
    phone = phoneMatch[2].trim();
    rest = phoneMatch[3].trim();
  }
  const combined = (rest + ' ' + (addressLine || '')).trim();
  const { station, address, website } = splitStationAndAddress(combined);
  return { name, phone, station, address, website, raw: combined };
}

const entries = [];
let currentSection = '';
let pendingCommunityLine = '';

for (const line of lines) {
  if (sections.has(line)) {
    currentSection = line;
    if (pendingCommunityLine) {
      entries.push({ section: currentSection, ...parseEntry(pendingCommunityLine, '') });
      pendingCommunityLine = '';
    }
    continue;
  }
  if (phoneRe.test(line)) {
    if (pendingCommunityLine) {
      entries.push({ section: currentSection, ...parseEntry(pendingCommunityLine, '') });
    }
    pendingCommunityLine = line;
  } else {
    if (pendingCommunityLine) {
      entries.push({ section: currentSection, ...parseEntry(pendingCommunityLine, line) });
      pendingCommunityLine = '';
    }
  }
}
if (pendingCommunityLine) {
  entries.push({ section: currentSection, ...parseEntry(pendingCommunityLine, '') });
}

const sectionToCity = { 'North Phoenix': 'Phoenix', 'Central': 'Phoenix', 'Downtown': 'Phoenix', 'Tempe': 'Tempe', 'Mesa': 'Mesa' };
const apartments = entries.map(e => ({
  name: e.name.replace(/[\u00a0\u200B-\u200D\uFEFF]/g, ' ').replace(/\s+/g, ' ').trim(),
  section: e.section,
  station: e.station,
  address: e.address.replace(/\s+/g, ' ').trim(),
  city: sectionToCity[e.section] || 'Phoenix',
  state: 'AZ',
  zip: (e.address.match(/\b\d{5}\b$/) || [''])[0],
  phone: e.phone,
  website: e.website ? (e.website.startsWith('http') ? e.website : 'https://' + e.website) : null,
  raw: e.raw,
}));

fs.writeFileSync('apartments_raw.json', JSON.stringify(apartments, null, 2));
console.log('apartments', apartments.length);
