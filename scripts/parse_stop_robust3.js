const fs = require('fs');

function parseStopPage(file, stationName) {
  const html = fs.readFileSync(file, 'utf8');
  const htmlStr = html; // work with raw html; find wsite-content paragraph manually
  // Extract content between wsite-content start and footer
  const start = htmlStr.indexOf('id="wsite-content"');
  const end = htmlStr.indexOf('class="footer-wrap"');
  const content = end > start && start > -1 ? htmlStr.slice(start, end) : htmlStr;
  // Strip tags to a fixpoint; decode &amp; last so it can't unescape twice.
  let prev;
  let text = content.replace(/<br\s*\/?>/gi, '\n');
  do { prev = text; text = text.replace(/<[^>]+>/g, ' '); } while (text !== prev);
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[\u00a0\u200B-\u200D\uFEFF]/g, ' ');
  const chunks = text.split(/\n{2,}/).map(c => c.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
  const vendors = [];
  for (const chunk of chunks) {
    const phoneRe = /\(\d{3}\)\s*\d{3}-\d{4}/;
    const lines = chunk.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
    const phoneIdx = lines.findIndex(l => phoneRe.test(l));
    if (phoneIdx === -1) continue;
    const phone = lines[phoneIdx].match(phoneRe)[0];
    const name = lines[0] || '';
    const address = lines.slice(1, phoneIdx).join(' ').replace(/\s+/g, ' ').trim();
    if (name) {
      const zip = (address.match(/\b\d{5}\b/) || [''])[0];
      vendors.push({ name, address, phone, station: stationName, zip });
    }
  }
  return vendors;
}

const metro = parseStopPage('metro-pkwy.html', 'Metro Pkwy');
console.log('metro', metro.length);
metro.forEach(v => console.log(JSON.stringify(v)));
