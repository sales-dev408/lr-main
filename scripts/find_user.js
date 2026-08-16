const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const rows = await pool.query("SELECT id, email, phone, status, name FROM users LIMIT 10");
  console.log(rows.rows);
  await pool.end();
}
main().catch(e=>{console.error(e); process.exit(1);});
