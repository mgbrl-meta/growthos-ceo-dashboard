import 'server-only';

import { bigquery } from '@/lib/bigquery';
import { GROWTHOS_SUBMODULES } from '@/lib/auth/submodule-registry';

const PROJECT_ID =
  process.env.GCP_PROJECT_ID ||
  process.env.BQ_PROJECT_ID ||
  '';

const DATASET_ID =
  process.env.GROWTHOS_CONTROL_DATASET ||
  'growthos_control';

const LOCATION =
  process.env.GCP_BQ_LOCATION ||
  'asia-south1';

function requireProjectId() {
  if (!PROJECT_ID) {
    throw new Error(
      'Call Commerce registration requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );
  }

  return PROJECT_ID;
}

/**
 * Registers only Call Commerce capabilities in the existing Growth OS control
 * plane. This is intentionally isolated from the global capability migration
 * path so existing module/submodule behavior remains unchanged.
 *
 * Existing Admin-owned values are preserved:
 * - status
 * - access_mode
 * - release_stage
 * - plan enablement
 *
 * On an existing row, only the code-owned label is refreshed.
 */
export async function registerCallCommerceCapabilities() {
  const projectId = requireProjectId();

  await bigquery.query({
    location: LOCATION,
    query: `
      MERGE \`${projectId}.${DATASET_ID}.modules\` AS target
      USING (
        SELECT
          'call-commerce' AS module_id,
          'Call Commerce' AS module_name,
          'Inbound call lead operations from call event through manually recorded conversion.' AS description,
          'commercial' AS module_type,
          'plan' AS access_mode,
          'draft' AS release_stage,
          'commerce' AS category,
          'Call Commerce' AS route_key,
          'active' AS status,
          TRUE AS setup_required
      ) AS source
      ON target.module_id = source.module_id
      WHEN NOT MATCHED THEN
        INSERT (
          module_id,
          module_name,
          description,
          module_type,
          access_mode,
          release_stage,
          category,
          route_key,
          status,
          setup_required,
          created_at,
          updated_at
        )
        VALUES (
          source.module_id,
          source.module_name,
          source.description,
          source.module_type,
          source.access_mode,
          source.release_stage,
          source.category,
          source.route_key,
          source.status,
          source.setup_required,
          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP()
        )
    `,
  });

  await bigquery.query({
    location: LOCATION,
    query: `
      CREATE TABLE IF NOT EXISTS
        \`${projectId}.${DATASET_ID}.submodules\`
      (
        module_id STRING NOT NULL,
        submodule_id STRING NOT NULL,
        label STRING NOT NULL,
        status STRING NOT NULL,
        access_mode STRING NOT NULL,
        release_stage STRING NOT NULL,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
      )
      CLUSTER BY module_id, submodule_id, status
    `,
  });

  const callCommerceSubmodules = GROWTHOS_SUBMODULES.filter(
    (submodule) => submodule.moduleId === 'call-commerce'
  );

  for (const submodule of callCommerceSubmodules) {
    await bigquery.query({
      location: LOCATION,
      query: `
        MERGE \`${projectId}.${DATASET_ID}.submodules\` AS target
        USING (
          SELECT
            @module_id AS module_id,
            @submodule_id AS submodule_id,
            @label AS label
        ) AS source
        ON
          target.module_id = source.module_id
          AND target.submodule_id = source.submodule_id
        WHEN MATCHED THEN
          UPDATE SET
            label = source.label
        WHEN NOT MATCHED THEN
          INSERT (
            module_id,
            submodule_id,
            label,
            status,
            access_mode,
            release_stage,
            created_at,
            updated_at
          )
          VALUES (
            source.module_id,
            source.submodule_id,
            source.label,
            'active',
            @default_access_mode,
            @default_release_stage,
            CURRENT_TIMESTAMP(),
            CURRENT_TIMESTAMP()
          )
      `,
      params: {
        module_id: submodule.moduleId,
        submodule_id: submodule.submoduleId,
        label: submodule.label,
        default_access_mode: submodule.defaultAccessMode || 'plan',
        default_release_stage: submodule.defaultReleaseStage || 'draft',
      },
      types: {
        module_id: 'STRING',
        submodule_id: 'STRING',
        label: 'STRING',
        default_access_mode: 'STRING',
        default_release_stage: 'STRING',
      },
    });
  }

  await bigquery.query({
    location: LOCATION,
    query: `
      CREATE TABLE IF NOT EXISTS
        \`${projectId}.${DATASET_ID}.plan_submodules\`
      (
        plan_id STRING NOT NULL,
        module_id STRING NOT NULL,
        submodule_id STRING NOT NULL,
        enabled BOOL NOT NULL,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
      )
      CLUSTER BY plan_id, module_id, submodule_id
    `,
  });

  // Seed only missing Call Commerce plan/submodule rows. Existing Admin
  // selections remain untouched.
  await bigquery.query({
    location: LOCATION,
    query: `
      MERGE \`${projectId}.${DATASET_ID}.plan_submodules\` AS target
      USING (
        SELECT
          pm.plan_id,
          sm.module_id,
          sm.submodule_id,
          COALESCE(pm.enabled, FALSE) AS enabled
        FROM \`${projectId}.${DATASET_ID}.plan_modules\` AS pm
        INNER JOIN \`${projectId}.${DATASET_ID}.submodules\` AS sm
          ON sm.module_id = pm.module_id
        WHERE pm.module_id = 'call-commerce'
      ) AS source
      ON
        target.plan_id = source.plan_id
        AND target.module_id = source.module_id
        AND target.submodule_id = source.submodule_id
      WHEN NOT MATCHED THEN
        INSERT (
          plan_id,
          module_id,
          submodule_id,
          enabled,
          created_at,
          updated_at
        )
        VALUES (
          source.plan_id,
          source.module_id,
          source.submodule_id,
          source.enabled,
          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP()
        )
    `,
  });
}
