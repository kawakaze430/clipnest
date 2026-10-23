import { randomBytes } from 'node:crypto';
import pg from 'pg';

// Native PostgreSQL is used when TEST_DATABASE_URL is explicitly supplied.
// Otherwise PGlite runs actual PostgreSQL SQL in one backend. Its serialized
// adapter cannot validate TCP, pooling, row-lock races, or RDS behavior.
export async function testDatabase() {
  if (process.env.TEST_DATABASE_URL) {
    const schema = 'clipnest_test_' + randomBytes(8).toString('hex');
    const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    await admin.query(`CREATE SCHEMA ${schema}`);
    const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema},public`, max: 8 });
    return { pool, kind: 'native-postgresql', close: async () => { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); } };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const db = await PGlite.create();
  let queue = Promise.resolve();
  async function acquire() {
    let release;
    const previous = queue;
    queue = new Promise(resolve => { release = resolve; });
    await previous;
    return release;
  }
  async function query(sql, values) {
    if (typeof sql !== 'string') throw new Error('Test adapter requires SQL text');
    const results = values?.length ? [await db.query(sql, values)] : await db.exec(sql);
    const result = results.at(-1) || { rows: [], affectedRows: 0 };
    return { ...result, rowCount: result.affectedRows || result.rows?.length || 0 };
  }
  const pool = {
    async connect() { const release = await acquire(); return { query, release }; },
    async query(sql, values) { const release = await acquire(); try { return await query(sql, values); } finally { release(); } },
  };
  return { pool, kind: 'pglite-single-backend', close: () => db.close() };
}
