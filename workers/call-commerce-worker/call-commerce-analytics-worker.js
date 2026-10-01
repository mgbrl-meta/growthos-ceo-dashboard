import { BigQuery } from '@google-cloud/bigquery';
import { pgQuery } from './postgres.js';

const PROJECT_ID = String(
  process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || ''
).trim();
const DATASET = String(
  process.env.GROWTHOS_CALL_COMMERCE_ANALYTICS_DATASET || 'growthos_call_commerce'
).trim();
const TABLE = String(
  process.env.GROWTHOS_CALL_COMMERCE_ANALYTICS_TABLE || 'operational_events'
).trim();
const MAX_ATTEMPTS = Math.max(1, Number(process.env.CALL_COMMERCE_ANALYTICS_MAX_ATTEMPTS || 10));
const RETRY_DELAY_MINUTES = Math.max(1, Number(process.env.CALL_COMMERCE_ANALYTICS_RETRY_DELAY_MINUTES || 15));

if (!PROJECT_ID) throw new Error('CALL_COMMERCE_ANALYTICS_PROJECT_MISSING');
const bigquery = new BigQuery({ projectId: PROJECT_ID });

export async function processAnalyticsOutbox(workspaceId, brandId) {
  await pgQuery(
    `UPDATE call_commerce.analytics_outbox
     SET status='RETRY',next_attempt_at=NOW(),last_error=COALESCE(last_error,'STALE_PROCESSING_RECOVERED'),updated_at=NOW()
     WHERE workspace_id=$1 AND brand_id=$2
       AND status='PROCESSING'
       AND updated_at < NOW() - INTERVAL '15 minutes'`,
    [workspaceId, brandId]
  );

  const claimed = await pgQuery(
    `WITH picked AS (
       SELECT analytics_event_id
       FROM call_commerce.analytics_outbox
       WHERE workspace_id=$1 AND brand_id=$2
         AND status IN ('PENDING','RETRY')
         AND (next_attempt_at IS NULL OR next_attempt_at<=NOW())
       ORDER BY created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 500
     )
     UPDATE call_commerce.analytics_outbox a
     SET status='PROCESSING',updated_at=NOW(),last_error=NULL
     FROM picked
     WHERE a.analytics_event_id=picked.analytics_event_id
     RETURNING a.*`,
    [workspaceId, brandId]
  );

  if (!claimed.rows.length) {
    return { processed: 0, exported: 0, retry: 0, needsAttention: 0 };
  }

  const rows = claimed.rows.map(row => ({
    insertId: row.analytics_event_id,
    json: {
      analytics_event_id: row.analytics_event_id,
      workspace_id: row.workspace_id,
      brand_id: row.brand_id,
      event_type: row.event_type,
      entity_type: row.entity_type || null,
      entity_id: row.entity_id || null,
      occurred_at: new Date(row.occurred_at).toISOString(),
      payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
      created_at: new Date(row.created_at).toISOString(),
      exported_at: new Date().toISOString(),
    },
  }));

  try {
    await bigquery.dataset(DATASET).table(TABLE).insert(rows, { raw: true });
    const ids = claimed.rows.map(row => row.analytics_event_id);
    await pgQuery(
      `UPDATE call_commerce.analytics_outbox
       SET status='EXPORTED',attempts=attempts+1,next_attempt_at=NULL,last_error=NULL,exported_at=NOW(),updated_at=NOW()
       WHERE analytics_event_id = ANY($1::text[])`,
      [ids]
    );
    return { processed: ids.length, exported: ids.length, retry: 0, needsAttention: 0 };
  } catch (error) {
    const message = String(error?.message || 'CALL_COMMERCE_ANALYTICS_EXPORT_FAILED').slice(0, 4000);
    let retry = 0;
    let needsAttention = 0;
    for (const row of claimed.rows) {
      const attempts = Number(row.attempts || 0) + 1;
      const terminal = attempts >= MAX_ATTEMPTS;
      await pgQuery(
        `UPDATE call_commerce.analytics_outbox
         SET status=$2,attempts=$3,
             next_attempt_at=CASE WHEN $2='RETRY' THEN NOW()+($4::text || ' minutes')::interval ELSE NULL END,
             last_error=$5,updated_at=NOW()
         WHERE analytics_event_id=$1`,
        [
          row.analytics_event_id,
          terminal ? 'NEEDS_ATTENTION' : 'RETRY',
          attempts,
          RETRY_DELAY_MINUTES,
          message,
        ]
      );
      if (terminal) needsAttention += 1;
      else retry += 1;
    }
    return { processed: claimed.rows.length, exported: 0, retry, needsAttention, error: message };
  }
}
