import { BigQuery } from '@google-cloud/bigquery';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGrowthOsPgPool, ensureAdcCredentialFile, loadGrowthOsEnv } from './pg-client.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
loadGrowthOsEnv(repoRoot);
ensureAdcCredentialFile();

const projectId = String(process.env.GCP_PROJECT_ID || process.env.BQ_PROJECT_ID || '').trim();
const datasetId = String(process.env.GROWTHOS_CALL_COMMERCE_DATASET || 'growthos_call_commerce').trim();
const location = String(process.env.GROWTHOS_CALL_COMMERCE_LOCATION || process.env.GCP_BQ_LOCATION || 'asia-south1').trim();
const snapshotRaw = String(process.env.GROWTHOS_MIGRATION_BQ_SNAPSHOT_AT || '').trim();
if (!snapshotRaw) throw new Error('GROWTHOS_MIGRATION_BQ_SNAPSHOT_AT_REQUIRED');

const snapshotAt = new Date(snapshotRaw);
if (Number.isNaN(snapshotAt.getTime())) {
  throw new Error(`INVALID_GROWTHOS_MIGRATION_BQ_SNAPSHOT_AT:${snapshotRaw}`);
}
const snapshotIso = snapshotAt.toISOString();

if (!projectId) throw new Error('GCP_PROJECT_ID_REQUIRED');

const bigquery = new BigQuery({ projectId });

const tables = [
  // Config tables are effectively static during this preparation phase.
  { source: 'calling_connections',      dest: 'calling_connections',      pk: 'connection_id' },
  { source: 'calling_mapping_versions', dest: 'calling_mapping_versions', pk: 'mapping_version_id' },

  // High-churn/live tables are compared only through a stable cutoff so
  // BigQuery can continue receiving production traffic during preparation.
  { source: 'calling_test_events',  dest: 'calling_test_events',  pk: 'test_event_id', time: 'received_at' },
  { source: 'raw_call_events',      dest: 'raw_call_events',      pk: 'raw_event_id',  time: 'received_at' },
  { source: 'call_leads',           dest: 'call_leads',           pk: 'lead_id',       time: 'created_at' },
  { source: 'call_attempts',        dest: 'call_attempts',        pk: 'attempt_id',    time: 'created_at' },
  { source: 'activity_log',         dest: 'activity_log',         pk: 'activity_id',   time: 'created_at' },
  { source: 'meta_event_queue',     dest: 'meta_event_queue',     pk: 'queue_id',      time: 'created_at' },
  { source: 'meta_event_log',       dest: 'meta_event_log',       pk: 'log_id',        time: 'sent_at' },
];

function safeIdentifier(value) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`INVALID_IDENTIFIER:${value}`);
  }
  return value;
}

const { pool, close } = await createGrowthOsPgPool();
let failed = false;

try {
  const health = await pool.query(
    `SELECT NOW() AS now, current_database() AS database, current_user AS username`
  );
  console.log('POSTGRES_HEALTH', health.rows[0]);
  console.log('VALIDATION_BIGQUERY_SNAPSHOT', {
    snapshotAt: snapshotIso,
    note: 'BigQuery parity is evaluated against a fixed table snapshot captured before tail reconciliation. New live rows after the snapshot are intentionally excluded.'
  });

  for (const spec of tables) {
    const source = safeIdentifier(spec.source);
    const dest = safeIdentifier(spec.dest);
    const pk = safeIdentifier(spec.pk);
    const time = spec.time ? safeIdentifier(spec.time) : null;

    const [bqRows] = await bigquery.query({
      location,
      query: `
        SELECT
          COUNT(*) AS raw_count,
          COUNT(DISTINCT ${pk}) AS distinct_count
        FROM \`${projectId}.${datasetId}.${source}\`
        FOR SYSTEM_TIME AS OF TIMESTAMP('${snapshotIso}')
      `,
    });

    const pgRows = await pool.query(
      `
        SELECT COUNT(*)::bigint AS row_count
        FROM call_commerce."${dest}"
      `
    );

    const bqRaw = Number(bqRows?.[0]?.raw_count || 0);
    const bqDistinct = Number(bqRows?.[0]?.distinct_count || 0);
    const pgCount = Number(pgRows.rows?.[0]?.row_count || 0);
    const duplicateRows = Math.max(0, bqRaw - bqDistinct);

    // PostgreSQL intentionally enforces the canonical primary key. BigQuery
    // historical tables may contain duplicate logical rows, so parity must be
    // measured against distinct source keys, not physical warehouse row count.
    const ok = pgCount >= bqDistinct;
    if (!ok) failed = true;

    const dupText = duplicateRows > 0 ? ` duplicates_in_bq=${duplicateRows}` : '';
    const snapshotText = ' bq-snapshot';

    console.log(
      `${source.padEnd(28)} ` +
      `BigQueryRaw=${String(bqRaw).padStart(8)} ` +
      `BigQueryDistinct=${String(bqDistinct).padStart(8)} ` +
      `PostgreSQL=${String(pgCount).padStart(8)} ` +
      `${ok ? 'OK' : 'MISMATCH'}${dupText}${snapshotText}`
    );
  }

  const checks = {
    attemptOrphans:
      `SELECT COUNT(*)::int AS count
       FROM call_commerce.call_attempts a
       LEFT JOIN call_commerce.call_leads l ON l.lead_id=a.lead_id
       WHERE a.lead_id IS NOT NULL AND l.lead_id IS NULL`,

    activityOrphans:
      `SELECT COUNT(*)::int AS count
       FROM call_commerce.activity_log a
       LEFT JOIN call_commerce.call_leads l ON l.lead_id=a.lead_id
       WHERE l.lead_id IS NULL`,

    invalidActiveMappings:
      `SELECT COUNT(*)::int AS count
       FROM call_commerce.calling_connections c
       LEFT JOIN call_commerce.calling_mapping_versions m
         ON m.mapping_version_id=c.active_mapping_version_id
       WHERE c.active_mapping_version_id IS NOT NULL
         AND m.mapping_version_id IS NULL`,
  };

  for (const [name, sql] of Object.entries(checks)) {
    const result = await pool.query(sql);
    const count = Number(result.rows[0]?.count || 0);
    console.log(`${name}: ${count}`);
    if (count !== 0) failed = true;
  }

  const recent = await pool.query(`
    SELECT source_event, meta_event_name, status, last_http_status, created_at
    FROM (
      SELECT
        event_key AS source_event,
        event_name AS meta_event_name,
        status,
        NULL::integer AS last_http_status,
        created_at
      FROM call_commerce.meta_event_queue
      ORDER BY created_at DESC
      LIMIT 10
    ) x
    ORDER BY created_at DESC
  `).catch(() => ({ rows: [] }));

  if (recent.rows.length) console.table(recent.rows);

  if (failed) {
    console.error('VALIDATION_FAILED');
    process.exitCode = 2;
  } else {
    console.log('VALIDATION_OK');
  }
} finally {
  await close().catch(() => {});
}
