const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('listings.html', 'utf8');
const $ = cheerio.load(html);

const allRows = [];
const HEADERS = ['Name', 'Address', 'City', 'Phone', 'Zip'];

$('h2.wsite-content-title').each((i, el) => {
  const sectionName = $(el).text().replace(/\u00a0/g, ' ').trim();
  const table = $(el).nextAll('div').find('.wsite-multicol-table').first();
  if (!table.length) return;
  const cols = [];
  table.find('td.wsite-multicol-col').each((j, td) => {
    const items = [];
    $(td).find('div.paragraph').each((k, div) => {
      const link = $(div).find('a[href]').attr('href') || '';
      const text = $(div).text().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
      if (text) items.push({ text, link });
    });
    cols.push(items);
  });
  const maxRows = Math.max(...cols.map(c => c.length));
  for (let r = 0; r < maxRows; r++) {
    const row = { section: sectionName };
    cols.forEach((c, idx) => {
      const header = HEADERS[idx] || `Col${idx}`;
      const item = c[r] || { text: '', link: '' };
      row[header] = item.text;
      if (item.link && header === 'Name') row['Link'] = item.link.replace(/^\//, '');
    });
    allRows.push(row);
  }
});

fs.writeFileSync('vendors_raw.json', JSON.stringify(allRows, null, 2));
console.log('rows', allRows.length);
