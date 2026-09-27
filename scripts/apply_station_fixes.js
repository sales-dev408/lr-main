const { Client } = require('pg');
const fs = require('fs');

const fixes = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

const c = new Client({
  host: 'aws-1-us-east-2.pooler.supabase.com',
  port: 5432,
  user: 'postgres.okbolfpndeakmchpznmt',
  password: process.env.PGPASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

(async () => {
  await c.connect();
  await c.query('BEGIN');
  let n = 0;
  for (const f of fixes) {
    await c.query('UPDATE vendors SET station = $2, updated_at = now() WHERE id = $1', [f.id, f.docx_station]);
    n++;
  }
  await c.query('COMMIT');
  console.log('updated', n, 'stations');
  const r = await c.query(
    `SELECT station, count(*) FROM vendors
     WHERE station IN ('Thelda Williams Transit Center','Pioneer / Central Ave','Metro Parkway','Northern / 19th Ave','Glendale / 19th Ave','Jefferson / 1st Ave')
     GROUP BY 1 ORDER BY 1`,
  );
  console.log(r.rows);
  await c.end();
})().catch(async (e) => {
  try { await c.query('ROLLBACK'); } catch {}
  console.error(e.message);
  process.exit(1);
});
