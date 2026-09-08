'use client';

import {
  AlertTriangle,
  Boxes,
  Building2,
  CheckCircle2,
  CreditCard,
  Database,
  Plug,
  Users,
} from 'lucide-react';

import {
  type AdminClient,
  useAdminStore,
} from './AdminStore';


// ============================================================
// TYPES
// ============================================================

type ClientHealth =
  | 'healthy'
  | 'attention'
  | 'setup';


// ============================================================
// MAIN
// ============================================================

export default function AdminOverview() {


  const {

    clients,

    plans,

    modules,

    users,

    integrations,

    getPlan,

    getClientModuleAccess,

    getClientOrderLimit,

    getClientUserCount,

    getClientIntegrationCount,

    getClientIntegrations,

    getIntegrationProvider,

  } =
    useAdminStore();


  // ==========================================================
  // CLIENT COUNTS
  // ==========================================================

  const activeClients =
    clients.filter(
      client =>
        client.status ===
        'active'
    ).length;


  const setupClients =
    clients.filter(
      client =>
        client.status ===
        'setup'
    ).length;


  const suspendedClients =
    clients.filter(
      client =>
        client.status ===
        'suspended'
    ).length;


  // ==========================================================
  // ORDER CAPACITY
  // ==========================================================

  const finiteOrderCapacity =
    clients.reduce(
      (
        total,
        client
      ) => {

        const limit =
          getClientOrderLimit(
            client
          );


        if (
          limit ===
          null
        ) {

          return total;

        }


        return (
          total
          +
          limit
        );

      },
      0
    );


  const unlimitedClients =
    clients.filter(
      client =>
        getClientOrderLimit(
          client
        ) ===
        null
    ).length;


  // ==========================================================
  // USER COUNTS
  // ==========================================================

  const clientUsers =
    users.filter(
      user =>
        user.scope ===
        'client'
    ).length;


  const platformUsers =
    users.filter(
      user =>
        user.scope ===
        'platform'
    ).length;


  // ==========================================================
  // INTEGRATION HEALTH
  // ==========================================================

  const healthyIntegrations =
    integrations.filter(
      integration =>

        integration.connectionStatus ===
          'connected'

        &&

        integration.dataStatus ===
          'ready'

        &&

        integration.syncEnabled

    ).length;


  const integrationIssues =
    integrations.filter(
      integration =>

        integration.connectionStatus !==
          'connected'

        ||

        integration.dataStatus !==
          'ready'

        ||

        !integration.syncEnabled

    ).length;


  const criticalIntegrations =
    integrations.filter(
      integration =>

        integration.connectionStatus ===
          'error'

        ||

        integration.connectionStatus ===
          'disconnected'

        ||

        integration.connectionStatus ===
          'suspended'

        ||

        integration.dataStatus ===
          'error'

    ).length;


  // ==========================================================
  // CLIENT HEALTH
  // ==========================================================

  function getClientHealth(
    client:
      AdminClient
  ):
    ClientHealth {


    if (
      client.status ===
        'setup'
    ) {

      return 'setup';

    }


    const clientIntegrations =
      getClientIntegrations(
        client.id
      );


    const hasIssue =
      clientIntegrations.some(
        integration =>

          integration.connectionStatus !==
            'connected'

          ||

          integration.dataStatus !==
            'ready'

          ||

          !integration.syncEnabled
      );


    if (
      client.status ===
        'suspended'
      ||
      hasIssue
    ) {

      return 'attention';

    }


    return 'healthy';

  }


  // ==========================================================
  // PLAN DISTRIBUTION
  // ==========================================================

  const planRows =
    plans.map(
      plan => {

        const assignedClients =
          clients.filter(
            client =>
              client.planId ===
              plan.id
          );


        return {

          plan,

          clientCount:
            assignedClients.length,

          finiteCapacity:
            assignedClients.reduce(
              (
                total,
                client
              ) => {

                const limit =
                  getClientOrderLimit(
                    client
                  );


                if (
                  limit ===
                  null
                ) {

                  return total;

                }


                return (
                  total
                  +
                  limit
                );

              },
              0
            ),

          unlimitedCount:
            assignedClients.filter(
              client =>
                getClientOrderLimit(
                  client
                ) ===
                null
            ).length,

        };

      }
    );


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="space-y-3">


      {/* =====================================================
          PRIMARY KPIS
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-2
          gap-2

          lg:grid-cols-3
          xl:grid-cols-6
        "
      >

        <MetricCard

          icon={
            Building2
          }

          label="Clients"

          value={
            clients.length
          }

          detail={`${activeClients} active`}

        />


        <MetricCard

          icon={
            Database
          }

          label="Order Capacity"

          value={
            formatNumber(
              finiteOrderCapacity
            )
          }

          detail={
            unlimitedClients >
              0

              ? `+ ${unlimitedClients} unlimited`

              : 'monthly orders'
          }

        />


        <MetricCard

          icon={
            Users
          }

          label="Users"

          value={
            clientUsers
          }

          detail={`${platformUsers} platform admin${platformUsers === 1 ? '' : 's'}`}

        />


        <MetricCard

          icon={
            Plug
          }

          label="Connections"

          value={
            integrations.length
          }

          detail={`${healthyIntegrations} healthy`}

        />


        <MetricCard

          icon={
            Boxes
          }

          label="Modules"

          value={
            modules.length
          }

          detail={`${modules.filter(module => module.status === 'active').length} active`}

        />


        <MetricCard

          icon={
            AlertTriangle
          }

          label="Data Issues"

          value={
            integrationIssues
          }

          detail={`${criticalIntegrations} critical`}

          tone={
            integrationIssues >
              0

              ? 'red'

              : 'green'
          }

        />

      </section>


      {/* =====================================================
          PLATFORM STATUS
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-3

          xl:grid-cols-[1.35fr_1fr]
        "
      >


        {/* ===================================================
            CLIENT STATUS
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
              Client Operations
            </h3>


            <p
              className="
                mt-0.5

                text-[9px]

                text-slate-500
              "
            >
              Workspace status, commercial allowance and operational health.
            </p>

          </div>


          <div className="overflow-x-auto">

            <table
              className="
                min-w-[900px]
                w-full

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
                    Plan
                  </TableHeader>

                  <TableHeader>
                    Health
                  </TableHeader>

                  <TableHeader>
                    Orders / Month
                  </TableHeader>

                  <TableHeader>
                    Modules
                  </TableHeader>

                  <TableHeader>
                    Users
                  </TableHeader>

                  <TableHeader>
                    Sources
                  </TableHeader>

                </tr>

              </thead>


              <tbody>

                {clients.map(
                  client => {

                    const plan =
                      getPlan(
                        client.planId
                      );


                    const enabledModules =
                      modules.filter(
                        module =>
                          getClientModuleAccess(
                            client,
                            module.id
                          ).enabled
                      ).length;


                    return (

                      <tr
                        key={
                          client.id
                        }

                        className="
                          border-b
                          border-slate-100

                          last:border-0

                          hover:bg-slate-50/70
                        "
                      >

                        <td className="px-3 py-2">

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

                              max-w-[220px]

                              truncate

                              text-[8px]

                              text-slate-500
                            "
                          >
                            {client.domain ||
                              client.slug}
                          </div>

                        </td>


                        <td
                          className="
                            px-3
                            py-2

                            text-[10px]
                            font-medium

                            text-slate-700
                          "
                        >
                          {plan?.name ||
                            'No Plan'}
                        </td>


                        <td className="px-3 py-2">

                          <ClientHealthBadge
                            health={
                              getClientHealth(
                                client
                              )
                            }
                          />

                        </td>


                        <td
                          className="
                            px-3
                            py-2

                            text-[10px]
                            font-semibold

                            text-slate-800
                          "
                        >
                          {formatOrderLimit(
                            getClientOrderLimit(
                              client
                            )
                          )}
                        </td>


                        <td
                          className="
                            px-3
                            py-2

                            text-[10px]
                            font-semibold

                            text-slate-800
                          "
                        >
                          {enabledModules}
                        </td>


                        <td
                          className="
                            px-3
                            py-2

                            text-[10px]
                            font-semibold

                            text-slate-800
                          "
                        >
                          {getClientUserCount(
                            client.id
                          )}
                        </td>


                        <td
                          className="
                            px-3
                            py-2

                            text-[10px]
                            font-semibold

                            text-slate-800
                          "
                        >
                          {getClientIntegrationCount(
                            client.id
                          )}
                        </td>

                      </tr>

                    );

                  }
                )}

              </tbody>

            </table>

          </div>

        </section>


        {/* ===================================================
            PLATFORM HEALTH
        =================================================== */}

        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Platform Status
          </h3>


          <div
            className="
              mt-3

              grid
              grid-cols-2
              gap-2
            "
          >

            <StatusTile

              icon={
                CheckCircle2
              }

              label="Active Clients"

              value={
                activeClients
              }

              tone="green"

            />


            <StatusTile

              icon={
                AlertTriangle
              }

              label="Setup Required"

              value={
                setupClients
              }

              tone={
                setupClients >
                  0

                  ? 'amber'

                  : 'green'
              }

            />


            <StatusTile

              icon={
                AlertTriangle
              }

              label="Suspended"

              value={
                suspendedClients
              }

              tone={
                suspendedClients >
                  0

                  ? 'red'

                  : 'green'
              }

            />


            <StatusTile

              icon={
                Database
              }

              label="Healthy Sources"

              value={
                healthyIntegrations
              }

              tone="green"

            />

          </div>


          <div
            className="
              mt-3

              rounded-[9px]

              border
              border-slate-200

              bg-slate-50

              px-3
              py-2.5
            "
          >

            <div
              className="
                flex
                items-center
                justify-between
                gap-3
              "
            >

              <span
                className="
                  text-[9px]

                  text-slate-500
                "
              >
                Operationally healthy sources
              </span>


              <span
                className="
                  text-[10px]
                  font-semibold

                  text-slate-800
                "
              >
                {healthyIntegrations}
                {' / '}
                {integrations.length}
              </span>

            </div>


            <div
              className="
                mt-2

                h-2

                overflow-hidden

                rounded-full

                bg-slate-200
              "
            >

              <div

                className="
                  h-full

                  rounded-full

                  bg-emerald-500
                "

                style={{
                  width:
                    integrations.length ===
                      0

                      ? '0%'

                      : `${Math.round(
                          (
                            healthyIntegrations
                            /
                            integrations.length
                          )
                          *
                          100
                        )}%`,
                }}

              />

            </div>

          </div>

        </section>

      </section>


      {/* =====================================================
          PLAN DISTRIBUTION
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-3

          xl:grid-cols-[1.15fr_1fr]
        "
      >


        <section className="gos-panel !p-0">

          <div
            className="
              border-b
              border-slate-200

              px-3
              py-2.5
            "
          >

            <div
              className="
                flex
                items-center
                gap-2
              "
            >

              <CreditCard
                size={14}
                className="text-violet-600"
              />


              <h3 className="gos-section-title">
                Plan Distribution
              </h3>

            </div>

          </div>


          <div className="overflow-x-auto">

            <table
              className="
                min-w-[650px]
                w-full

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
                    Plan
                  </TableHeader>

                  <TableHeader>
                    Clients
                  </TableHeader>

                  <TableHeader>
                    Modules
                  </TableHeader>

                  <TableHeader>
                    User Limit
                  </TableHeader>

                  <TableHeader>
                    Capacity
                  </TableHeader>

                </tr>

              </thead>


              <tbody>

                {planRows.map(
                  row => (

                    <tr
                      key={
                        row.plan.id
                      }

                      className="
                        border-b
                        border-slate-100

                        last:border-0
                      "
                    >

                      <td className="px-3 py-2">

                        <div
                          className="
                            text-[10px]
                            font-semibold

                            text-slate-900
                          "
                        >
                          {row.plan.name}
                        </div>


                        <div
                          className="
                            mt-0.5

                            max-w-[250px]

                            truncate

                            text-[8px]

                            text-slate-500
                          "
                        >
                          {row.plan.description}
                        </div>

                      </td>


                      <td
                        className="
                          px-3
                          py-2

                          text-[10px]
                          font-semibold

                          text-slate-800
                        "
                      >
                        {row.clientCount}
                      </td>


                      <td
                        className="
                          px-3
                          py-2

                          text-[10px]
                          font-semibold

                          text-slate-800
                        "
                      >
                        {row.plan.modules.length}
                      </td>


                      <td
                        className="
                          px-3
                          py-2

                          text-[10px]

                          text-slate-700
                        "
                      >
                        {row.plan.maxUsers ===
                          null

                          ? 'Unlimited'

                          : formatNumber(
                              row.plan.maxUsers
                            )
                        }
                      </td>


                      <td
                        className="
                          px-3
                          py-2

                          text-[10px]
                          font-semibold

                          text-slate-800
                        "
                      >
                        {row.unlimitedCount >
                          0

                          ? `${formatNumber(
                              row.finiteCapacity
                            )} + unlimited`

                          : formatNumber(
                              row.finiteCapacity
                            )
                        }
                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        </section>


        {/* ===================================================
            SOURCE STATUS
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
              Source Status
            </h3>


            <p
              className="
                mt-0.5

                text-[9px]

                text-slate-500
              "
            >
              Current connection and processing status by source.
            </p>

          </div>


          <div>

            {integrations.map(
              integration => {

                const provider =
                  getIntegrationProvider(
                    integration.providerId
                  );


                const client =
                  clients.find(
                    item =>
                      item.id ===
                      integration.clientId
                  );


                const healthy =

                  integration.connectionStatus ===
                    'connected'

                  &&

                  integration.dataStatus ===
                    'ready'

                  &&

                  integration.syncEnabled;


                return (

                  <div

                    key={
                      integration.id
                    }

                    className="
                      flex
                      items-center
                      justify-between
                      gap-3

                      border-b
                      border-slate-100

                      px-3
                      py-2.5

                      last:border-0
                    "
                  >

                    <div
                      className="
                        flex
                        min-w-0
                        items-center
                        gap-2.5
                      "
                    >

                      <div
                        className="
                          flex
                          h-7
                          w-7
                          shrink-0
                          items-center
                          justify-center

                          rounded-[7px]

                          bg-violet-50

                          text-violet-600
                        "
                      >

                        <Plug
                          size={13}
                        />

                      </div>


                      <div className="min-w-0">

                        <div
                          className="
                            truncate

                            text-[10px]
                            font-semibold

                            text-slate-900
                          "
                        >
                          {provider?.name ||
                            integration.providerId}
                        </div>


                        <div
                          className="
                            mt-0.5

                            truncate

                            text-[8px]

                            text-slate-500
                          "
                        >
                          {client?.name ||
                            integration.clientId}
                        </div>

                      </div>

                    </div>


                    <span
                      className={`
                        shrink-0

                        rounded-full

                        border

                        px-2
                        py-0.5

                        text-[8px]
                        font-semibold

                        ${
                          healthy

                            ? `
                              border-emerald-200
                              bg-emerald-50
                              text-emerald-700
                            `

                            : `
                              border-amber-200
                              bg-amber-50
                              text-amber-700
                            `
                        }
                      `}
                    >
                      {healthy
                        ? 'Healthy'
                        : 'Attention'
                      }
                    </span>

                  </div>

                );

              }
            )}

          </div>

        </section>

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
    'default'
    |
    'green'
    |
    'red';

}) {


  const valueClass =

    tone ===
      'green'

      ? 'text-emerald-700'

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

          text-[8px]

          text-slate-500
        "
      >
        {detail}
      </p>

    </div>

  );

}


// ============================================================
// STATUS TILE
// ============================================================

function StatusTile({

  icon:
    Icon,

  label,

  value,

  tone,

}: {

  icon:
    any;

  label:
    string;

  value:
    number;

  tone:
    'green'
    |
    'amber'
    |
    'red';

}) {


  const cls =

    tone ===
      'green'

      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'

      : tone ===
          'amber'

        ? 'border-amber-200 bg-amber-50 text-amber-700'

        : 'border-red-200 bg-red-50 text-red-700';


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
          flex
          items-center
          justify-between
          gap-2
        "
      >

        <span
          className="
            text-[9px]
            font-semibold
          "
        >
          {label}
        </span>


        <Icon
          size={13}
        />

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
// CLIENT HEALTH
// ============================================================

function ClientHealthBadge({

  health,

}: {

  health:
    ClientHealth;

}) {


  const config =

    health ===
      'healthy'

      ? {
          label:
            'Healthy',

          cls:
            'border-emerald-200 bg-emerald-50 text-emerald-700',
        }

      : health ===
          'setup'

        ? {
            label:
              'Setup Required',

            cls:
              'border-blue-200 bg-blue-50 text-blue-700',
          }

        : {
            label:
              'Attention',

            cls:
              'border-amber-200 bg-amber-50 text-amber-700',
          };


  return (

    <span
      className={`
        inline-flex

        rounded-full

        border

        px-2
        py-0.5

        text-[8px]
        font-semibold

        ${config.cls}
      `}
    >
      {config.label}
    </span>

  );

}


// ============================================================
// TABLE HEADER
// ============================================================

function TableHeader({

  children,

}: {

  children:
    React.ReactNode;

}) {

  return (

    <th
      className="
        h-8

        px-3

        text-left
        text-[9px]
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


function formatOrderLimit(
  value:
    number |
    null
) {

  if (
    value ===
    null
  ) {

    return 'Unlimited';

  }


  return formatNumber(
    value
  );

}