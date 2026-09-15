import 'server-only';

import {
  bigquery,
} from '@/lib/bigquery';

import {
  getCachedAdminSnapshot,
} from '@/lib/admin/snapshot-cache';


// ============================================================
// CONFIG
// ============================================================

const PROJECT_ID =
  process.env.GCP_PROJECT_ID
  || process.env.BQ_PROJECT_ID
  || '';

const CONTROL_DATASET =
  process.env.GROWTHOS_CONTROL_DATASET
  || 'growthos_control';

const DATA_DATASET =
  process.env.GROWTHOS_DATA_DATASET
  || 'growthos_data';

const LOCATION =
  process.env.GROWTHOS_DATA_LOCATION
  || process.env.GCP_BQ_LOCATION
  || 'asia-south1';

const CONTROL_TABLES = [
  'workspaces',
  'brands',
  'plans',
  'modules',
  'plan_modules',
  'brand_subscriptions',
  'brand_module_overrides',
  'users',
  'brand_memberships',
  'integration_connections',
  'integration_accounts',
  'integration_sync_state',
  'integration_sync_runs',
] as const;

const DATA_TABLES = [
  'shopify_orders_raw_json',
  'shopify_orders_state',
  'shopify_customers_raw_json',
  'shopify_customers_state',
  'shopify_products_raw_json',
  'shopify_products_state',
] as const;


// ============================================================
// TYPES
// ============================================================

export type AdminOverviewClient = {
  workspaceId: string;
  brandId: string;
  name: string;
  status: string | null;
  planId: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  users: number;
  activeUsers: number;
  integrations: number;
  connectedIntegrations: number;
};

export type AdminOverviewAlert = {
  id: string;
  severity: 'critical' | 'attention' | 'info';
  title: string;
  detail: string;
};

export type AdminOverviewSnapshot = {
  platform: {
    clients: number;
    activeClients: number;
    users: number;
    activeUsers: number;
    plans: number;
    activePlans: number;
    modules: number;
    activeModules: number;
    integrations: number;
    connectedIntegrations: number;
  };
  commercial: {
    subscribedClients: number;
    clientsWithoutSubscription: number;
    assignedClients: number;
    unassignedPlans: number;
  };
  operations: {
    healthRows: number;
    healthy: number;
    attention: number;
    critical: number;
    notMonitored: number;
    syncRuns: number;
    syncSuccess: number;
    syncFailed: number;
    syncRunning: number;
    syncPartial: number;
  };
  infrastructure: {
    ready: boolean;
    controlPlaneReady: boolean;
    dataPlaneReady: boolean;
    controlPlaneTables: number;
    controlPlaneRequiredTables: number;
    dataPlaneTables: number;
    dataPlaneRequiredTables: number;
    projectId: string;
    location: string;
    environment: string;
  };
  clients: AdminOverviewClient[];
  alerts: AdminOverviewAlert[];
};


function requireProjectId() {
  if (!PROJECT_ID) {
    throw new Error('Admin Overview requires GCP_PROJECT_ID or BQ_PROJECT_ID');
  }
  return PROJECT_ID;
}

function numberValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function stringOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return String(value);
}


// ============================================================
// ADMIN OVERVIEW — PURPOSE-BUILT SERVING QUERY
//
// IMPORTANT:
//
// Overview intentionally does NOT call the full Clients, Plans,
// Modules, Users, Integrations, Data Health, Sync History and
// System readers. Doing so warmed eight independent snapshots on
// every cold Overview load.
//
// One BigQuery job now returns only the compact metrics and
// client rows the Overview UI actually renders.
// ============================================================

