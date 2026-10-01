import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGrowthOsPgPool, loadGrowthOsEnv } from './pg-client.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
loadGrowthOsEnv(repoRoot);

const migrationsDir = path.join(repoRoot, 'infrastructure', 'postgres', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort();
const { pool, close } = await createGrowthOsPgPool();

try {
  await pool.query('CREATE SCHEMA IF NOT EXISTS growthos_core');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS growthos_core.schema_migrations (
      migration_id TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      applied_by TEXT
    )
  `);

  for (const file of files) {
    const migrationId = file.replace(/\.sql$/i, '');
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    const existing = await pool.query(
      'SELECT checksum FROM growthos_core.schema_migrations WHERE migration_id=$1',
      [migrationId]
    );

    if (existing.rows.length) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`MIGRATION_CHECKSUM_MISMATCH:${migrationId}`);
      }
      console.log(`SKIP ${migrationId}`);
      continue;
    }

    console.log(`APPLY ${migrationId}`);
    await pool.query(sql);
    await pool.query(
      `INSERT INTO growthos_core.schema_migrations (migration_id,checksum,applied_by)
       VALUES ($1,$2,$3)`,
      [migrationId, checksum, process.env.USERNAME || process.env.USER || 'growthos-installer']
    );
    console.log(`DONE  ${migrationId}`);
  }

  const result = await pool.query(
    `SELECT migration_id, applied_at FROM growthos_core.schema_migrations ORDER BY migration_id`
  );
  console.table(result.rows);
} finally {
  await close().catch(() => {});
}
