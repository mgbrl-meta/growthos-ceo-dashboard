import 'server-only';

import {
  bigquery,
} from '@/lib/bigquery';

import {
  GROWTHOS_SUBMODULES,
} from '@/lib/auth/submodule-registry';

import {
  ensureMetaEventsSchema,
} from './schema';

const PROJECT_ID =
  process.env.GCP_PROJECT_ID
  ||
  process.env.BQ_PROJECT_ID
  ||
  '';

const DATASET_ID =
  process.env.GROWTHOS_CONTROL_DATASET
  ||
  'growthos_control';

const LOCATION =
  process.env.GCP_BQ_LOCATION
  ||
  'asia-south1';

function requireProjectId() {
  if (!PROJECT_ID) {
    throw new Error(
      'Meta Events registration requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );
  }

  return PROJECT_ID;
}

export async function registerMetaEventsCapabilities() {
  const projectId =
    requireProjectId();

  // ----------------------------------------------------------
  // MODULE
  //
  // Insert-only for Admin-owned control values.
  // ----------------------------------------------------------

  await bigquery.query({
    location:
      LOCATION,
    query: `
      MERGE \`${projectId}.${DATASET_ID}.modules\` AS target
      USING (
        SELECT
          'meta-events' AS module_id,
          'Meta Events' AS module_name,
          'Shared first-party event routing and Meta Conversions API delivery across Growth OS sources.' AS description,
          'commercial' AS module_type,
          'plan' AS access_mode,
          'draft' AS release_stage,
          'growth' AS category,
          'Meta Events' AS route_key,
          'active' AS status,
          TRUE AS setup_required
      ) AS source
      ON target.module_id=source.module_id
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

  // ----------------------------------------------------------
  // CONTROL-PLANE TABLES
  //
  // Keep this registration portable in the same way as Call
  // Commerce. Existing Admin-owned rows are never replaced.
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // PLAN MODULE ROWS
  //
  // Missing rows begin disabled. Admin Plans remains the source
  // of truth for launch and commercial entitlement.
  // ----------------------------------------------------------

  await bigquery.query({
    location:
      LOCATION,
    query: `
      MERGE \`${projectId}.${DATASET_ID}.plan_modules\` AS target
      USING (
        SELECT
          plan_id,
          'meta-events' AS module_id,
          FALSE AS enabled
        FROM \`${projectId}.${DATASET_ID}.plans\`
      ) AS source
      ON
        target.plan_id=source.plan_id
        AND target.module_id=source.module_id
      WHEN NOT MATCHED THEN
        INSERT (
          plan_id,
          module_id,
          enabled,
          created_at,
          updated_at
        )
        VALUES (
          source.plan_id,
          source.module_id,
          source.enabled,
          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP()
        )
    `,
  });

  const submodules =
    GROWTHOS_SUBMODULES.filter(
      item =>
        item.moduleId ===
        'meta-events'
    );

  for (
    const submodule
    of submodules
  ) {
    await bigquery.query({
      location:
        LOCATION,
      query: `
        MERGE \`${projectId}.${DATASET_ID}.submodules\` AS target
        USING (
          SELECT
            @module_id AS module_id,
            @submodule_id AS submodule_id,
            @label AS label
        ) AS source
        ON
          target.module_id=source.module_id
          AND target.submodule_id=source.submodule_id
        WHEN MATCHED THEN
          UPDATE SET
            label=source.label
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
        module_id:
          submodule.moduleId,
        submodule_id:
          submodule.submoduleId,
        label:
          submodule.label,
        default_access_mode:
          submodule.defaultAccessMode
          ||
          'plan',
        default_release_stage:
          submodule.defaultReleaseStage
          ||
          'draft',
      },
      types: {
        module_id:
          'STRING',
        submodule_id:
          'STRING',
        label:
          'STRING',
        default_access_mode:
          'STRING',
        default_release_stage:
          'STRING',
      },
    });
  }

  await bigquery.query({
    location:
      LOCATION,
    query: `
      MERGE \`${projectId}.${DATASET_ID}.plan_submodules\` AS target
      USING (
        SELECT
          pm.plan_id,
          sm.module_id,
          sm.submodule_id,
          COALESCE(pm.enabled,FALSE) AS enabled
        FROM \`${projectId}.${DATASET_ID}.plan_modules\` pm
        INNER JOIN \`${projectId}.${DATASET_ID}.submodules\` sm
          ON sm.module_id=pm.module_id
        WHERE
          pm.module_id='meta-events'
      ) AS source
      ON
        target.plan_id=source.plan_id
        AND target.module_id=source.module_id
        AND target.submodule_id=source.submodule_id
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

  // Meta Events owns its own portable data-plane bootstrap.
  await ensureMetaEventsSchema();
}
