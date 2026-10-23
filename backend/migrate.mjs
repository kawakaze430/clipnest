import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export async function migrate(pool, { directory = fileURLToPath(new URL('./db/migrations/', import.meta.url)) } = {}) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(81236011)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, sha256 char(64) NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const names = (await readdir(directory)).filter(n => /^\d{3}_[a-z0-9_]+\.sql$/.test(n)).sort();
    const applied = [];
    for (const name of names) {
      const sql = await readFile(path.join(directory, name), 'utf8');
      const hash = createHash('sha256').update(sql).digest('hex');
      const prior = await client.query('SELECT sha256 FROM schema_migrations WHERE name=$1', [name]);
      if (prior.rowCount) { if (prior.rows[0].sha256 !== hash) throw new Error(`Migration checksum mismatch: ${name}`); continue; }
      await client.query('BEGIN');
      try { await client.query(sql); await client.query('INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)', [name, hash]); await client.query('COMMIT'); applied.push(name); }
      catch (error) { await client.query('ROLLBACK'); throw error; }
    }
    return applied;
  } finally { await client.query('SELECT pg_advisory_unlock(81236011)').catch(() => {}); client.release(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {loadRuntimeConfig} = await import('./runtime-config.mjs');
  const { createPool } = await import('./db/store.mjs');
  const config = await loadRuntimeConfig(); if (!config.databaseUrl) throw new Error('DATABASE_URL is required');
  const pool = await createPool(config);
  try { console.log(JSON.stringify({ applied: await migrate(pool) })); } finally { await pool.end(); }
}
