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

export type AdminPlanSubmodule = {
  submoduleId: string;
  label: string;
  status: string;
  accessMode: string;
  releaseStage: string;
  enabled: boolean;
};

export type AdminPlanModule = {
  moduleId: string;
  moduleName: string | null;
  description: string | null;
  category: string | null;
  routeKey: string | null;
  moduleStatus: string | null;
  accessMode: string;
  releaseStage: string;
  setupRequired: boolean;
  enabled: boolean;
  submodules: AdminPlanSubmodule[];
};

export type AdminPlan = {
  planId: string;
  planName: string;
  description: string | null;
  status: string;
  monthlyOrderLimit: number | null;
  maxUsers: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  assignedClients: number;
  enabledModules: number;
  totalModules: number;
  enabledSubmodules: number;
  totalSubmodules: number;
  modules: AdminPlanModule[];
};

export type AdminPlansSnapshot = {
  summary: {
    total: number;
    active: number;
    inactive: number;
    assignedClients: number;
    unassignedPlans: number;
  };
  plans: AdminPlan[];
};

function requireProjectId() {
  if (!PROJECT_ID) {
    throw new Error(
      'Admin Plans requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );
  }

  return PROJECT_ID;
}

export async function getAdminPlansSnapshot(): Promise<AdminPlansSnapshot> {
  await ensureGrowthOSCapabilityControl();

  const projectId = requireProjectId();

  const [rows] = await bigquery.query({
    location: LOCATION,
    query: `
      WITH latest_subscriptions AS (
        SELECT *
        FROM \`${projectId}.${DATASET_ID}.brand_subscriptions\`
        QUALIFY ROW_NUMBER() OVER (
          PARTITION BY workspace_id, brand_id
          ORDER BY updated_at DESC, created_at DESC, subscription_id DESC
        ) = 1
      ),
      subscription_summary AS (
        SELECT
          plan_id,
          COUNT(DISTINCT CONCAT(workspace_id, ':', brand_id)) AS assigned_clients
        FROM latest_subscriptions
        WHERE status = 'active'
        GROUP BY plan_id
      )
      SELECT
        p.plan_id,
        p.plan_name,
        p.description,
        p.status AS plan_status,
        p.monthly_order_limit,
        p.max_users,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', p.created_at) AS plan_created_at,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', p.updated_at) AS plan_updated_at,
        COALESCE(ss.assigned_clients, 0) AS assigned_clients,

        m.module_id,
        m.module_name,
        m.description AS module_description,
        m.category,
        m.route_key,
        m.status AS module_status,
        COALESCE(NULLIF(m.access_mode, ''), 'plan') AS module_access_mode,
        COALESCE(NULLIF(m.release_stage, ''), 'live') AS module_release_stage,
        COALESCE(m.setup_required, FALSE) AS setup_required,
        COALESCE(pm.enabled, FALSE) AS module_enabled,

        sm.submodule_id,
        sm.label AS submodule_label,
        sm.status AS submodule_status,
        COALESCE(NULLIF(sm.access_mode, ''), 'plan') AS submodule_access_mode,
        COALESCE(NULLIF(sm.release_stage, ''), 'live') AS submodule_release_stage,
        COALESCE(psm.enabled, pm.enabled, FALSE) AS submodule_enabled

      FROM \`${projectId}.${DATASET_ID}.plans\` AS p
      LEFT JOIN subscription_summary AS ss ON ss.plan_id = p.plan_id
      CROSS JOIN \`${projectId}.${DATASET_ID}.modules\` AS m
      LEFT JOIN \`${projectId}.${DATASET_ID}.plan_modules\` AS pm
        ON pm.plan_id = p.plan_id
        AND pm.module_id = m.module_id
      LEFT JOIN \`${projectId}.${DATASET_ID}.submodules\` AS sm
        ON sm.module_id = m.module_id
      LEFT JOIN \`${projectId}.${DATASET_ID}.plan_submodules\` AS psm
        ON psm.plan_id = p.plan_id
        AND psm.module_id = sm.module_id
        AND psm.submodule_id = sm.submodule_id
      ORDER BY
        CASE p.plan_id
          WHEN 'starter' THEN 1
          WHEN 'pro' THEN 2
          WHEN 'advanced' THEN 3
          WHEN 'enterprise' THEN 4
          ELSE 99
        END,
        p.plan_name,
        CASE m.category
          WHEN 'workspace' THEN 1
          WHEN 'growth' THEN 2
          WHEN 'customers' THEN 3
          WHEN 'commerce' THEN 4
          WHEN 'data' THEN 5
          WHEN 'system' THEN 6
          ELSE 99
        END,
        m.module_name,
        sm.label
    `,
  });

  const planMap = new Map<string, AdminPlan>();
  const moduleMaps = new Map<string, Map<string, AdminPlanModule>>();

  for (const row of (rows || []) as any[]) {
    const planId = String(row.plan_id || '');
    const moduleId = String(row.module_id || '');

    if (!planId || !moduleId) {
      continue;
    }

    let plan = planMap.get(planId);

    if (!plan) {
      plan = {
        planId,
        planName: String(row.plan_name || planId),
        description: row.description ?? null,
        status: String(row.plan_status || 'unknown'),
        monthlyOrderLimit: toNullableNumber(row.monthly_order_limit),
        maxUsers: toNullableNumber(row.max_users),
        createdAt: row.plan_created_at ?? null,
        updatedAt: row.plan_updated_at ?? null,
        assignedClients: Number(row.assigned_clients || 0),
        enabledModules: 0,
        totalModules: 0,
        enabledSubmodules: 0,
        totalSubmodules: 0,
        modules: [],
      };
      planMap.set(planId, plan);
      moduleMaps.set(planId, new Map());
    }

    const planModuleMap = moduleMaps.get(planId)!;
    let module = planModuleMap.get(moduleId);

    if (!module) {
      const enabled = Boolean(row.module_enabled);
      const accessMode = String(row.module_access_mode || 'plan');
      module = {
        moduleId,
        moduleName: row.module_name ?? null,
        description: row.module_description ?? null,
        category: row.category ?? null,
        routeKey: row.route_key ?? null,
        moduleStatus: row.module_status ?? null,
        accessMode,
        releaseStage: String(row.module_release_stage || 'live'),
        setupRequired: Boolean(row.setup_required),
        enabled,
        submodules: [],
      };
      planModuleMap.set(moduleId, module);
      plan.modules.push(module);
      plan.totalModules += 1;

      if (
        accessMode === 'standard'
        ||
        (accessMode === 'plan' && enabled)
      ) {
        plan.enabledModules += 1;
      }
    }

    if (row.submodule_id) {
      const enabled = Boolean(row.submodule_enabled);
      const submoduleAccessMode = String(row.submodule_access_mode || 'plan');
      module.submodules.push({
        submoduleId: String(row.submodule_id),
        label: String(row.submodule_label || row.submodule_id),
        status: String(row.submodule_status || 'active'),
        accessMode: submoduleAccessMode,
        releaseStage: String(row.submodule_release_stage || 'live'),
        enabled,
      });
      plan.totalSubmodules += 1;

      const parentIncluded =
        module.accessMode === 'standard'
        ||
        (module.accessMode === 'plan' && module.enabled);

      if (
        parentIncluded
        &&
        (
          submoduleAccessMode === 'standard'
          ||
          (submoduleAccessMode === 'plan' && enabled)
        )
      ) {
        plan.enabledSubmodules += 1;
      }
    }
  }

  const plans = Array.from(planMap.values());
  const active = plans.filter(plan => plan.status.toLowerCase() === 'active').length;
  const assignedClients = plans.reduce((total, plan) => total + plan.assignedClients, 0);

  return {
    summary: {
      total: plans.length,
      active,
      inactive: plans.length - active,
      assignedClients,
      unassignedPlans: plans.filter(plan => plan.assignedClients === 0).length,
    },
    plans,
  };
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
