import 'server-only';

import {
  getAdminClientsSnapshot,
} from '@/lib/admin/clients';

import {
  getAdminPlansSnapshot,
} from '@/lib/admin/plans';

import {
  getAdminModulesSnapshot,
} from '@/lib/admin/modules';

import {
  getAdminUsersSnapshot,
} from '@/lib/admin/users';

import {
  getAdminIntegrationsSnapshot,
} from '@/lib/admin/integrations';

import {
  getAdminDataHealthSnapshot,
} from '@/lib/admin/data-health';

import {
  getAdminSyncHistory,
} from '@/lib/admin/sync-history';

import {
  getAdminSystemSnapshot,
} from '@/lib/admin/system';


// ============================================================
// TYPES
// ============================================================

export type AdminOverviewClient = {

  workspaceId:
    string;

  brandId:
    string;

  name:
    string;

  status:
    string | null;

  planId:
    string | null;

  planName:
    string | null;

  subscriptionStatus:
    string | null;

  users:
    number;

  activeUsers:
    number;

  integrations:
    number;

  connectedIntegrations:
    number;

};


export type AdminOverviewAlert = {

  id:
    string;

  severity:
    | 'critical'
    | 'attention'
    | 'info';

  title:
    string;

  detail:
    string;

};


export type AdminOverviewSnapshot = {

  platform: {

    clients:
      number;

    activeClients:
      number;

    users:
      number;

    activeUsers:
      number;

    plans:
      number;

    activePlans:
      number;

    modules:
      number;

    activeModules:
      number;

    integrations:
      number;

    connectedIntegrations:
      number;

  };


  commercial: {

    subscribedClients:
      number;

    clientsWithoutSubscription:
      number;

    assignedClients:
      number;

    unassignedPlans:
      number;

  };


  operations: {

    healthRows:
      number;

    healthy:
      number;

    attention:
      number;

    critical:
      number;

    notMonitored:
      number;

    syncRuns:
      number;

    syncSuccess:
      number;

    syncFailed:
      number;

    syncRunning:
      number;

    syncPartial:
      number;

  };


  infrastructure: {

    ready:
      boolean;

    controlPlaneReady:
      boolean;

    dataPlaneReady:
      boolean;

    controlPlaneTables:
      number;

    controlPlaneRequiredTables:
      number;

    dataPlaneTables:
      number;

    dataPlaneRequiredTables:
      number;

    projectId:
      string;

    location:
      string;

    environment:
      string;

  };


  clients:
    AdminOverviewClient[];


  alerts:
    AdminOverviewAlert[];

};


// ============================================================
// ADMIN OVERVIEW
//
// IMPORTANT:
//
// Overview contains NO independent source-of-truth logic.
//
// It aggregates canonical Admin readers:
//
// Clients
// Plans
// Modules
// Users
// Integrations
// Data Health
// Sync History
// System
//
// Warehouse audit is deliberately excluded because it is a
// heavier on-demand infrastructure diagnostic.
// ============================================================