async function loadAdminOverviewSnapshot(): Promise<AdminOverviewSnapshot> {
  const projectId = requireProjectId();
  const controlTableList = CONTROL_TABLES.map(table => `'${table}'`).join(', ');
  const dataTableList = DATA_TABLES.map(table => `'${table}'`).join(', ');

  const [rawRows] = await bigquery.query({
    location: LOCATION,
    query: `
      WITH
      latest_workspaces AS (
        SELECT *
        FROM \`${projectId}.${CONTROL_DATASET}.workspaces\`
        QUALIFY ROW_NUMBER() OVER (
          PARTITION BY workspace_id
          ORDER BY updated_at DESC, created_at DESC
        ) = 1
      ),

      latest_brands AS (
        SELECT *
        FROM \`${projectId}.${CONTROL_DATASET}.brands\`
        QUALIFY ROW_NUMBER() OVER (
          PARTITION BY workspace_id, brand_id
          ORDER BY updated_at DESC, created_at DESC
        ) = 1
      ),

      latest_subscriptions AS (
        SELECT *
        FROM \`${projectId}.${CONTROL_DATASET}.brand_subscriptions\`
        QUALIFY ROW_NUMBER() OVER (
          PARTITION BY workspace_id, brand_id
          ORDER BY updated_at DESC, created_at DESC, subscription_id DESC
        ) = 1
      ),

      latest_memberships AS (
        SELECT *
        FROM \`${projectId}.${CONTROL_DATASET}.brand_memberships\`
        QUALIFY ROW_NUMBER() OVER (
          PARTITION BY user_id, workspace_id, brand_id
          ORDER BY updated_at DESC, created_at DESC, membership_id DESC
        ) = 1
      ),

      membership_summary AS (
        SELECT
          workspace_id,
          brand_id,
          COUNT(DISTINCT user_id) AS total_users,
          COUNT(DISTINCT IF(LOWER(COALESCE(status, '')) = 'active', user_id, NULL)) AS active_users
        FROM latest_memberships
        GROUP BY workspace_id, brand_id
      ),

      latest_users AS (
        SELECT *
        FROM \`${projectId}.${CONTROL_DATASET}.users\`
        QUALIFY ROW_NUMBER() OVER (
          PARTITION BY user_id
          ORDER BY updated_at DESC, created_at DESC, user_id DESC
        ) = 1
      ),

      latest_plans AS (
        SELECT *
        FROM \`${projectId}.${CONTROL_DATASET}.plans\`
        QUALIFY ROW_NUMBER() OVER (
          PARTITION BY plan_id
          ORDER BY updated_at DESC, created_at DESC, plan_id DESC
        ) = 1
      ),

      latest_modules AS (
        SELECT *
        FROM \`${projectId}.${CONTROL_DATASET}.modules\`
        QUALIFY ROW_NUMBER() OVER (
          PARTITION BY module_id
          ORDER BY updated_at DESC, created_at DESC, module_id DESC
        ) = 1
      ),

      latest_connections AS (
        SELECT *
        FROM \`${projectId}.${CONTROL_DATASET}.integration_connections\`
        QUALIFY ROW_NUMBER() OVER (
          PARTITION BY connection_id
          ORDER BY updated_at DESC, connected_at DESC, connection_id DESC
        ) = 1
      ),

      integration_summary AS (
        SELECT
          workspace_id,
          brand_id,
          COUNT(*) AS integrations,
          COUNTIF(LOWER(COALESCE(status, '')) IN ('connected', 'active', 'ready')) AS connected_integrations
        FROM latest_connections
        GROUP BY workspace_id, brand_id
      ),

      latest_sync_state AS (
        SELECT *
        FROM \`${projectId}.${CONTROL_DATASET}.integration_sync_state\`
        QUALIFY ROW_NUMBER() OVER (
          PARTITION BY workspace_id, brand_id, connection_id, provider, entity
          ORDER BY updated_at DESC, last_synced_at DESC, created_at DESC, sync_state_id DESC
        ) = 1
      ),

      health_rows AS (
        SELECT
          CASE
            WHEN LOWER(COALESCE(c.status, '')) IN ('error', 'disconnected', 'suspended', 'failed') THEN 'critical'
            WHEN COALESCE(s.consecutive_failures, 0) > 0 THEN 'critical'
            WHEN LOWER(COALESCE(s.incremental_status, '')) IN ('failed', 'error') THEN 'critical'
            WHEN LOWER(COALESCE(s.backfill_status, '')) IN ('failed', 'error') THEN 'critical'
            WHEN s.sync_state_id IS NULL THEN 'not_monitored'
            WHEN LOWER(COALESCE(s.incremental_status, '')) IN ('running', 'syncing', 'pending', 'queued') THEN 'attention'
            WHEN LOWER(COALESCE(s.backfill_status, '')) IN ('running', 'syncing', 'pending', 'queued') THEN 'attention'
            WHEN s.last_synced_at IS NULL THEN 'attention'
            WHEN s.next_sync_at IS NOT NULL
              AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), s.next_sync_at, MINUTE) > 30 THEN 'attention'
            ELSE 'healthy'
          END AS health
        FROM latest_connections AS c
        LEFT JOIN latest_sync_state AS s
          ON s.workspace_id = c.workspace_id
          AND (s.brand_id = c.brand_id OR (s.brand_id IS NULL AND c.brand_id IS NULL))
          AND s.connection_id = c.connection_id
          AND s.provider = c.provider
      ),

      latest_500_runs AS (
        SELECT status
        FROM \`${projectId}.${CONTROL_DATASET}.integration_sync_runs\`
        ORDER BY COALESCE(started_at, created_at) DESC
        LIMIT 500
      ),

      active_subscription_summary AS (
        SELECT
          plan_id,
          COUNT(DISTINCT CONCAT(workspace_id, ':', brand_id)) AS assigned_clients
        FROM latest_subscriptions
        WHERE LOWER(COALESCE(status, '')) = 'active'
        GROUP BY plan_id
      ),

      client_rows AS (
        SELECT
          b.workspace_id,
          b.brand_id,
          COALESCE(b.brand_name, w.workspace_name, b.brand_id, b.workspace_id) AS client_name,
          b.status AS brand_status,
          s.subscription_id,
          s.status AS subscription_status,
          s.plan_id,
          p.plan_name,
          COALESCE(ms.total_users, 0) AS total_users,
          COALESCE(ms.active_users, 0) AS active_users,
          COALESCE(ins.integrations, 0) AS integrations,
          COALESCE(ins.connected_integrations, 0) AS connected_integrations
        FROM latest_brands AS b
        LEFT JOIN latest_workspaces AS w
          ON w.workspace_id = b.workspace_id
        LEFT JOIN latest_subscriptions AS s
          ON s.workspace_id = b.workspace_id
          AND s.brand_id = b.brand_id
        LEFT JOIN latest_plans AS p
          ON p.plan_id = s.plan_id
        LEFT JOIN membership_summary AS ms
          ON ms.workspace_id = b.workspace_id
          AND ms.brand_id = b.brand_id
        LEFT JOIN integration_summary AS ins
          ON ins.workspace_id = b.workspace_id
          AND ins.brand_id = b.brand_id
      ),

      control_tables AS (
        SELECT COUNT(*) AS existing_tables
        FROM \`${projectId}.${CONTROL_DATASET}.INFORMATION_SCHEMA.TABLES\`
        WHERE table_type = 'BASE TABLE'
          AND table_name IN (${controlTableList})
      ),

      data_tables AS (
        SELECT COUNT(*) AS existing_tables
        FROM \`${projectId}.${DATA_DATASET}.INFORMATION_SCHEMA.TABLES\`
        WHERE table_type = 'BASE TABLE'
          AND table_name IN (${dataTableList})
      ),

      summary AS (
        SELECT
          (SELECT COUNT(*) FROM client_rows) AS platform_clients,
          (SELECT COUNTIF(LOWER(COALESCE(brand_status, '')) = 'active') FROM client_rows) AS active_clients,
          (SELECT COUNT(*) FROM latest_users) AS users,
          (SELECT COUNTIF(LOWER(COALESCE(status, '')) = 'active') FROM latest_users) AS active_users,
          (SELECT COUNT(*) FROM latest_plans) AS plans,
          (SELECT COUNTIF(LOWER(COALESCE(status, '')) = 'active') FROM latest_plans) AS active_plans,
          (SELECT COUNT(*) FROM latest_modules) AS modules,
          (SELECT COUNTIF(LOWER(COALESCE(status, '')) = 'active') FROM latest_modules) AS active_modules,
          (SELECT COUNT(*) FROM latest_connections) AS integrations,
          (SELECT COUNTIF(LOWER(COALESCE(status, '')) IN ('connected', 'active', 'ready')) FROM latest_connections) AS connected_integrations,

          (SELECT COUNTIF(subscription_id IS NOT NULL) FROM client_rows) AS subscribed_clients,
          (SELECT COUNTIF(subscription_id IS NULL) FROM client_rows) AS clients_without_subscription,
          (SELECT COALESCE(SUM(assigned_clients), 0) FROM active_subscription_summary) AS assigned_clients,
          (
            SELECT COUNT(*)
            FROM latest_plans AS p
            LEFT JOIN active_subscription_summary AS a ON a.plan_id = p.plan_id
            WHERE COALESCE(a.assigned_clients, 0) = 0
          ) AS unassigned_plans,

          (SELECT COUNT(*) FROM health_rows) AS health_rows,
          (SELECT COUNTIF(health = 'healthy') FROM health_rows) AS healthy,
          (SELECT COUNTIF(health = 'attention') FROM health_rows) AS attention,
          (SELECT COUNTIF(health = 'critical') FROM health_rows) AS critical,
          (SELECT COUNTIF(health = 'not_monitored') FROM health_rows) AS not_monitored,

          (SELECT COUNT(*) FROM latest_500_runs) AS sync_runs,
          (SELECT COUNTIF(LOWER(COALESCE(status, '')) = 'success') FROM latest_500_runs) AS sync_success,
          (SELECT COUNTIF(LOWER(COALESCE(status, '')) = 'failed') FROM latest_500_runs) AS sync_failed,
          (SELECT COUNTIF(LOWER(COALESCE(status, '')) = 'running') FROM latest_500_runs) AS sync_running,
          (SELECT COUNTIF(LOWER(COALESCE(status, '')) = 'partial') FROM latest_500_runs) AS sync_partial,

          (SELECT existing_tables FROM control_tables) AS control_plane_tables,
          (SELECT existing_tables FROM data_tables) AS data_plane_tables
      )

      SELECT
        s.*,
        c.workspace_id AS client_workspace_id,
        c.brand_id AS client_brand_id,
        c.client_name,
        c.brand_status AS client_status,
        c.plan_id AS client_plan_id,
        c.plan_name AS client_plan_name,
        c.subscription_status AS client_subscription_status,
        c.total_users AS client_users,
        c.active_users AS client_active_users,
        c.integrations AS client_integrations,
        c.connected_integrations AS client_connected_integrations
      FROM summary AS s
      LEFT JOIN client_rows AS c ON TRUE
      ORDER BY c.client_name
    `,
  });

  const rows = (rawRows || []) as any[];
  const row = rows[0] || {};

  const platform = {
    clients: numberValue(row.platform_clients),
    activeClients: numberValue(row.active_clients),
    users: numberValue(row.users),
    activeUsers: numberValue(row.active_users),
    plans: numberValue(row.plans),
    activePlans: numberValue(row.active_plans),
    modules: numberValue(row.modules),
    activeModules: numberValue(row.active_modules),
    integrations: numberValue(row.integrations),
    connectedIntegrations: numberValue(row.connected_integrations),
  };

  const commercial = {
    subscribedClients: numberValue(row.subscribed_clients),
    clientsWithoutSubscription: numberValue(row.clients_without_subscription),
    assignedClients: numberValue(row.assigned_clients),
    unassignedPlans: numberValue(row.unassigned_plans),
  };

  const operations = {
    healthRows: numberValue(row.health_rows),
    healthy: numberValue(row.healthy),
    attention: numberValue(row.attention),
    critical: numberValue(row.critical),
    notMonitored: numberValue(row.not_monitored),
    syncRuns: numberValue(row.sync_runs),
    syncSuccess: numberValue(row.sync_success),
    syncFailed: numberValue(row.sync_failed),
    syncRunning: numberValue(row.sync_running),
    syncPartial: numberValue(row.sync_partial),
  };

  const controlPlaneTables = numberValue(row.control_plane_tables);
  const dataPlaneTables = numberValue(row.data_plane_tables);
  const controlPlaneReady = controlPlaneTables === CONTROL_TABLES.length;
  const dataPlaneReady = dataPlaneTables === DATA_TABLES.length;

  const infrastructure = {
    ready: controlPlaneReady && dataPlaneReady,
    controlPlaneReady,
    dataPlaneReady,
    controlPlaneTables,
    controlPlaneRequiredTables: CONTROL_TABLES.length,
    dataPlaneTables,
    dataPlaneRequiredTables: DATA_TABLES.length,
    projectId,
    location: LOCATION,
    environment:
      process.env.VERCEL_ENV
      || process.env.NODE_ENV
      || 'development',
  };

  const clients: AdminOverviewClient[] = rows
    .filter(item => item.client_workspace_id && item.client_brand_id)
    .map(item => ({
      workspaceId: String(item.client_workspace_id),
      brandId: String(item.client_brand_id),
      name: String(item.client_name || item.client_brand_id || item.client_workspace_id),
      status: stringOrNull(item.client_status),
      planId: stringOrNull(item.client_plan_id),
      planName: stringOrNull(item.client_plan_name),
      subscriptionStatus: stringOrNull(item.client_subscription_status),
      users: numberValue(item.client_users),
      activeUsers: numberValue(item.client_active_users),
      integrations: numberValue(item.client_integrations),
      connectedIntegrations: numberValue(item.client_connected_integrations),
    }));

  const alerts: AdminOverviewAlert[] = [];

  if (operations.critical > 0) {
    alerts.push({
      id: 'data-health-critical',
      severity: 'critical',
      title: 'Critical data health',
      detail: `${operations.critical} data health row${operations.critical === 1 ? '' : 's'} require immediate attention.`,
    });
  }

  if (operations.syncFailed > 0) {
    alerts.push({
      id: 'sync-failures',
      severity: 'critical',
      title: 'Sync failures recorded',
      detail: `${operations.syncFailed} sync run${operations.syncFailed === 1 ? '' : 's'} have failed in the current Sync History window.`,
    });
  }

  if (operations.attention > 0) {
    alerts.push({
      id: 'data-health-attention',
      severity: 'attention',
      title: 'Data sources need attention',
      detail: `${operations.attention} monitored data health row${operations.attention === 1 ? '' : 's'} currently require review.`,
    });
  }

  if (commercial.clientsWithoutSubscription > 0) {
    alerts.push({
      id: 'clients-without-subscription',
      severity: 'attention',
      title: 'Client without subscription',
      detail: `${commercial.clientsWithoutSubscription} client${commercial.clientsWithoutSubscription === 1 ? '' : 's'} currently ${commercial.clientsWithoutSubscription === 1 ? 'has' : 'have'} no plan subscription.`,
    });
  }

  if (!infrastructure.ready) {
    alerts.push({
      id: 'infrastructure-not-ready',
      severity: 'critical',
      title: 'Infrastructure requires attention',
      detail: 'One or more required Growth OS control-plane or data-plane tables are missing.',
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: 'platform-clear',
      severity: 'info',
      title: 'Platform operational',
      detail: 'No current administrative exceptions were detected by the Overview source.',
    });
  }

  return {
    platform,
    commercial,
    operations,
    infrastructure,
    clients,
    alerts,
  };
}


// ============================================================
// CACHED ADMIN READER
// ============================================================

export async function getAdminOverviewSnapshot(
  options?: { fresh?: boolean }
): Promise<AdminOverviewSnapshot> {
  return getCachedAdminSnapshot(
    'admin:overview',
    loadAdminOverviewSnapshot,
    {
      fresh: options?.fresh,
      ttlMs: 60000,
    }
  );
}
