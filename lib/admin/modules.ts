import 'server-only';

import { bigquery } from '@/lib/bigquery';
import { ensureGrowthOSCapabilityControl } from '@/lib/admin/capability-control';

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

export type AdminCapabilityAudience = {
  workspaceId: string;
  brandId: string;
};

export type AdminSubmodule = {
  moduleId: string;
  submoduleId: string;
  label: string;
  status: string;
  accessMode: string;
  releaseStage: string;
  enabledPlans: number;
  totalPlanRows: number;
  clientOverrides: number;
  enabledOverrides: number;
  disabledOverrides: number;
  releaseAudience: AdminCapabilityAudience[];
};

export type AdminModule = {
  moduleId: string;
  moduleName: string;
  description: string | null;
  moduleType: string | null;
  accessMode: string;
  releaseStage: string;
  category: string | null;
  routeKey: string | null;
  status: string;
  setupRequired: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  enabledPlans: number;
  totalPlanRows: number;
  clientOverrides: number;
  enabledOverrides: number;
  disabledOverrides: number;
  releaseAudience: AdminCapabilityAudience[];
  submodules: AdminSubmodule[];
};

export type AdminModulesSnapshot = {
  summary: {
    total: number;
    active: number;
    inactive: number;
    standard: number;
    planControlled: number;
    custom: number;
    beta: number;
    setupRequired: number;
    planAssignments: number;
    clientOverrides: number;
  };
  modules: AdminModule[];
};

