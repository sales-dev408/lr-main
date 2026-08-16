const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const v = await pool.query('SELECT count(*) AS total, count(latitude) AS with_coords FROM vendors');
  const a = await pool.query('SELECT count(*) AS total, count(latitude) AS with_coords FROM apartments_hotels');
  const admin = await pool.query("SELECT count(*) AS cnt FROM admins WHERE email = 'admin@lightraildeals.com'");
  console.log('vendors', v.rows[0]);
  console.log('apartments', a.rows[0]);
  console.log('admin', admin.rows[0]);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
