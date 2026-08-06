const fs = require('fs');
const r = JSON.parse(fs.readFileSync('endpoint-results.json', 'utf8'));
let md = '| # | Method | Path | Expected | Actual | Result | Notes |\n';
md += '|---|---|---|---|---|---|---|\n';
r.forEach((e, i) => {
  const exp = Array.isArray(e.expected) ? e.expected.join('/') : e.expected;
  const res = e.ok ? 'PASS' : 'FAIL';
  const note = e.note || '';
  md += `| ${i + 1} | ${e.method} | ${e.path} | ${exp} | ${e.status} | ${res} | ${note} |\n`;
});
fs.writeFileSync('endpoint-table.md', md);
console.log('wrote endpoint-table.md');
