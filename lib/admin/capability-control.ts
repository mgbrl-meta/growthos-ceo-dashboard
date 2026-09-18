import 'server-only';

import crypto from 'crypto';

import { bigquery } from '@/lib/bigquery';
import { resolveTenantContextById } from '@/lib/tenancy/context';
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

export type GrowthOSAccessMode =
  | 'standard'
  | 'plan'
  | 'custom';

export type GrowthOSReleaseStage =
  | 'draft'
  | 'internal'
  | 'beta'
  | 'live'
  | 'archived';

export type GrowthOSSubmoduleStatus =
  | 'active'
  | 'draft'
  | 'suspended';

export type GrowthOSCapabilityType =
  | 'module'
  | 'submodule';

export type GrowthOSBrandAccessOverride =
  | 'default'
  | 'enabled'
  | 'disabled';

export type GrowthOSCapabilityAudience = {
  workspaceId: string;
  brandId: string;
};

let capabilityControlReady = false;
let capabilityMigrationReady = false;
let capabilityMigrationPromise: Promise<void> | null = null;

function requireProjectId() {
  if (!PROJECT_ID) {
    throw new Error(
      'Growth OS capability control requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );
  }

  return PROJECT_ID;
}

function deterministicId(prefix: string, parts: string[]) {
  return `${prefix}_${crypto
    .createHash('sha256')
    .update(parts.join(':'))
    .digest('hex')
    .slice(0, 24)}`;
}

function normalizeAccessMode(value: unknown): GrowthOSAccessMode {
  const normalized = String(value || '').trim().toLowerCase();

  if (
    normalized === 'standard' ||
    normalized === 'plan' ||
    normalized === 'custom'
  ) {
    return normalized;
  }

  throw new Error('INVALID_ACCESS_MODE');
}

function normalizeReleaseStage(value: unknown): GrowthOSReleaseStage {
  const normalized = String(value || '').trim().toLowerCase();

  if (
    normalized === 'draft' ||
    normalized === 'internal' ||
    normalized === 'beta' ||
    normalized === 'live' ||
    normalized === 'archived'
  ) {
    return normalized;
  }

  throw new Error('INVALID_RELEASE_STAGE');
}

function normalizeSubmoduleStatus(value: unknown): GrowthOSSubmoduleStatus {
  const normalized = String(value || '').trim().toLowerCase();

  if (
    normalized === 'active' ||
    normalized === 'draft' ||
    normalized === 'suspended'
  ) {
    return normalized;
  }

  throw new Error('INVALID_SUBMODULE_STATUS');
}

function normalizeOverride(value: unknown): GrowthOSBrandAccessOverride {
  const normalized = String(value || '').trim().toLowerCase();

  if (
    normalized === 'default' ||
    normalized === 'enabled' ||
    normalized === 'disabled'
  ) {
    return normalized;
  }

  throw new Error('INVALID_ACCESS_OVERRIDE');
}

export async function ensureGrowthOSCapabilityControl() {
  if (capabilityControlReady) {
    return;
  }

  if (process.env.GROWTHOS_CAPABILITY_AUTO_MIGRATE === 'true') {
    await migrateGrowthOSCapabilityControl();
    return;
  }

  // Runtime requests must never perform schema DDL/seeding. The explicit
  // admin control-plane bootstrap owns migrations. Existing deployments
  // already have these tables after Access Control V1.
  capabilityControlReady = true;
}

export async function syncGrowthOSCapabilityRegistry() {
  const projectId = requireProjectId();

  // Explicit Admin bootstrap registry sync.
  //
  // This intentionally runs even when the in-process migration readiness
  // flags are already true. That makes newly deployed submodules visible in
  // Admin without relying on a process restart, and it also repairs a control
  // plane that was bootstrapped before a new registry entry was added.
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

  for (const submodule of GROWTHOS_SUBMODULES) {
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
        // Newly introduced screens must still be launched explicitly from
        // Admin unless the registry deliberately opts them into another stage.
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

  // Every existing plan/module relationship receives rows for newly
  // registered submodules. Existing Admin choices are never overwritten.
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

  capabilityControlReady = true;
}


export async function migrateGrowthOSCapabilityControl() {
  if (capabilityMigrationReady) {
    capabilityControlReady = true;
    return;
  }

  if (capabilityMigrationPromise) {
    return capabilityMigrationPromise;
  }

  capabilityMigrationPromise = (async () => {
    const projectId = requireProjectId();

    // Keep existing module_type semantics intact. access_mode is a new,
    // explicit commercial entitlement dimension.
    await bigquery.query({
      location: LOCATION,
      query: `
        ALTER TABLE \`${projectId}.${DATASET_ID}.modules\`
        ADD COLUMN IF NOT EXISTS access_mode STRING
      `,
    });

    await bigquery.query({
      location: LOCATION,
      query: `
        ALTER TABLE \`${projectId}.${DATASET_ID}.modules\`
        ADD COLUMN IF NOT EXISTS release_stage STRING
      `,
    });

    // Settings is a protected first-class module. This MERGE is intentionally
    // insert-only so Admin-managed values are never overwritten on startup.
    await bigquery.query({
      location: LOCATION,
      query: `
        MERGE \`${projectId}.${DATASET_ID}.modules\` AS target
        USING (
          SELECT
            'settings' AS module_id,
            'Settings' AS module_name,
            'Workspace, billing, access, security and account controls.' AS description,
            'standard' AS module_type,
            'standard' AS access_mode,
            'live' AS release_stage,
            'system' AS category,
            'Settings' AS route_key,
            'active' AS status,
            FALSE AS setup_required
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

    // Call Commerce is an independently entitleable Growth OS module.
    // Insert-only: Admin remains the source of truth after registration.
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
            module_id,module_name,description,module_type,access_mode,release_stage,
            category,route_key,status,setup_required,created_at,updated_at
          )
          VALUES (
            source.module_id,source.module_name,source.description,source.module_type,
            source.access_mode,source.release_stage,source.category,source.route_key,
            source.status,source.setup_required,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()
          )
      `,
    });

    // First migration preserves everything that is already live today.
    // After that, any newly-seeded module starts in Draft so a code deploy
    // can never publish a new client capability by accident.
    const [moduleControlRows] = await bigquery.query({
      location: LOCATION,
      query: `
        SELECT
          COUNTIF(
            NULLIF(access_mode, '') IS NOT NULL
            OR NULLIF(release_stage, '') IS NOT NULL
          ) AS configured_rows
        FROM \`${projectId}.${DATASET_ID}.modules\`
      `,
    });

    const hasExistingModuleControl =
      Number((moduleControlRows as any[])?.[0]?.configured_rows || 0) > 0;

    await bigquery.query({
      location: LOCATION,
      query: `
        UPDATE \`${projectId}.${DATASET_ID}.modules\`
        SET
          access_mode = COALESCE(
            NULLIF(access_mode, ''),
            CASE
              WHEN module_id = 'settings' THEN 'standard'
              ELSE 'plan'
            END
          ),
          release_stage = COALESCE(
            NULLIF(release_stage, ''),
            CASE
              WHEN module_id = 'settings' THEN 'live'
              ELSE @default_release_stage
            END
          ),
          updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP())
        WHERE
          access_mode IS NULL
          OR access_mode = ''
          OR release_stage IS NULL
          OR release_stage = ''
      `,
      params: {
        default_release_stage: hasExistingModuleControl ? 'draft' : 'live',
      },
      types: {
        default_release_stage: 'STRING',
      },
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

    const [submoduleCountRows] = await bigquery.query({
      location: LOCATION,
      query: `
        SELECT COUNT(*) AS row_count
        FROM \`${projectId}.${DATASET_ID}.submodules\`
      `,
    });

    const firstSubmoduleBootstrap =
      Number((submoduleCountRows as any[])?.[0]?.row_count || 0) === 0;

    // Existing registry screens are preserved as Live on the first migration.
    // Any screen introduced by a later code deployment is seeded as Draft and
    // must be explicitly launched from Admin. Labels remain code-owned, while
    // status/access/release values remain Admin-owned.
    for (const submodule of GROWTHOS_SUBMODULES) {
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
          default_release_stage:
            submodule.defaultReleaseStage ||
            (firstSubmoduleBootstrap ? 'live' : 'draft'),
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

    // Preserve current behaviour: when a plan already includes a module,
    // all existing submodules begin included until Admin changes them.
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

    await bigquery.query({
      location: LOCATION,
      query: `
        CREATE TABLE IF NOT EXISTS
          \`${projectId}.${DATASET_ID}.brand_submodule_overrides\`
        (
          override_id STRING NOT NULL,
          workspace_id STRING NOT NULL,
          brand_id STRING NOT NULL,
          module_id STRING NOT NULL,
          submodule_id STRING NOT NULL,
          submodule_override STRING NOT NULL,
          created_at TIMESTAMP,
          updated_at TIMESTAMP
        )
        CLUSTER BY workspace_id, brand_id, module_id, submodule_id
      `,
    });

    await bigquery.query({
      location: LOCATION,
      query: `
        CREATE TABLE IF NOT EXISTS
          \`${projectId}.${DATASET_ID}.capability_release_audience\`
        (
          audience_id STRING NOT NULL,
          capability_type STRING NOT NULL,
          module_id STRING NOT NULL,
          submodule_id STRING,
          workspace_id STRING NOT NULL,
          brand_id STRING NOT NULL,
          created_at TIMESTAMP,
          updated_at TIMESTAMP
        )
        CLUSTER BY capability_type, module_id, workspace_id, brand_id
      `,
    });

    capabilityMigrationReady = true;
    capabilityControlReady = true;
  })();

  try {
    await capabilityMigrationPromise;
  } catch (error) {
    capabilityMigrationReady = false;
    capabilityControlReady = false;
    capabilityMigrationPromise = null;
    throw error;
  }

  capabilityMigrationPromise = null;
}

export async function updateGrowthOSModuleControl(input: {
  moduleId: string;
  accessMode: GrowthOSAccessMode;
  releaseStage: GrowthOSReleaseStage;
  status?: string;
  setupRequired?: boolean;
}) {
  await ensureGrowthOSCapabilityControl();

  const projectId = requireProjectId();
  const moduleId = String(input.moduleId || '').trim();

  if (!moduleId) {
    throw new Error('moduleId is required');
  }

  // Settings is the safe account/control destination and must never
  // disappear as a parent module. Admin controls its individual sections
  // as submodules instead.
  const protectedSettingsModule =
    moduleId === 'settings';

  const accessMode = protectedSettingsModule
    ? 'standard'
    : normalizeAccessMode(input.accessMode);

  const releaseStage = protectedSettingsModule
    ? 'live'
    : normalizeReleaseStage(input.releaseStage);

  const status = protectedSettingsModule
    ? 'active'
    : String(input.status || 'active').trim().toLowerCase();

  if (!['active', 'draft', 'suspended'].includes(status)) {
    throw new Error('INVALID_MODULE_STATUS');
  }

  await bigquery.query({
    location: LOCATION,
    query: `
      UPDATE \`${projectId}.${DATASET_ID}.modules\`
      SET
        access_mode = @access_mode,
        release_stage = @release_stage,
        status = @status,
        setup_required = @setup_required,
        updated_at = CURRENT_TIMESTAMP()
      WHERE module_id = @module_id
    `,
    params: {
      module_id: moduleId,
      access_mode: accessMode,
      release_stage: releaseStage,
      status,
      setup_required: protectedSettingsModule
        ? false
        : Boolean(input.setupRequired),
    },
    types: {
      module_id: 'STRING',
      access_mode: 'STRING',
      release_stage: 'STRING',
      status: 'STRING',
      setup_required: 'BOOL',
    },
  });

  return {
    moduleId,
    accessMode,
    releaseStage,
    status,
    setupRequired: protectedSettingsModule
      ? false
      : Boolean(input.setupRequired),
  };
}

export async function updateGrowthOSSubmoduleControl(input: {
  moduleId: string;
  submoduleId: string;
  accessMode: GrowthOSAccessMode;
  releaseStage: GrowthOSReleaseStage;
  status?: GrowthOSSubmoduleStatus;
}) {
  await ensureGrowthOSCapabilityControl();

  const projectId = requireProjectId();
  const moduleId = String(input.moduleId || '').trim();
  const submoduleId = String(input.submoduleId || '').trim();
  const accessMode = normalizeAccessMode(input.accessMode);
  const releaseStage = normalizeReleaseStage(input.releaseStage);
  const status = normalizeSubmoduleStatus(input.status || 'active');

  if (!moduleId || !submoduleId) {
    throw new Error('moduleId and submoduleId are required');
  }

  const [result] = await bigquery.query({
    location: LOCATION,
    query: `
      UPDATE \`${projectId}.${DATASET_ID}.submodules\`
      SET
        access_mode = @access_mode,
        release_stage = @release_stage,
        status = @status,
        updated_at = CURRENT_TIMESTAMP()
      WHERE
        module_id = @module_id
        AND submodule_id = @submodule_id
    `,
    params: {
      module_id: moduleId,
      submodule_id: submoduleId,
      access_mode: accessMode,
      release_stage: releaseStage,
      status,
    },
    types: {
      module_id: 'STRING',
      submodule_id: 'STRING',
      access_mode: 'STRING',
      release_stage: 'STRING',
      status: 'STRING',
    },
  });

  void result;

  return {
    moduleId,
    submoduleId,
    accessMode,
    releaseStage,
    status,
  };
}

export async function replaceGrowthOSCapabilityReleaseAudience(input: {
  capabilityType: GrowthOSCapabilityType;
  moduleId: string;
  submoduleId?: string | null;
  audience: GrowthOSCapabilityAudience[];
}) {
  await ensureGrowthOSCapabilityControl();

  const projectId = requireProjectId();
  const capabilityType =
    input.capabilityType === 'submodule' ? 'submodule' : 'module';
  const moduleId = String(input.moduleId || '').trim();
  const submoduleId =
    capabilityType === 'submodule'
      ? String(input.submoduleId || '').trim()
      : '';

  if (!moduleId || (capabilityType === 'submodule' && !submoduleId)) {
    throw new Error('INVALID_CAPABILITY');
  }

  const uniqueAudience = new Map<string, GrowthOSCapabilityAudience>();

  for (const item of input.audience || []) {
    const workspaceId = String(item.workspaceId || '').trim();
    const brandId = String(item.brandId || '').trim();

    if (!workspaceId || !brandId) {
      continue;
    }

    uniqueAudience.set(`${workspaceId}:${brandId}`, {
      workspaceId,
      brandId,
    });
  }

  const params: Record<string, unknown> = {
    capability_type: capabilityType,
    module_id: moduleId,
    submodule_id: submoduleId,
  };
  const types: Record<string, string> = {
    capability_type: 'STRING',
    module_id: 'STRING',
    submodule_id: 'STRING',
  };

  const statements = [
    `
      DELETE FROM \`${projectId}.${DATASET_ID}.capability_release_audience\`
      WHERE
        capability_type = @capability_type
        AND module_id = @module_id
        AND COALESCE(submodule_id, '') = @submodule_id
    `,
  ];

  Array.from(uniqueAudience.values()).forEach((item, index) => {
    const audienceIdKey = `audience_id_${index}`;
    const workspaceIdKey = `workspace_id_${index}`;
    const brandIdKey = `brand_id_${index}`;

    params[audienceIdKey] = deterministicId('rel', [
      capabilityType,
      moduleId,
      submoduleId,
      item.workspaceId,
      item.brandId,
    ]);
    params[workspaceIdKey] = item.workspaceId;
    params[brandIdKey] = item.brandId;
    types[audienceIdKey] = 'STRING';
    types[workspaceIdKey] = 'STRING';
    types[brandIdKey] = 'STRING';

    statements.push(`
      INSERT INTO \`${projectId}.${DATASET_ID}.capability_release_audience\`
      (
        audience_id,
        capability_type,
        module_id,
        submodule_id,
        workspace_id,
        brand_id,
        created_at,
        updated_at
      )
      VALUES (
        @${audienceIdKey},
        @capability_type,
        @module_id,
        NULLIF(@submodule_id, ''),
        @${workspaceIdKey},
        @${brandIdKey},
        CURRENT_TIMESTAMP(),
        CURRENT_TIMESTAMP()
      )
    `);
  });

  await bigquery.query({
    location: LOCATION,
    query: statements.join(';\n'),
    params,
    types,
  });

  return Array.from(uniqueAudience.values());
}

export async function updateGrowthOSPlanCapabilityEntitlements(input: {
  planId: string;
  modules: Array<{
    moduleId: string;
    enabled: boolean;
    submodules?: Array<{
      submoduleId: string;
      enabled: boolean;
    }>;
  }>;
}) {
  await ensureGrowthOSCapabilityControl();

  const projectId = requireProjectId();
  const planId = String(input.planId || '').trim();

  if (!planId) {
    throw new Error('planId is required');
  }

  const params: Record<string, unknown> = {
    plan_id: planId,
  };
  const types: Record<string, string> = {
    plan_id: 'STRING',
  };
  const statements: string[] = [];

  let moduleIndex = 0;
  let submoduleIndex = 0;

  for (const module of input.modules || []) {
    const moduleId = String(module.moduleId || '').trim();

    if (!moduleId) {
      continue;
    }

    const moduleIdKey = `module_id_${moduleIndex}`;
    const moduleEnabledKey = `module_enabled_${moduleIndex}`;
    params[moduleIdKey] = moduleId;
    params[moduleEnabledKey] = Boolean(module.enabled);
    types[moduleIdKey] = 'STRING';
    types[moduleEnabledKey] = 'BOOL';

    statements.push(`
      MERGE \`${projectId}.${DATASET_ID}.plan_modules\` AS target
      USING (
        SELECT
          @plan_id AS plan_id,
          @${moduleIdKey} AS module_id,
          @${moduleEnabledKey} AS enabled
      ) AS source
      ON
        target.plan_id = source.plan_id
        AND target.module_id = source.module_id
      WHEN MATCHED THEN
        UPDATE SET
          enabled = source.enabled,
          updated_at = CURRENT_TIMESTAMP()
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
    `);

    for (const submodule of module.submodules || []) {
      const submoduleId = String(submodule.submoduleId || '').trim();

      if (!submoduleId) {
        continue;
      }

      const submoduleModuleIdKey = `submodule_module_id_${submoduleIndex}`;
      const submoduleIdKey = `submodule_id_${submoduleIndex}`;
      const submoduleEnabledKey = `submodule_enabled_${submoduleIndex}`;
      params[submoduleModuleIdKey] = moduleId;
      params[submoduleIdKey] = submoduleId;
      params[submoduleEnabledKey] = Boolean(submodule.enabled);
      types[submoduleModuleIdKey] = 'STRING';
      types[submoduleIdKey] = 'STRING';
      types[submoduleEnabledKey] = 'BOOL';

      statements.push(`
        MERGE \`${projectId}.${DATASET_ID}.plan_submodules\` AS target
        USING (
          SELECT
            @plan_id AS plan_id,
            @${submoduleModuleIdKey} AS module_id,
            @${submoduleIdKey} AS submodule_id,
            @${submoduleEnabledKey} AS enabled
        ) AS source
        ON
          target.plan_id = source.plan_id
          AND target.module_id = source.module_id
          AND target.submodule_id = source.submodule_id
        WHEN MATCHED THEN
          UPDATE SET
            enabled = source.enabled,
            updated_at = CURRENT_TIMESTAMP()
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
      `);

      submoduleIndex += 1;
    }

    moduleIndex += 1;
  }

  if (statements.length > 0) {
    await bigquery.query({
      location: LOCATION,
      query: statements.join(';\n'),
      params,
      types,
    });
  }

  return { planId };
}


export async function updateGrowthOSBrandCapabilityOverrides(input: {
  workspaceId: string;
  brandId: string;
  moduleOverrides: Array<{
    moduleId: string;
    override: GrowthOSBrandAccessOverride;
  }>;
  submoduleOverrides: Array<{
    moduleId: string;
    submoduleId: string;
    override: GrowthOSBrandAccessOverride;
  }>;
}) {
  await ensureGrowthOSCapabilityControl();

  const projectId = requireProjectId();
  const workspaceId = String(input.workspaceId || '').trim();
  const brandId = String(input.brandId || '').trim();

  if (!workspaceId || !brandId) {
    throw new Error('workspaceId and brandId are required');
  }

  await resolveTenantContextById(workspaceId, brandId);

  const moduleOverrides = (input.moduleOverrides || [])
    .map(item => ({
      moduleId: String(item.moduleId || '').trim(),
      override: normalizeOverride(item.override),
    }))
    .filter(item => item.moduleId);

  const submoduleOverrides = (input.submoduleOverrides || [])
    .map(item => ({
      moduleId: String(item.moduleId || '').trim(),
      submoduleId: String(item.submoduleId || '').trim(),
      override: normalizeOverride(item.override),
    }))
    .filter(item => item.moduleId && item.submoduleId);

  const params: Record<string, unknown> = {
    workspace_id: workspaceId,
    brand_id: brandId,
  };
  const types: Record<string, string> = {
    workspace_id: 'STRING',
    brand_id: 'STRING',
  };
  const statements: string[] = [];

  if (moduleOverrides.length > 0) {
    const sourceRows = moduleOverrides.map((item, index) => {
      const overrideIdKey = `module_override_id_${index}`;
      const moduleIdKey = `module_override_module_id_${index}`;
      const overrideKey = `module_override_value_${index}`;

      params[overrideIdKey] = deterministicId('ovr', [
        workspaceId,
        brandId,
        item.moduleId,
      ]);
      params[moduleIdKey] = item.moduleId;
      params[overrideKey] = item.override;
      types[overrideIdKey] = 'STRING';
      types[moduleIdKey] = 'STRING';
      types[overrideKey] = 'STRING';

      return `
        SELECT
          @${overrideIdKey} AS override_id,
          @workspace_id AS workspace_id,
          @brand_id AS brand_id,
          @${moduleIdKey} AS module_id,
          @${overrideKey} AS module_override
      `;
    });

    statements.push(`
      MERGE \`${projectId}.${DATASET_ID}.brand_module_overrides\` AS target
      USING (
        ${sourceRows.join('\n        UNION ALL\n')}
      ) AS source
      ON
        target.workspace_id = source.workspace_id
        AND target.brand_id = source.brand_id
        AND target.module_id = source.module_id
      WHEN MATCHED THEN
        UPDATE SET
          override_id = source.override_id,
          module_override = source.module_override,
          updated_at = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN
        INSERT (
          override_id,
          workspace_id,
          brand_id,
          module_id,
          module_override,
          created_at,
          updated_at
        )
        VALUES (
          source.override_id,
          source.workspace_id,
          source.brand_id,
          source.module_id,
          source.module_override,
          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP()
        )
    `);
  }

  if (submoduleOverrides.length > 0) {
    const sourceRows = submoduleOverrides.map((item, index) => {
      const overrideIdKey = `submodule_override_id_${index}`;
      const moduleIdKey = `submodule_override_module_id_${index}`;
      const submoduleIdKey = `submodule_override_submodule_id_${index}`;
      const overrideKey = `submodule_override_value_${index}`;

      params[overrideIdKey] = deterministicId('smo', [
        workspaceId,
        brandId,
        item.moduleId,
        item.submoduleId,
      ]);
      params[moduleIdKey] = item.moduleId;
      params[submoduleIdKey] = item.submoduleId;
      params[overrideKey] = item.override;
      types[overrideIdKey] = 'STRING';
      types[moduleIdKey] = 'STRING';
      types[submoduleIdKey] = 'STRING';
      types[overrideKey] = 'STRING';

      return `
        SELECT
          @${overrideIdKey} AS override_id,
          @workspace_id AS workspace_id,
          @brand_id AS brand_id,
          @${moduleIdKey} AS module_id,
          @${submoduleIdKey} AS submodule_id,
          @${overrideKey} AS submodule_override
      `;
    });

    statements.push(`
      MERGE \`${projectId}.${DATASET_ID}.brand_submodule_overrides\` AS target
      USING (
        ${sourceRows.join('\n        UNION ALL\n')}
      ) AS source
      ON
        target.workspace_id = source.workspace_id
        AND target.brand_id = source.brand_id
        AND target.module_id = source.module_id
        AND target.submodule_id = source.submodule_id
      WHEN MATCHED THEN
        UPDATE SET
          override_id = source.override_id,
          submodule_override = source.submodule_override,
          updated_at = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN
        INSERT (
          override_id,
          workspace_id,
          brand_id,
          module_id,
          submodule_id,
          submodule_override,
          created_at,
          updated_at
        )
        VALUES (
          source.override_id,
          source.workspace_id,
          source.brand_id,
          source.module_id,
          source.submodule_id,
          source.submodule_override,
          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP()
        )
    `);
  }

  if (statements.length > 0) {
    await bigquery.query({
      location: LOCATION,
      query: statements.join(';\n'),
      params,
      types,
    });
  }

  return {
    workspaceId,
    brandId,
    moduleOverrides: moduleOverrides.length,
    submoduleOverrides: submoduleOverrides.length,
  };
}

export async function upsertGrowthOSBrandSubmoduleOverride(input: {
  workspaceId: string;
  brandId: string;
  moduleId: string;
  submoduleId: string;
  submoduleOverride: GrowthOSBrandAccessOverride;
}) {
  await ensureGrowthOSCapabilityControl();

  const projectId = requireProjectId();
  const workspaceId = String(input.workspaceId || '').trim();
  const brandId = String(input.brandId || '').trim();
  const moduleId = String(input.moduleId || '').trim();
  const submoduleId = String(input.submoduleId || '').trim();
  const submoduleOverride = normalizeOverride(input.submoduleOverride);

  if (!workspaceId || !brandId || !moduleId || !submoduleId) {
    throw new Error('INVALID_SUBMODULE_OVERRIDE');
  }

  const overrideId = deterministicId('smo', [
    workspaceId,
    brandId,
    moduleId,
    submoduleId,
  ]);

  await bigquery.query({
    location: LOCATION,
    query: `
      MERGE \`${projectId}.${DATASET_ID}.brand_submodule_overrides\` AS target
      USING (
        SELECT
          @override_id AS override_id,
          @workspace_id AS workspace_id,
          @brand_id AS brand_id,
          @module_id AS module_id,
          @submodule_id AS submodule_id,
          @submodule_override AS submodule_override
      ) AS source
      ON
        target.workspace_id = source.workspace_id
        AND target.brand_id = source.brand_id
        AND target.module_id = source.module_id
        AND target.submodule_id = source.submodule_id
      WHEN MATCHED THEN
        UPDATE SET
          submodule_override = source.submodule_override,
          updated_at = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN
        INSERT (
          override_id,
          workspace_id,
          brand_id,
          module_id,
          submodule_id,
          submodule_override,
          created_at,
          updated_at
        )
        VALUES (
          source.override_id,
          source.workspace_id,
          source.brand_id,
          source.module_id,
          source.submodule_id,
          source.submodule_override,
          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP()
        )
    `,
    params: {
      override_id: overrideId,
      workspace_id: workspaceId,
      brand_id: brandId,
      module_id: moduleId,
      submodule_id: submoduleId,
      submodule_override: submoduleOverride,
    },
    types: {
      override_id: 'STRING',
      workspace_id: 'STRING',
      brand_id: 'STRING',
      module_id: 'STRING',
      submodule_id: 'STRING',
      submodule_override: 'STRING',
    },
  });

  return {
    overrideId,
    workspaceId,
    brandId,
    moduleId,
    submoduleId,
    submoduleOverride,
  };
}

export async function listGrowthOSBrandSubmoduleOverrides(
  workspaceId: string,
  brandId: string
) {
  await ensureGrowthOSCapabilityControl();

  const projectId = requireProjectId();
  const normalizedWorkspaceId = String(workspaceId || '').trim();
  const normalizedBrandId = String(brandId || '').trim();

  if (!normalizedWorkspaceId || !normalizedBrandId) {
    throw new Error('workspaceId and brandId are required');
  }

  const [rows] = await bigquery.query({
    location: LOCATION,
    query: `
      SELECT
        module_id,
        submodule_id,
        submodule_override
      FROM \`${projectId}.${DATASET_ID}.brand_submodule_overrides\`
      WHERE
        workspace_id = @workspace_id
        AND brand_id = @brand_id
      QUALIFY
        ROW_NUMBER() OVER (
          PARTITION BY workspace_id, brand_id, module_id, submodule_id
          ORDER BY updated_at DESC, created_at DESC, override_id DESC
        ) = 1
      ORDER BY module_id, submodule_id
    `,
    params: {
      workspace_id: normalizedWorkspaceId,
      brand_id: normalizedBrandId,
    },
    types: {
      workspace_id: 'STRING',
      brand_id: 'STRING',
    },
  });

  return (rows || []).map((row: any) => ({
    moduleId: String(row.module_id || ''),
    submoduleId: String(row.submodule_id || ''),
    override: String(row.submodule_override || 'default'),
  }));
}
