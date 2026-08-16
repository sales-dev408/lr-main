const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const cat = await pool.query('SELECT category, count(*) FROM vendors GROUP BY category');
  console.log('categories', cat.rows);
  const station = await pool.query('SELECT station, count(*) FROM vendors WHERE station IS NOT NULL GROUP BY station');
  console.log('stations', station.rows);
  const sample = await pool.query('SELECT name, address, city, category, station, latitude, longitude FROM vendors LIMIT 5');
  console.log('vendor sample', sample.rows);
  const apt = await pool.query('SELECT name, section, station, city, address, latitude, longitude FROM apartments_hotels LIMIT 5');
  console.log('apartment sample', apt.rows);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
