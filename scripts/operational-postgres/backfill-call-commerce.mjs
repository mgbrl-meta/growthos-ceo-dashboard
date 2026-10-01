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
if (!projectId) throw new Error('GCP_PROJECT_ID_REQUIRED');

const bigquery = new BigQuery({
  projectId,
  credentials: process.env.GCP_CLIENT_EMAIL && process.env.GCP_PRIVATE_KEY
    ? {
        client_email: process.env.GCP_CLIENT_EMAIL,
        private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }
    : undefined,
});

const specs = [
  { source: 'calling_connections', dest: 'calling_connections', pk: ['connection_id'], deferActiveMapping: true, freshness: 'updated_at' },
  { source: 'calling_mapping_versions', dest: 'calling_mapping_versions', pk: ['mapping_version_id'], immutable: true },
  { source: 'calling_test_events', dest: 'calling_test_events', pk: ['test_event_id'], immutable: true },
  { source: 'raw_call_events', dest: 'raw_call_events', pk: ['raw_event_id'], freshness: 'processed_at' },
  { source: 'call_leads', dest: 'call_leads', pk: ['lead_id'], freshness: 'updated_at' },
  { source: 'call_attempts', dest: 'call_attempts', pk: ['attempt_id'], freshness: 'updated_at' },
  { source: 'activity_log', dest: 'activity_log', pk: ['activity_id'], immutable: true },
  { source: 'meta_event_queue', dest: 'meta_event_queue', pk: ['queue_id'], freshness: 'updated_at' },
  { source: 'meta_event_log', dest: 'meta_event_log', pk: ['log_id'], immutable: true },
  { source: 'call_commerce_settings', dest: 'settings', pk: ['workspace_id', 'brand_id'], optional: true, freshness: 'updated_at' },
];

function quoteIdentifier(value) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new Error(`INVALID_IDENTIFIER:${value}`);
  return `"${value}"`;
}

function normalizeJsonColumns(dest, row) {
  const jsonColumns = new Set({
    calling_mapping_versions: ['field_mappings', 'value_mappings'],
    calling_test_events: ['payload', 'discovered_fields'],
    raw_call_events: ['payload'],
    call_attempts: ['ivr_inputs'],
    activity_log: ['details'],
    meta_event_queue: ['payload'],
    meta_event_log: ['request_payload', 'response_payload'],
  }[dest] || []);

  for (const column of jsonColumns) {
    const value = row[column];
    if (value === null || value === undefined) continue;

    // node-postgres serializes JavaScript arrays as PostgreSQL ARRAY literals.
    // A JSONB destination instead needs JSON text, so always normalize every
    // JSON/JSONB backfill value to a valid JSON string before binding it.
    if (typeof value === 'string') {
      try {
        row[column] = JSON.stringify(JSON.parse(value));
      } catch {
        row[column] = JSON.stringify(value);
      }
      continue;
    }

    row[column] = JSON.stringify(value);
  }
  return row;
}

async function readRows(source, optional = false) {
  const table = `\`${projectId}.${datasetId}.${source}\``;
  try {
    const [rows] = await bigquery.query({
      location,
      query: `SELECT TO_JSON_STRING(t) AS row_json FROM ${table} AS t`,
    });
    return rows.map(row => JSON.parse(String(row.row_json || '{}')));
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    if (optional && (Number(error?.code) === 404 || message.includes('not found'))) {
      console.log(`SKIP optional missing BigQuery table: ${source}`);
      return [];
    }
    throw error;
  }
}

async function upsertRows(pool, spec, rows, deferredConnectionMappings) {
  let written = 0;
  for (const original of rows) {
    const row = normalizeJsonColumns(spec.dest, { ...original });

    if (spec.deferActiveMapping && row.active_mapping_version_id) {
      deferredConnectionMappings.push([row.connection_id, row.active_mapping_version_id]);
      row.active_mapping_version_id = null;
    }

    const columns = Object.keys(row).filter(key => row[key] !== undefined);
    if (!columns.length) continue;
    const values = columns.map(key => row[key]);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const updates = columns
      .filter(column => !spec.pk.includes(column))
      .map(column => `${quoteIdentifier(column)}=EXCLUDED.${quoteIdentifier(column)}`);

    const freshnessWhere = spec.freshness && columns.includes(spec.freshness)
      ? ` WHERE EXCLUDED.${quoteIdentifier(spec.freshness)} IS NULL
           OR target.${quoteIdentifier(spec.freshness)} IS NULL
           OR EXCLUDED.${quoteIdentifier(spec.freshness)} >= target.${quoteIdentifier(spec.freshness)}`
      : '';

    const conflictAction = spec.immutable || !updates.length
      ? 'DO NOTHING'
      : `DO UPDATE SET ${updates.join(',')}${freshnessWhere}`;

    const sql = `
      INSERT INTO call_commerce.${quoteIdentifier(spec.dest)} AS target (${columns.map(quoteIdentifier).join(',')})
      VALUES (${placeholders.join(',')})
      ON CONFLICT (${spec.pk.map(quoteIdentifier).join(',')})
      ${conflictAction}
    `;
    await pool.query(sql, values);
    written += 1;
  }
  return written;
}

const { pool, close } = await createGrowthOsPgPool();
const deferredConnectionMappings = [];

try {
  for (const spec of specs) {
    const rows = await readRows(spec.source, spec.optional);
    console.log(`${spec.source}: read ${rows.length}`);
    const written = await upsertRows(pool, spec, rows, deferredConnectionMappings);
    console.log(`${spec.dest}: upserted ${written}`);
  }

  for (const [connectionId, mappingVersionId] of deferredConnectionMappings) {
    await pool.query(
      `UPDATE call_commerce.calling_connections
       SET active_mapping_version_id=$2
       WHERE connection_id=$1`,
      [connectionId, mappingVersionId]
    );
  }

  await pool.query(`
    INSERT INTO growthos_core.tenants (workspace_id, brand_id)
    SELECT DISTINCT workspace_id, brand_id FROM call_commerce.call_leads
    ON CONFLICT (workspace_id, brand_id) DO NOTHING
  `);

  console.log('CALL_COMMERCE_BACKFILL_COMPLETE');
} finally {
  await close().catch(() => {});
}