export async function getAdminOverviewSnapshot():

  Promise<
    AdminOverviewSnapshot
  > {

  // ==========================================================
  // 1. LOAD CANONICAL ADMIN SOURCES IN PARALLEL
  // ==========================================================

  const [

    clientsSnapshot,

    plansSnapshot,

    modulesSnapshot,

    usersSnapshot,

    integrationsSnapshot,

    dataHealthSnapshot,

    syncHistorySnapshot,

    systemSnapshot,

  ] =
    await Promise.all([

      getAdminClientsSnapshot(),

      getAdminPlansSnapshot(),

      getAdminModulesSnapshot(),

      getAdminUsersSnapshot(),

      getAdminIntegrationsSnapshot(),

      getAdminDataHealthSnapshot(),

      getAdminSyncHistory(),

      getAdminSystemSnapshot(),

    ]);


  // ==========================================================
  // 2. PLATFORM
  // ==========================================================

  const platform = {

    clients:
      clientsSnapshot.summary.total,

    activeClients:
      clientsSnapshot.summary.active,


    users:
      usersSnapshot.summary.totalUsers,

    activeUsers:
      usersSnapshot.summary.activeUsers,


    plans:
      plansSnapshot.summary.total,

    activePlans:
      plansSnapshot.summary.active,


    modules:
      modulesSnapshot.summary.total,

    activeModules:
      modulesSnapshot.summary.active,


    integrations:
      integrationsSnapshot.summary.total,

    connectedIntegrations:
      integrationsSnapshot.summary.connected,

  };


  // ==========================================================
  // 3. COMMERCIAL
  // ==========================================================

  const commercial = {

    subscribedClients:
      clientsSnapshot.summary.withSubscription,

    clientsWithoutSubscription:
      clientsSnapshot.summary.withoutSubscription,

    assignedClients:
      plansSnapshot.summary.assignedClients,

    unassignedPlans:
      plansSnapshot.summary.unassignedPlans,

  };


  // ==========================================================
  // 4. OPERATIONS
  // ==========================================================

  const operations = {

    healthRows:
      dataHealthSnapshot.summary.total,

    healthy:
      dataHealthSnapshot.summary.healthy,

    attention:
      dataHealthSnapshot.summary.attention,

    critical:
      dataHealthSnapshot.summary.critical,

    notMonitored:
      dataHealthSnapshot.summary.notMonitored
      ??
      0,


    syncRuns:
      syncHistorySnapshot.summary.total,

    syncSuccess:
      syncHistorySnapshot.summary.success,

    syncFailed:
      syncHistorySnapshot.summary.failed,

    syncRunning:
      syncHistorySnapshot.summary.running,

    syncPartial:
      syncHistorySnapshot.summary.partial,

  };


  // ==========================================================
  // 5. INFRASTRUCTURE
  // ==========================================================

  const infrastructureReady =
    systemSnapshot.controlPlane.ready
    &&
    systemSnapshot.dataPlane.ready;


  const infrastructure = {

    ready:
      infrastructureReady,

    controlPlaneReady:
      systemSnapshot.controlPlane.ready,

    dataPlaneReady:
      systemSnapshot.dataPlane.ready,


    controlPlaneTables:
      systemSnapshot.controlPlane.existingTables,

    controlPlaneRequiredTables:
      systemSnapshot.controlPlane.requiredTables,


    dataPlaneTables:
      systemSnapshot.dataPlane.existingTables,

    dataPlaneRequiredTables:
      systemSnapshot.dataPlane.requiredTables,


    projectId:
      systemSnapshot.bigquery.projectId,

    location:
      systemSnapshot.bigquery.location,

    environment:
      systemSnapshot.runtime.environment,

  };


  // ==========================================================
  // 6. CLIENT REGISTRY
  //
  // Overview receives only the compact fields it needs.
  // Full details remain in Admin → Clients.
  // ==========================================================

  const clients:
    AdminOverviewClient[] =
      clientsSnapshot.clients.map(
        client => ({

          workspaceId:
            client.workspaceId,

          brandId:
            client.brandId,

          name:
            client.brandName
            ||
            client.workspaceName
            ||
            client.brandId
            ||
            client.workspaceId,

          status:
            client.brandStatus,

          planId:
            client.planId,

          planName:
            client.planName,

          subscriptionStatus:
            client.subscriptionStatus,

          users:
            client.totalUsers,

          activeUsers:
            client.activeUsers,

          integrations:
            client.integrations,

          connectedIntegrations:
            client.connectedIntegrations,

        })
      );


  // ==========================================================
  // 7. ALERTS
  //
  // Derived only from existing canonical summaries.
  // No independent health model is introduced here.
  // ==========================================================

  const alerts:
    AdminOverviewAlert[] =
      [];


  // ----------------------------------------------------------
  // CRITICAL DATA HEALTH
  // ----------------------------------------------------------

  if (
    operations.critical >
    0
  ) {

    alerts.push({

      id:
        'data-health-critical',

      severity:
        'critical',

      title:
        'Critical data health',

      detail:
        `${operations.critical} data health row${
          operations.critical === 1
            ? ''
            : 's'
        } require immediate attention.`,

    });

  }


  // ----------------------------------------------------------
  // FAILED SYNC RUNS
  // ----------------------------------------------------------

  if (
    operations.syncFailed >
    0
  ) {

    alerts.push({

      id:
        'sync-failures',

      severity:
        'critical',

      title:
        'Sync failures recorded',

      detail:
        `${operations.syncFailed} sync run${
          operations.syncFailed === 1
            ? ''
            : 's'
        } have failed in the current Sync History window.`,

    });

  }


  // ----------------------------------------------------------
  // DATA HEALTH ATTENTION
  // ----------------------------------------------------------

  if (
    operations.attention >
    0
  ) {

    alerts.push({

      id:
        'data-health-attention',

      severity:
        'attention',

      title:
        'Data sources need attention',

      detail:
        `${operations.attention} monitored data health row${
          operations.attention === 1
            ? ''
            : 's'
        } currently require review.`,

    });

  }


  // ----------------------------------------------------------
  // CLIENT WITHOUT PLAN
  // ----------------------------------------------------------

  if (
    commercial.clientsWithoutSubscription >
    0
  ) {

    alerts.push({

      id:
        'clients-without-subscription',

      severity:
        'attention',

      title:
        'Client without subscription',

      detail:
        `${commercial.clientsWithoutSubscription} client${
          commercial.clientsWithoutSubscription === 1
            ? ''
            : 's'
        } currently ${
          commercial.clientsWithoutSubscription === 1
            ? 'has'
            : 'have'
        } no plan subscription.`,

    });

  }


  // ----------------------------------------------------------
  // INFRASTRUCTURE
  // ----------------------------------------------------------

  if (
    !infrastructure.ready
  ) {

    alerts.push({

      id:
        'infrastructure-not-ready',

      severity:
        'critical',

      title:
        'Infrastructure requires attention',

      detail:
        'One or more required Growth OS control-plane or data-plane tables are missing.',

    });

  }


  // ----------------------------------------------------------
  // CLEAN SYSTEM
  // ----------------------------------------------------------

  if (
    alerts.length ===
    0
  ) {

    alerts.push({

      id:
        'platform-clear',

      severity:
        'info',

      title:
        'Platform operational',

      detail:
        'No current administrative exceptions were detected by the Overview sources.',

    });

  }


  // ==========================================================
  // 8. RESPONSE
  // ==========================================================

  return {

    platform,

    commercial,

    operations,

    infrastructure,

    clients,

    alerts,

  };

}