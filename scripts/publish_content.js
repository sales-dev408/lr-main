const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const admin = await pool.query("SELECT id FROM admins WHERE email = 'admin@lightraildeals.com' LIMIT 1");
  const adminId = admin.rows[0]?.id || null;
  const blocks = await pool.query(
    'SELECT id, kind, title, body, url, position, published, created_at, updated_at FROM content_blocks WHERE published = true ORDER BY position, created_at',
  );
  const versionResult = await pool.query('SELECT COALESCE(MAX(version), 0) + 1 AS version FROM content_published');
  const version = versionResult.rows[0].version;
  const insert = await pool.query(
    'INSERT INTO content_published (version, published_by, content) VALUES ($1, $2, $3::jsonb) RETURNING version, published_at',
    [version, adminId, JSON.stringify(blocks.rows)],
  );
  console.log('Published version', insert.rows[0]);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
