'use client';

import {
  type ReactNode,
  useEffect,
  useState,
} from 'react';

import {
  Activity,
  AlertTriangle,
  Boxes,
  Building2,
  CheckCircle2,
  CreditCard,
  Database,
  Plug,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';


// ============================================================
// TYPES
// ============================================================

type AlertSeverity =
  | 'critical'
  | 'attention'
  | 'info';


type AdminOverviewClient = {

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


type AdminOverviewAlert = {

  id:
    string;

  severity:
    AlertSeverity;

  title:
    string;

  detail:
    string;

};


type AdminOverview = {

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


type AdminOverviewResponse = {

  ok:
    boolean;

  scope?:
    string;

  overview?:
    AdminOverview;

  meta?: {

    durationMs?:
      number;

    source?:
      string;

    readOnly?:
      boolean;

  };

  error?:
    string;

};


// ============================================================
// MAIN
// ============================================================

export default function AdminOverview() {


  // ==========================================================
  // STATE
  // ==========================================================

  const [
    data,
    setData,
  ] =
    useState<
      AdminOverviewResponse |
      null
    >(
      null
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  // ==========================================================
  // LOAD
  // ==========================================================

  async function loadOverview() {

    setLoading(
      true
    );


    setError(
      null
    );


    try {

      const response =
        await fetch(
          '/api/admin/overview',
          {

            cache:
              'no-store',

            credentials:
              'same-origin',

          }
        );


      const json:
        AdminOverviewResponse =
          await response.json();


      if (
        !response.ok
        ||
        !json.ok
      ) {

        throw new Error(
          json.error
          ||
          'Unable to load Admin Overview'
        );

      }


      setData(
        json
      );

    } catch (
      error:
        any
    ) {

      console.error(
        'ADMIN_OVERVIEW_UI_ERROR',
        error
      );


      setData(
        null
      );


      setError(
        String(
          error?.message
          ||
          'Unable to load Admin Overview'
        )
      );

    } finally {

      setLoading(
        false
      );

    }

  }


  useEffect(
    () => {

      loadOverview();

    },
    []
  );


  // ==========================================================
  // LOADING
  // ==========================================================

  if (
    loading
    &&
    !data
  ) {

    return (

      <section className="gos-panel !p-4">

        <p className="text-[10px] text-slate-500">
          Loading Overview...
        </p>

      </section>

    );

  }


  // ==========================================================
  // ERROR
  // ==========================================================

  if (
    error
    &&
    !data
  ) {

    return (

      <section
        className="
          rounded-[10px]
          border
          border-red-200
          bg-red-50
          p-4
        "
      >

        <div
          className="
            flex
            items-start
            justify-between
            gap-3
          "
        >

          <div
            className="
              flex
              items-start
              gap-2
            "
          >

            <XCircle
              size={15}
              className="
                mt-0.5
                shrink-0
                text-red-600
              "
            />


            <div>

              <p
                className="
                  text-[10px]
                  font-semibold
                  text-red-800
                "
              >
                Unable to load Overview
              </p>


              <p
                className="
                  mt-1
                  text-[9px]
                  text-red-700
                "
              >
                {error}
              </p>

            </div>

          </div>


          <button

            type="button"

            onClick={
              loadOverview
            }

            className="
              h-7
              rounded-[7px]
              border
              border-red-200
              bg-white
              px-2.5
              text-[9px]
              font-semibold
              text-red-700
            "
          >
            Retry
          </button>

        </div>

      </section>

    );

  }


  const overview =
    data?.overview;


  if (!overview) {

    return null;

  }


  const {
    platform,
    commercial,
    operations,
    infrastructure,
    clients,
    alerts,
  } =
    overview;


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="space-y-3">


      {/* =====================================================
          HEADER
      ===================================================== */}

      <section
        className="
          gos-card
          flex
          flex-col
          gap-3
          p-3

          md:flex-row
          md:items-center
          md:justify-between
        "
      >

        <div>

          <h2
            className="
              text-[14px]
              font-semibold
              tracking-[-0.025em]
              text-slate-950
            "
          >
            Platform Overview
          </h2>


          <p
            className="
              mt-0.5
              text-[10px]
              text-slate-500
            "
          >
            Global Growth OS control-plane, commercial, operational and infrastructure summary.
          </p>

        </div>


        <button

          type="button"

          onClick={
            loadOverview
          }

          disabled={
            loading
          }

          className="
            inline-flex
            h-8
            items-center
            gap-1.5
            rounded-[8px]
            border
            border-slate-200
            bg-white
            px-3
            text-[9px]
            font-semibold
            text-slate-700

            hover:bg-slate-50
            disabled:opacity-60
          "
        >

          <RefreshCw

            size={12}

            className={
              loading
                ? 'animate-spin'
                : ''
            }

          />

          Refresh

        </button>

      </section>


      {/* =====================================================
          PRIMARY KPI
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-2
          gap-2

          md:grid-cols-3
          xl:grid-cols-6
        "
      >

        <MetricCard
          icon={
            Building2
          }
          label="Clients"
          value={
            platform.clients
          }
          detail={`${platform.activeClients} active`}
        />


        <MetricCard
          icon={
            Users
          }
          label="Users"
          value={
            platform.users
          }
          detail={`${platform.activeUsers} active`}
        />


        <MetricCard
          icon={
            CreditCard
          }
          label="Plans"
          value={
            platform.plans
          }
          detail={`${platform.activePlans} active`}
        />


        <MetricCard
          icon={
            Boxes
          }
          label="Modules"
          value={
            platform.modules
          }
          detail={`${platform.activeModules} active`}
        />


        <MetricCard
          icon={
            Plug
          }
          label="Integrations"
          value={
            platform.integrations
          }
          detail={`${platform.connectedIntegrations} connected`}
          tone={
            platform.connectedIntegrations ===
              platform.integrations
              ? 'green'
              : 'amber'
          }
        />


        <MetricCard
          icon={
            infrastructure.ready
              ? CheckCircle2
              : AlertTriangle
          }
          label="System"
          value={
            infrastructure.ready
              ? 'Ready'
              : 'Attention'
          }
          detail={`${infrastructure.controlPlaneTables}/${infrastructure.controlPlaneRequiredTables} control · ${infrastructure.dataPlaneTables}/${infrastructure.dataPlaneRequiredTables} data`}
          tone={
            infrastructure.ready
              ? 'green'
              : 'red'
          }
        />

      </section>


      {/* =====================================================
          ALERTS + OPERATIONS
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-3

          xl:grid-cols-[1.15fr_1fr]
        "
      >


        {/* ===================================================
            ALERTS
        =================================================== */}

        <section className="gos-panel !p-0">

          <div
            className="
              border-b
              border-slate-200
              px-3
              py-2.5
            "
          >

            <h3 className="gos-section-title">
              Administrative Alerts
            </h3>


            <p
              className="
                mt-0.5
                text-[9px]
                text-slate-500
              "
            >
              Exceptions derived from canonical Admin data sources.
            </p>

          </div>


          <div>

            {alerts.map(
              alert => (

                <AlertRow
                  key={
                    alert.id
                  }
                  alert={
                    alert
                  }
                />

              )
            )}

          </div>

        </section>


        {/* ===================================================
            DATA OPERATIONS
        =================================================== */}

        <section className="gos-panel !p-3.5">

          <div
            className="
              flex
              items-center
              justify-between
              gap-3
            "
          >

            <div>

              <h3 className="gos-section-title">
                Data Operations
              </h3>


              <p
                className="
                  mt-0.5
                  text-[9px]
                  text-slate-500
                "
              >
                Current Data Health and Sync History summary.
              </p>

            </div>


            <Activity
              size={15}
              className="text-violet-600"
            />

          </div>


          <div
            className="
              mt-3
              grid
              grid-cols-2
              gap-2
            "
          >

            <StatusTile
              label="Healthy"
              value={
                operations.healthy
              }
              tone="green"
            />


            <StatusTile
              label="Attention"
              value={
                operations.attention
              }
              tone={
                operations.attention >
                  0
                  ? 'amber'
                  : 'green'
              }
            />


            <StatusTile
              label="Critical"
              value={
                operations.critical
              }
              tone={
                operations.critical >
                  0
                  ? 'red'
                  : 'green'
              }
            />


            <StatusTile
              label="Not Monitored"
              value={
                operations.notMonitored
              }
              tone="slate"
            />

          </div>


          <div
            className="
              mt-3
              grid
              grid-cols-2
              gap-2
            "
          >

            <ValueBox
              label="Sync Runs"
              value={
                formatNumber(
                  operations.syncRuns
                )
              }
            />


            <ValueBox
              label="Successful"
              value={
                formatNumber(
                  operations.syncSuccess
                )
              }
              tone="green"
            />


            <ValueBox
              label="Failed"
              value={
                formatNumber(
                  operations.syncFailed
                )
              }
              tone={
                operations.syncFailed >
                  0
                  ? 'red'
                  : 'default'
              }
            />


            <ValueBox
              label="Running / Partial"
              value={`${operations.syncRunning} / ${operations.syncPartial}`}
            />

          </div>

        </section>

      </section>


      {/* =====================================================
          CLIENT REGISTRY
      ===================================================== */}

      <section className="gos-panel !p-0">

        <div
          className="
            border-b
            border-slate-200
            px-3
            py-2.5
          "
        >

          <h3 className="gos-section-title">
            Client Overview
          </h3>


          <p
            className="
              mt-0.5
              text-[9px]
              text-slate-500
            "
          >
            Compact workspace, subscription, user and connection view.
          </p>

        </div>


        <div className="overflow-x-auto">

          <table
            className="
              w-full
              min-w-[1050px]
              border-collapse
            "
          >

            <thead>

              <tr
                className="
                  border-b
                  border-slate-200
                  bg-slate-50
                "
              >

                <TableHeader>
                  Client
                </TableHeader>

                <TableHeader>
                  Status
                </TableHeader>

                <TableHeader>
                  Plan
                </TableHeader>

                <TableHeader>
                  Subscription
                </TableHeader>

                <TableHeader>
                  Users
                </TableHeader>

                <TableHeader>
                  Integrations
                </TableHeader>

              </tr>

            </thead>


            <tbody>

              {clients.map(
                client => (

                  <tr

                    key={
                      `${client.workspaceId}:${client.brandId}`
                    }

                    className="
                      border-b
                      border-slate-100
                      last:border-0
                      hover:bg-slate-50/70
                    "
                  >


                    <td className="px-3 py-2.5">

                      <div
                        className="
                          text-[10px]
                          font-semibold
                          text-slate-900
                        "
                      >
                        {client.name}
                      </div>


                      <div
                        className="
                          mt-0.5
                          font-mono
                          text-[8px]
                          text-slate-500
                        "
                      >
                        {client.workspaceId}
                        {' · '}
                        {client.brandId}
                      </div>

                    </td>


                    <td className="px-3 py-2.5">

                      <SimpleStatusBadge
                        value={
                          client.status
                        }
                      />

                    </td>


                    <td
                      className="
                        px-3
                        py-2.5
                        text-[10px]
                        font-semibold
                        text-slate-800
                      "
                    >
                      {client.planName
                        ||
                        'No Plan'}
                    </td>


                    <td className="px-3 py-2.5">

                      {client.subscriptionStatus

                        ? (
                          <SimpleStatusBadge
                            value={
                              client.subscriptionStatus
                            }
                          />
                        )

                        : (
                          <span
                            className="
                              inline-flex
                              rounded-full
                              border
                              border-amber-200
                              bg-amber-50
                              px-2
                              py-0.5
                              text-[8px]
                              font-semibold
                              text-amber-700
                            "
                          >
                            No Subscription
                          </span>
                        )
                      }

                    </td>


                    <td
                      className="
                        px-3
                        py-2.5
                        text-[10px]
                        font-semibold
                        text-slate-800
                      "
                    >
                      {client.activeUsers}
                      {' / '}
                      {client.users}
                    </td>


                    <td
                      className="
                        px-3
                        py-2.5
                        text-[10px]
                        font-semibold
                        text-slate-800
                      "
                    >
                      {client.connectedIntegrations}
                      {' / '}
                      {client.integrations}
                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        </div>

      </section>


      {/* =====================================================
          COMMERCIAL + INFRASTRUCTURE
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-3

          xl:grid-cols-2
        "
      >


        {/* ===================================================
            COMMERCIAL
        =================================================== */}

        <section className="gos-panel !p-3.5">

          <SectionHeading
            icon={
              CreditCard
            }
            title="Commercial Entitlement"
            description="Current subscription and plan-assignment coverage."
          />


          <div
            className="
              mt-3
              grid
              grid-cols-2
              gap-2
            "
          >

            <ValueBox
              label="Subscribed Clients"
              value={
                formatNumber(
                  commercial.subscribedClients
                )
              }
              tone="green"
            />


            <ValueBox
              label="Without Subscription"
              value={
                formatNumber(
                  commercial.clientsWithoutSubscription
                )
              }
              tone={
                commercial.clientsWithoutSubscription >
                  0
                  ? 'amber'
                  : 'default'
              }
            />


            <ValueBox
              label="Assigned Clients"
              value={
                formatNumber(
                  commercial.assignedClients
                )
              }
            />


            <ValueBox
              label="Unassigned Plans"
              value={
                formatNumber(
                  commercial.unassignedPlans
                )
              }
            />

          </div>

        </section>


        {/* ===================================================
            INFRASTRUCTURE
        =================================================== */}

        <section className="gos-panel !p-3.5">

          <SectionHeading
            icon={
              Server
            }
            title="Infrastructure"
            description="Lightweight system readiness from the Admin System registry."
          />


          <div className="mt-3 space-y-2">

            <InfrastructureRow
              label="Control Plane"
              value={`${infrastructure.controlPlaneTables} / ${infrastructure.controlPlaneRequiredTables}`}
              ready={
                infrastructure.controlPlaneReady
              }
            />


            <InfrastructureRow
              label="Data Plane"
              value={`${infrastructure.dataPlaneTables} / ${infrastructure.dataPlaneRequiredTables}`}
              ready={
                infrastructure.dataPlaneReady
              }
            />


            <InfrastructureRow
              label="Project"
              value={
                infrastructure.projectId
              }
              ready
              neutral
            />


            <InfrastructureRow
              label="BigQuery Region"
              value={
                infrastructure.location
              }
              ready
              neutral
            />


            <InfrastructureRow
              label="Environment"
              value={
                formatLabel(
                  infrastructure.environment
                )
              }
              ready
              neutral
            />

          </div>

        </section>

      </section>


      {/* =====================================================
          SOURCE
      ===================================================== */}

      <section
        className="
          rounded-[10px]
          border
          border-violet-200
          bg-violet-50
          px-3
          py-2.5
        "
      >

        <div
          className="
            flex
            items-start
            gap-2
          "
        >

          <ShieldCheck
            size={14}
            className="
              mt-0.5
              shrink-0
              text-violet-600
            "
          />


          <div>

            <p
              className="
                text-[9px]
                font-semibold
                text-violet-800
              "
            >
              Canonical Admin aggregation
            </p>


            <p
              className="
                mt-0.5
                text-[8px]
                leading-4
                text-violet-700
              "
            >
              Overview does not maintain independent business state. It aggregates the canonical Clients, Plans, Modules, Users, Integrations, Data Health, Sync History and System readers.
            </p>


            {data?.meta?.durationMs !==
              undefined && (

              <p
                className="
                  mt-1
                  text-[8px]
                  text-violet-500
                "
              >
                API runtime: {formatNumber(
                  data.meta.durationMs
                )} ms
              </p>

            )}

          </div>

        </div>

      </section>

    </div>

  );

}


// ============================================================
// METRIC CARD
// ============================================================

function MetricCard({

  icon:
    Icon,

  label,

  value,

  detail,

  tone =
    'default',

}: {

  icon:
    any;

  label:
    string;

  value:
    string |
    number;

  detail:
    string;

  tone?:
    | 'default'
    | 'green'
    | 'amber'
    | 'red';

}) {

  const valueClass =

    tone ===
      'green'

      ? 'text-emerald-700'

      : tone ===
          'amber'

        ? 'text-amber-700'

        : tone ===
            'red'

          ? 'text-red-700'

          : 'text-slate-950';


  return (

    <div
      className="
        gos-card
        min-h-[84px]
        px-3
        py-2.5
      "
    >

      <div
        className="
          flex
          items-center
          justify-between
          gap-2
        "
      >

        <p className="gos-label">
          {label}
        </p>


        <Icon
          size={13}
          className="text-slate-400"
        />

      </div>


      <p
        className={`
          mt-1.5
          truncate
          text-[18px]
          font-semibold
          tracking-[-0.03em]
          ${valueClass}
        `}
      >
        {value}
      </p>


      <p
        className="
          mt-0.5
          truncate
          text-[8px]
          text-slate-500
        "
        title={
          detail
        }
      >
        {detail}
      </p>

    </div>

  );

}


// ============================================================
// ALERT ROW
// ============================================================

function AlertRow({

  alert,

}: {

  alert:
    AdminOverviewAlert;

}) {

  const critical =
    alert.severity ===
    'critical';


  const attention =
    alert.severity ===
    'attention';


  const cls =
    critical

      ? 'border-red-100 bg-red-50/70'

      : attention

        ? 'border-amber-100 bg-amber-50/70'

        : 'border-emerald-100 bg-emerald-50/70';


  const iconClass =
    critical

      ? 'text-red-600'

      : attention

        ? 'text-amber-600'

        : 'text-emerald-600';


  const titleClass =
    critical

      ? 'text-red-800'

      : attention

        ? 'text-amber-800'

        : 'text-emerald-800';


  const Icon =
    critical
      ? XCircle
      : attention
        ? AlertTriangle
        : CheckCircle2;


  return (

    <div
      className={`
        flex
        items-start
        gap-2.5
        border-b
        px-3
        py-3
        last:border-0
        ${cls}
      `}
    >

      <Icon
        size={14}
        className={`
          mt-0.5
          shrink-0
          ${iconClass}
        `}
      />


      <div>

        <p
          className={`
            text-[9px]
            font-semibold
            ${titleClass}
          `}
        >
          {alert.title}
        </p>


        <p
          className="
            mt-0.5
            text-[8px]
            leading-4
            text-slate-600
          "
        >
          {alert.detail}
        </p>

      </div>

    </div>

  );

}


// ============================================================
// STATUS TILE
// ============================================================

function StatusTile({

  label,

  value,

  tone,

}: {

  label:
    string;

  value:
    number;

  tone:
    | 'green'
    | 'amber'
    | 'red'
    | 'slate';

}) {

  const cls =
    tone ===
      'green'

      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'

      : tone ===
          'amber'

        ? 'border-amber-200 bg-amber-50 text-amber-700'

        : tone ===
            'red'

          ? 'border-red-200 bg-red-50 text-red-700'

          : 'border-slate-200 bg-slate-50 text-slate-600';


  return (

    <div
      className={`
        rounded-[9px]
        border
        px-3
        py-2.5
        ${cls}
      `}
    >

      <div
        className="
          text-[8px]
          font-semibold
          uppercase
          tracking-[0.04em]
        "
      >
        {label}
      </div>


      <div
        className="
          mt-1
          text-[17px]
          font-semibold
        "
      >
        {value}
      </div>

    </div>

  );

}


// ============================================================
// VALUE BOX
// ============================================================

function ValueBox({

  label,

  value,

  tone =
    'default',

}: {

  label:
    string;

  value:
    string;

  tone?:
    | 'default'
    | 'green'
    | 'amber'
    | 'red';

}) {

  const valueClass =
    tone ===
      'green'

      ? 'text-emerald-700'

      : tone ===
          'amber'

        ? 'text-amber-700'

        : tone ===
            'red'

          ? 'text-red-700'

          : 'text-slate-900';


  return (

    <div
      className="
        rounded-[8px]
        border
        border-slate-200
        bg-slate-50
        px-3
        py-2.5
      "
    >

      <div
        className="
          text-[8px]
          font-semibold
          uppercase
          tracking-[0.04em]
          text-slate-500
        "
      >
        {label}
      </div>


      <div
        className={`
          mt-1
          text-[15px]
          font-semibold
          ${valueClass}
        `}
      >
        {value}
      </div>

    </div>

  );

}


// ============================================================
// STATUS BADGE
// ============================================================

function SimpleStatusBadge({

  value,

}: {

  value:
    string |
    null;

}) {

  const normalized =
    normalize(
      value
    );


  if (
    normalized ===
    'active'
    ||
    normalized ===
    'connected'
    ||
    normalized ===
    'ready'
  ) {

    return (

      <span
        className="
          inline-flex
          rounded-full
          border
          border-emerald-200
          bg-emerald-50
          px-2
          py-0.5
          text-[8px]
          font-semibold
          text-emerald-700
        "
      >
        {formatLabelOrDash(
          value
        )}
      </span>

    );

  }


  if (
    normalized ===
      'suspended'
    ||
    normalized ===
      'failed'
    ||
    normalized ===
      'error'
  ) {

    return (

      <span
        className="
          inline-flex
          rounded-full
          border
          border-red-200
          bg-red-50
          px-2
          py-0.5
          text-[8px]
          font-semibold
          text-red-700
        "
      >
        {formatLabelOrDash(
          value
        )}
      </span>

    );

  }


  return (

    <span
      className="
        inline-flex
        rounded-full
        border
        border-amber-200
        bg-amber-50
        px-2
        py-0.5
        text-[8px]
        font-semibold
        text-amber-700
      "
    >
      {formatLabelOrDash(
        value
      )}
    </span>

  );

}


// ============================================================
// INFRASTRUCTURE ROW
// ============================================================

function InfrastructureRow({

  label,

  value,

  ready,

  neutral =
    false,

}: {

  label:
    string;

  value:
    string;

  ready:
    boolean;

  neutral?:
    boolean;

}) {

  return (

    <div
      className="
        flex
        min-h-[38px]
        items-center
        justify-between
        gap-3
        rounded-[8px]
        border
        border-slate-200
        bg-slate-50
        px-3
      "
    >

      <span
        className="
          text-[9px]
          text-slate-500
        "
      >
        {label}
      </span>


      <div
        className="
          flex
          items-center
          gap-2
        "
      >

        <span
          className="
            font-mono
            text-[8px]
            font-semibold
            text-slate-700
          "
        >
          {value}
        </span>


        {!neutral && (

          ready

            ? (
              <CheckCircle2
                size={12}
                className="text-emerald-600"
              />
            )

            : (
              <XCircle
                size={12}
                className="text-red-600"
              />
            )

        )}

      </div>

    </div>

  );

}


// ============================================================
// SECTION HEADING
// ============================================================

function SectionHeading({

  icon:
    Icon,

  title,

  description,

}: {

  icon:
    any;

  title:
    string;

  description:
    string;

}) {

  return (

    <div
      className="
        flex
        items-start
        gap-2.5
      "
    >

      <div
        className="
          flex
          h-8
          w-8
          shrink-0
          items-center
          justify-center
          rounded-[8px]
          bg-violet-50
          text-violet-600
        "
      >

        <Icon
          size={14}
        />

      </div>


      <div>

        <h3
          className="
            text-[12px]
            font-semibold
            text-slate-900
          "
        >
          {title}
        </h3>


        <p
          className="
            mt-0.5
            text-[9px]
            leading-4
            text-slate-500
          "
        >
          {description}
        </p>

      </div>

    </div>

  );

}


// ============================================================
// TABLE HEADER
// ============================================================

function TableHeader({

  children,

}: {

  children:
    ReactNode;

}) {

  return (

    <th
      className="
        h-8
        px-3
        text-left
        text-[8px]
        font-semibold
        uppercase
        tracking-[0.05em]
        text-slate-500
      "
    >
      {children}
    </th>

  );

}


// ============================================================
// HELPERS
// ============================================================

function normalize(
  value:
    string |
    null
) {

  return String(
    value
    ||
    ''
  )
    .trim()
    .toLowerCase();

}


function formatLabelOrDash(
  value:
    string |
    null
) {

  if (!value) {

    return '—';

  }


  return formatLabel(
    value
  );

}


function formatLabel(
  value:
    string
) {

  if (!value) {

    return '—';

  }


  return value
    .replace(
      /[_-]+/g,
      ' '
    )
    .split(
      ' '
    )
    .filter(
      Boolean
    )
    .map(
      word =>
        word
          .charAt(
            0
          )
          .toUpperCase()
        +
        word.slice(
          1
        )
    )
    .join(
      ' '
    );

}


function formatNumber(
  value:
    number
) {

  return new Intl.NumberFormat(
    'en-IN',
    {
      maximumFractionDigits:
        0,
    }
  ).format(
    value
  );

}