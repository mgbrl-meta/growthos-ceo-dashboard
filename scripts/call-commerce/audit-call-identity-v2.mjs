import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createGrowthOsPgPool,
  ensureAdcCredentialFile,
  loadGrowthOsEnv,
} from '../operational-postgres/pg-client.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
loadGrowthOsEnv(repoRoot);
ensureAdcCredentialFile();

const requireIndexes = process.argv.includes('--require-indexes');
const { pool, close } = await createGrowthOsPgPool();

async function scalar(sql, params = []) {
  const result = await pool.query(sql, params);
  return Number(result.rows[0]?.count || 0);
}

try {
  const duplicateOpenLeads = await scalar(`
    SELECT COUNT(*)::int AS count FROM (
      SELECT workspace_id,brand_id,regexp_replace(COALESCE(phone,''),'[^0-9]','','g') phone_identity
      FROM call_commerce.call_leads
      WHERE is_archived=FALSE
        AND status IN ('NEW','QUALIFIED','FOLLOW_UP')
        AND regexp_replace(COALESCE(phone,''),'[^0-9]','','g') <> ''
      GROUP BY workspace_id,brand_id,regexp_replace(COALESCE(phone,''),'[^0-9]','','g')
      HAVING COUNT(*) > 1
    ) x
  `);

  const duplicateAttemptIdentities = await scalar(`
    SELECT COUNT(*)::int AS count FROM (
      SELECT workspace_id,brand_id,connection_id,provider_call_id
      FROM call_commerce.call_attempts
      GROUP BY workspace_id,brand_id,connection_id,provider_call_id
      HAVING COUNT(*) > 1
    ) x
  `);

  const attemptTenantMismatches = await scalar(`
    SELECT COUNT(*)::int AS count
    FROM call_commerce.call_attempts a
    JOIN call_commerce.call_leads l ON l.lead_id=a.lead_id
    WHERE a.workspace_id<>l.workspace_id OR a.brand_id<>l.brand_id
  `);

  const attemptPhoneMismatches = await scalar(`
    SELECT COUNT(*)::int AS count
    FROM call_commerce.call_attempts a
    JOIN call_commerce.call_leads l ON l.lead_id=a.lead_id
    WHERE regexp_replace(COALESCE(a.phone,''),'[^0-9]','','g') <> ''
      AND regexp_replace(COALESCE(l.phone,''),'[^0-9]','','g') <> ''
      AND regexp_replace(COALESCE(a.phone,''),'[^0-9]','','g')
          <> regexp_replace(COALESCE(l.phone,''),'[^0-9]','','g')
  `);

  const latestProjectionMismatches = await scalar(`
    WITH ranked AS (
      SELECT
        a.*,
        ROW_NUMBER() OVER (
          PARTITION BY a.workspace_id,a.brand_id,a.lead_id
          ORDER BY
            COALESCE(a.call_started_at,a.created_at) DESC,
            COALESCE(a.provider_updated_at,a.updated_at) DESC,
            a.created_at DESC,
            a.attempt_id DESC
        ) rn
      FROM call_commerce.call_attempts a
      WHERE a.lead_id IS NOT NULL
    )
    SELECT COUNT(*)::int AS count
    FROM call_commerce.call_leads l
    JOIN ranked r
      ON r.workspace_id=l.workspace_id
     AND r.brand_id=l.brand_id
     AND r.lead_id=l.lead_id
     AND r.rn=1
    WHERE COALESCE(l.latest_attempt_id,'')<>COALESCE(r.attempt_id,'')
       OR COALESCE(NULLIF(l.latest_call_status,''),'UNKNOWN')
          <> COALESCE(NULLIF(r.call_status,''),'UNKNOWN')
  `);

  // Diagnostic only. These rows may be legacy threading created by the old
  // reopen-grace behavior. The V2 engine prevents new ones; historical splitting
  // is intentionally not automated because it affects lead/Meta lifecycle history.
  const postTerminalLegs = await scalar(`
    SELECT COUNT(*)::int AS count
    FROM call_commerce.call_attempts a
    JOIN call_commerce.call_leads l ON l.lead_id=a.lead_id
    WHERE l.status IN ('PURCHASED','UNQUALIFIED','CLOSED_LOST')
      AND l.status_changed_at IS NOT NULL
      AND COALESCE(a.call_started_at,a.created_at) > l.status_changed_at
  `);

  const crossConnectorSameProviderIds = await scalar(`
    SELECT COUNT(*)::int AS count FROM (
      SELECT workspace_id,brand_id,provider_call_id
      FROM call_commerce.call_attempts
      GROUP BY workspace_id,brand_id,provider_call_id
      HAVING COUNT(DISTINCT connection_id) > 1
    ) x
  `);

  let missingRequiredIndexes = 0;
  if (requireIndexes) {
    const result = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname='call_commerce'
        AND indexname IN (
          'uq_cc_one_open_lead_per_phone',
          'idx_cc_leads_phone_identity',
          'idx_cc_attempts_connector_business_time'
        )
    `);
    missingRequiredIndexes = 3 - new Set(result.rows.map(row => row.indexname)).size;
  }

  const audit = {
    duplicateOpenLeads,
    duplicateAttemptIdentities,
    attemptTenantMismatches,
    attemptPhoneMismatches,
    latestProjectionMismatches,
    postTerminalLegs,
    crossConnectorSameProviderIds,
    ...(requireIndexes ? { missingRequiredIndexes } : {}),
  };
  console.log('CALL_COMMERCE_IDENTITY_AUDIT_V2', audit);

  const blocking =
    duplicateOpenLeads
    + duplicateAttemptIdentities
    + attemptTenantMismatches
    + attemptPhoneMismatches
    + latestProjectionMismatches
    + missingRequiredIndexes;

  if (postTerminalLegs > 0) {
    console.warn(
      'CALL_COMMERCE_LEGACY_POST_TERMINAL_LEGS',
      postTerminalLegs,
      'Historical review recommended; no automatic split is performed.'
    );
  }
  if (crossConnectorSameProviderIds > 0) {
    console.log(
      'CALL_COMMERCE_CROSS_CONNECTOR_PROVIDER_ID_REUSE',
      crossConnectorSameProviderIds,
      'Allowed because attempt identity includes connection_id.'
    );
  }

  if (blocking > 0) {
    console.error('CALL_COMMERCE_IDENTITY_AUDIT_FAILED', { blocking });
    process.exitCode = 2;
  } else {
    console.log('CALL_COMMERCE_IDENTITY_AUDIT_OK');
  }
} finally {
  await close().catch(() => {});
}
