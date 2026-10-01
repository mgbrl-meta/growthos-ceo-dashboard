import { BigQuery } from '@google-cloud/bigquery';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureAdcCredentialFile, loadGrowthOsEnv } from './pg-client.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
loadGrowthOsEnv(repoRoot);
ensureAdcCredentialFile();

const projectId = String(process.env.GCP_PROJECT_ID || process.env.BQ_PROJECT_ID || '').trim();
const datasetId = String(process.env.GROWTHOS_CALL_COMMERCE_ANALYTICS_DATASET || 'growthos_call_commerce').trim();
const tableId = String(process.env.GROWTHOS_CALL_COMMERCE_ANALYTICS_TABLE || 'operational_events').trim();
const location = String(process.env.GROWTHOS_CALL_COMMERCE_LOCATION || process.env.GCP_BQ_LOCATION || 'asia-south1').trim();
if (!projectId) throw new Error('GCP_PROJECT_ID_REQUIRED');

const bigquery = new BigQuery({ projectId });
const dataset = bigquery.dataset(datasetId);
const [datasetExists] = await dataset.exists();
if (!datasetExists) {
  await bigquery.createDataset(datasetId, { location });
  console.log(`CREATED_DATASET ${projectId}.${datasetId}`);
}

const table = dataset.table(tableId);
const [tableExists] = await table.exists();
if (!tableExists) {
  await dataset.createTable(tableId, {
    schema: [
      { name: 'analytics_event_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'workspace_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'brand_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'event_type', type: 'STRING', mode: 'REQUIRED' },
      { name: 'entity_type', type: 'STRING' },
      { name: 'entity_id', type: 'STRING' },
      { name: 'occurred_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'payload', type: 'JSON' },
      { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'exported_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
    ],
    timePartitioning: { type: 'DAY', field: 'occurred_at' },
    clustering: { fields: ['workspace_id', 'brand_id', 'event_type'] },
    description: 'Append-only analytics mirror of Growth OS Call Commerce operational events from PostgreSQL.',
  });
  console.log(`CREATED_TABLE ${projectId}.${datasetId}.${tableId}`);
} else {
  console.log(`TABLE_EXISTS ${projectId}.${datasetId}.${tableId}`);
}