function requireProjectId() {
  if (!PROJECT_ID) {
    throw new Error(
      'Admin Modules requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );
  }

  return PROJECT_ID;
}

export async function getAdminModulesSnapshot(): Promise<AdminModulesSnapshot> {
  await ensureGrowthOSCapabilityControl();

  const projectId = requireProjectId();

  const [moduleRows] = await bigquery.query({
    location: LOCATION,
    query: `
      WITH plan_usage AS (
        SELECT
          module_id,
          COUNT(*) AS total_plan_rows,
          COUNT(DISTINCT IF(enabled = TRUE, plan_id, NULL)) AS enabled_plans
        FROM \`${projectId}.${DATASET_ID}.plan_modules\`
        GROUP BY module_id
      ),
      latest_overrides AS (
        SELECT *
        FROM \`${projectId}.${DATASET_ID}.brand_module_overrides\`
        QUALIFY ROW_NUMBER() OVER (
          PARTITION BY workspace_id, brand_id, module_id
          ORDER BY updated_at DESC, created_at DESC, override_id DESC
        ) = 1
      ),
      override_usage AS (
        SELECT
          module_id,
          COUNTIF(module_override != 'default') AS client_overrides,
          COUNTIF(module_override = 'enabled') AS enabled_overrides,
          COUNTIF(module_override = 'disabled') AS disabled_overrides
        FROM latest_overrides
        GROUP BY module_id
      )
      SELECT
        m.module_id,
        m.module_name,
        m.description,
        m.module_type,
        COALESCE(NULLIF(m.access_mode, ''), 'plan') AS access_mode,
        COALESCE(NULLIF(m.release_stage, ''), 'live') AS release_stage,
        m.category,
        m.route_key,
        m.status,
        COALESCE(m.setup_required, FALSE) AS setup_required,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', m.created_at) AS created_at,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', m.updated_at) AS updated_at,
        COALESCE(pu.enabled_plans, 0) AS enabled_plans,
        COALESCE(pu.total_plan_rows, 0) AS total_plan_rows,
        COALESCE(ou.client_overrides, 0) AS client_overrides,
        COALESCE(ou.enabled_overrides, 0) AS enabled_overrides,
        COALESCE(ou.disabled_overrides, 0) AS disabled_overrides
      FROM \`${projectId}.${DATASET_ID}.modules\` AS m
      LEFT JOIN plan_usage AS pu ON pu.module_id = m.module_id
      LEFT JOIN override_usage AS ou ON ou.module_id = m.module_id
      ORDER BY
        CASE m.category
          WHEN 'workspace' THEN 1
          WHEN 'growth' THEN 2
          WHEN 'customers' THEN 3
          WHEN 'commerce' THEN 4
          WHEN 'data' THEN 5
          WHEN 'system' THEN 6
          ELSE 99
        END,
        m.module_name
    `,
  });

  const [submoduleRows] = await bigquery.query({
    location: LOCATION,
    query: `
      WITH plan_usage AS (
        SELECT
          module_id,
          submodule_id,
          COUNT(*) AS total_plan_rows,
          COUNT(DISTINCT IF(enabled = TRUE, plan_id, NULL)) AS enabled_plans
        FROM \`${projectId}.${DATASET_ID}.plan_submodules\`
        GROUP BY module_id, submodule_id
      ),
      latest_overrides AS (
        SELECT *
        FROM \`${projectId}.${DATASET_ID}.brand_submodule_overrides\`
        QUALIFY ROW_NUMBER() OVER (
          PARTITION BY workspace_id, brand_id, module_id, submodule_id
          ORDER BY updated_at DESC, created_at DESC, override_id DESC
        ) = 1
      ),
      override_usage AS (
        SELECT
          module_id,
          submodule_id,
          COUNTIF(submodule_override != 'default') AS client_overrides,
          COUNTIF(submodule_override = 'enabled') AS enabled_overrides,
          COUNTIF(submodule_override = 'disabled') AS disabled_overrides
        FROM latest_overrides
        GROUP BY module_id, submodule_id
      )
      SELECT
        sm.module_id,
        sm.submodule_id,
        sm.label,
        sm.status,
        COALESCE(NULLIF(sm.access_mode, ''), 'plan') AS access_mode,
        COALESCE(NULLIF(sm.release_stage, ''), 'live') AS release_stage,
        COALESCE(pu.enabled_plans, 0) AS enabled_plans,
        COALESCE(pu.total_plan_rows, 0) AS total_plan_rows,
        COALESCE(ou.client_overrides, 0) AS client_overrides,
        COALESCE(ou.enabled_overrides, 0) AS enabled_overrides,
        COALESCE(ou.disabled_overrides, 0) AS disabled_overrides
      FROM \`${projectId}.${DATASET_ID}.submodules\` AS sm
      LEFT JOIN plan_usage AS pu
        ON pu.module_id = sm.module_id
        AND pu.submodule_id = sm.submodule_id
      LEFT JOIN override_usage AS ou
        ON ou.module_id = sm.module_id
        AND ou.submodule_id = sm.submodule_id
      ORDER BY sm.module_id, sm.label
    `,
  });

  const [audienceRows] = await bigquery.query({
    location: LOCATION,
    query: `
      SELECT
        capability_type,
        module_id,
        COALESCE(submodule_id, '') AS submodule_id,
        workspace_id,
        brand_id
      FROM \`${projectId}.${DATASET_ID}.capability_release_audience\`
      ORDER BY capability_type, module_id, submodule_id, workspace_id, brand_id
    `,
  });

  const audienceMap = new Map<string, AdminCapabilityAudience[]>();

  for (const row of (audienceRows || []) as any[]) {
    const key = `${row.capability_type}:${row.module_id}:${row.submodule_id || ''}`;
    const list = audienceMap.get(key) || [];
    list.push({
      workspaceId: String(row.workspace_id || ''),
      brandId: String(row.brand_id || ''),
    });
    audienceMap.set(key, list);
  }

  const submodulesByModule = new Map<string, AdminSubmodule[]>();

  for (const row of (submoduleRows || []) as any[]) {
    const moduleId = String(row.module_id || '');
    const submoduleId = String(row.submodule_id || '');

    if (!moduleId || !submoduleId) {
      continue;
    }

    const list = submodulesByModule.get(moduleId) || [];
    list.push({
      moduleId,
      submoduleId,
      label: String(row.label || submoduleId),
      status: String(row.status || 'active'),
      accessMode: String(row.access_mode || 'plan'),
      releaseStage: String(row.release_stage || 'live'),
      enabledPlans: Number(row.enabled_plans || 0),
      totalPlanRows: Number(row.total_plan_rows || 0),
      clientOverrides: Number(row.client_overrides || 0),
      enabledOverrides: Number(row.enabled_overrides || 0),
      disabledOverrides: Number(row.disabled_overrides || 0),
      releaseAudience:
        audienceMap.get(`submodule:${moduleId}:${submoduleId}`) || [],
    });
    submodulesByModule.set(moduleId, list);
  }

  const modules: AdminModule[] = ((moduleRows || []) as any[]).map(row => {
    const moduleId = String(row.module_id || '');

    return {
      moduleId,
      moduleName: String(row.module_name || moduleId),
      description: row.description ?? null,
      moduleType: row.module_type ?? null,
      accessMode: String(row.access_mode || 'plan'),
      releaseStage: String(row.release_stage || 'live'),
      category: row.category ?? null,
      routeKey: row.route_key ?? null,
      status: String(row.status || 'unknown'),
      setupRequired: Boolean(row.setup_required),
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
      enabledPlans: Number(row.enabled_plans || 0),
      totalPlanRows: Number(row.total_plan_rows || 0),
      clientOverrides: Number(row.client_overrides || 0),
      enabledOverrides: Number(row.enabled_overrides || 0),
      disabledOverrides: Number(row.disabled_overrides || 0),
      releaseAudience: audienceMap.get(`module:${moduleId}:`) || [],
      submodules: submodulesByModule.get(moduleId) || [],
    };
  });

  const active = modules.filter(module => normalize(module.status) === 'active').length;
  const standard = modules.filter(module => normalize(module.accessMode) === 'standard').length;
  const planControlled = modules.filter(module => normalize(module.accessMode) === 'plan').length;
  const custom = modules.filter(module => normalize(module.accessMode) === 'custom').length;
  const beta = modules.filter(module => normalize(module.releaseStage) === 'beta').length;

  return {
    summary: {
      total: modules.length,
      active,
      inactive: modules.length - active,
      standard,
      planControlled,
      custom,
      beta,
      setupRequired: modules.filter(module => module.setupRequired).length,
      planAssignments: modules.reduce((total, module) => total + module.enabledPlans, 0),
      clientOverrides: modules.reduce((total, module) => total + module.clientOverrides, 0),
    },
    modules,
  };
}

function normalize(value: string | null) {
  return String(value || '').trim().toLowerCase();
}
