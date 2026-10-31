// Parse out/hotels_dwt.txt (prose list) and out/hotels_2.txt (tables) into
// staged hotel records at out/hotels_oct_parsed.json for import_listings-style
// insertion into apartments_hotels (listing_type='hotel').
const fs = require('fs');

const cleanUrl = (u) => (u || '').replace(/[?&]utm_[^&\]]*.*$/i, '').replace(/[?&]$/, '').trim();
const extractUrl = (s) => {
  const m = /\[\[([^\]]+)\]\]/.exec(s || '');
  return m ? cleanUrl(m[1]) : null;
};
const norm = (s) => (s || '').toLowerCase().replace(/[''’]/g, '').replace(/[^a-z0-9]/g, '');
const isPhone = (s) => /\(?\d{3}\)?[-.)\s]\s?\d{3}[-.\s]\d{4}/.test(s || '');
const badPhone = (s) => !s || /verify|not (listed|confirmed)|needs|unverif|confirm/i.test(s);

const out = new Map();
const add = (r) => {
  if (!r.name) return;
  const key = norm(r.name);
  const prev = out.get(key) || { name: r.name, address: null, phone: null, website: null };
  prev.address = prev.address || r.address;
  prev.phone = prev.phone || r.phone;
  prev.website = prev.website || r.website;
  out.set(key, prev);
};

// ---- File 1: hotels_dwt.txt — numbered prose entries ----------------------
// Pattern:  "P: N. <Name>" / "P: Address: <addr>" / "P: Hotel phone: <phone>"
//           / "P: Website: <host> [[url]]"
{
  const lines = fs.readFileSync('out/hotels_dwt.txt', 'utf8').split(/\r?\n/);
  let cur = null;
  const flush = () => { if (cur && cur.name) add(cur); cur = null; };
  for (const raw of lines) {
    if (!raw.startsWith('P:')) continue;
    const t = raw.slice(3).trim();
    const m = /^(\d+)\.\s+(.+)/.exec(t);
    if (m) { flush(); cur = { name: m[2].trim() }; continue; }
    if (!cur) continue;
    let mm;
    if ((mm = /^Address:\s*(.+)/i.exec(t))) cur.address = mm[1].trim();
    else if ((mm = /^Hotel phone:\s*(.+)/i.exec(t))) { const p = mm[1].trim(); if (isPhone(p)) cur.phone = p; }
    else if ((mm = /^Website:\s*(.+)/i.exec(t))) {
      const url = extractUrl(mm[1]);
      const bare = mm[1].replace(/\[\[[^\]]*\]\]/g, '').replace(/\s*—.*$/, '').trim();
      cur.website = url || (/\.(com|org|net|io|co)\b/i.test(bare.split(/\s/)[0] || '') ? `https://${bare.split(/\s/)[0]}` : null);
    }
  }
  flush();
}

// ---- File 2: hotels_2.txt — tables ----------------------------------------
// Shapes: "Hotel / Motel || Telephone || Address || Website" and
//         "Property || Phone || Address || Website"
{
  const lines = fs.readFileSync('out/hotels_2.txt', 'utf8').split(/\r?\n/);
  let inTable = false, headerSeen = false;
  for (const raw of lines) {
    if (raw.startsWith('TABLE:')) { inTable = true; headerSeen = false; continue; }
    if (raw.startsWith('END TABLE')) { inTable = false; continue; }
    if (!inTable || !raw.startsWith('  ROW:')) continue;
    const cells = raw.slice(6).split('||').map((c) => c.trim());
    if (!headerSeen) { headerSeen = true; continue; }
    const name = cells[0].replace(/\[\[[^\]]*\]\]/g, '').trim();
    if (!name) continue;
    const rec = { name, address: null, phone: null, website: null };
    for (let i = 1; i < cells.length; i++) {
      const cell = cells[i];
      const url = extractUrl(cell);
      if (url && !rec.website) rec.website = url;
      const bare = cell.replace(/\[\[[^\]]*\]\]/g, '').trim();
      if (!rec.phone && isPhone(bare)) rec.phone = bare;
      if (!rec.address && /\d+\s+[NSEW]?\.?\s*\w+.*(St|Ave|Rd|Dr|Blvd|Way|Ln|Pl|Ct|Drive|Street|Avenue|Road|Boulevard)/i.test(bare)) rec.address = bare;
      if (!rec.website && /\.(com|org|net|io|co)\b/i.test(bare) && !/\s/.test(bare)) rec.website = `https://${bare.replace(/^www\.?/i, 'www.')}`;
    }
    if (badPhone(rec.phone)) rec.phone = null;
    add(rec);
  }
}

const rows = [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync('out/hotels_oct_parsed.json', JSON.stringify(rows, null, 1));
console.log('hotels parsed:', rows.length);
for (const r of rows) console.log(` ${r.name} | ${r.address || 'no-addr'} | ${r.phone || '-'} | ${r.website || '-'}`);
