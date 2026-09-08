'use client';

import {
  type ReactNode,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Database,
  PauseCircle,
  RefreshCw,
  Search,
  ServerCog,
  XCircle,
} from 'lucide-react';

import {
  type AdminClientIntegration,
  type IntegrationConnectionStatus,
  type IntegrationDataStatus,
  useAdminStore,
} from './AdminStore';


// ============================================================
// FILTER TYPES
// ============================================================

type HealthFilter =
  | 'all'
  | 'healthy'
  | 'attention'
  | 'critical';


// ============================================================
// MAIN
// ============================================================

export default function AdminDataOperations() {


  const {
    integrations,
    setIntegrations,
    integrationProviders,
    clients,
    getClient,
    getIntegrationProvider,
  } =
    useAdminStore();


  // ==========================================================
  // LOCAL UI
  // ==========================================================

  const [
    search,
    setSearch,
  ] =
    useState(
      ''
    );


  const [
    clientFilter,
    setClientFilter,
  ] =
    useState(
      'all'
    );


  const [
    providerFilter,
    setProviderFilter,
  ] =
    useState(
      'all'
    );


  const [
    healthFilter,
    setHealthFilter,
  ] =
    useState<HealthFilter>(
      'all'
    );


  const [
    selectedIntegrationId,
    setSelectedIntegrationId,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  // ==========================================================
  // DERIVED HEALTH
  // ==========================================================

  function getHealth(
    integration:
      AdminClientIntegration
  ):
    'healthy'
    |
    'attention'
    |
    'critical' {


    if (
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
    ) {

      return 'critical';

    }


    if (
      integration.connectionStatus !==
        'connected'
      ||
      integration.dataStatus !==
        'ready'
      ||
      !integration.syncEnabled
    ) {

      return 'attention';

    }


    return 'healthy';

  }


  // ==========================================================
  // FILTERED ROWS
  // ==========================================================

  const filteredIntegrations =
    useMemo(
      () => {

        const query =
          search
            .trim()
            .toLowerCase();


        return integrations
          .filter(
            integration => {


              if (
                clientFilter !==
                  'all'
                &&
                integration.clientId !==
                  clientFilter
              ) {

                return false;

              }


              if (
                providerFilter !==
                  'all'
                &&
                integration.providerId !==
                  providerFilter
              ) {

                return false;

              }


              const health =
                getHealth(
                  integration
                );


              if (
                healthFilter !==
                  'all'
                &&
                health !==
                  healthFilter
              ) {

                return false;

              }


              if (!query) {

                return true;

              }


              const client =
                getClient(
                  integration.clientId
                );


              const provider =
                getIntegrationProvider(
                  integration.providerId
                );


              return (

                integration.accountName
                  .toLowerCase()
                  .includes(
                    query
                  )

                ||

                integration.externalAccountId
                  .toLowerCase()
                  .includes(
                    query
                  )

                ||

                (
                  client?.name ||
                  ''
                )
                  .toLowerCase()
                  .includes(
                    query
                  )

                ||

                (
                  provider?.name ||
                  ''
                )
                  .toLowerCase()
                  .includes(
                    query
                  )

              );

            }
          )
          .sort(
            (
              a,
              b
            ) => {

              const rank = {
                critical:
                  0,
                attention:
                  1,
                healthy:
                  2,
              };


              return (
                rank[
                  getHealth(
                    a
                  )
                ]
                -
                rank[
                  getHealth(
                    b
                  )
                ]
              );

            }
          );

      },
      [
        integrations,
        clients,
        search,
        clientFilter,
        providerFilter,
        healthFilter,
      ]
    );


  // ==========================================================
  // GLOBAL COUNTS
  // ==========================================================

  const healthyCount =
    integrations.filter(
      integration =>
        getHealth(
          integration
        ) ===
        'healthy'
    ).length;


  const attentionCount =
    integrations.filter(
      integration =>
        getHealth(
          integration
        ) ===
        'attention'
    ).length;


  const criticalCount =
    integrations.filter(
      integration =>
        getHealth(
          integration
        ) ===
        'critical'
    ).length;


  const readyCount =
    integrations.filter(
      integration =>
        integration.dataStatus ===
        'ready'
    ).length;


  // ==========================================================
  // SELECTED
  // ==========================================================

  const selectedIntegration =
    integrations.find(
      integration =>
        integration.id ===
        selectedIntegrationId
    )
    ||
    null;


  // ==========================================================
  // UPDATE
  // ==========================================================

  function updateIntegration(
    updated:
      AdminClientIntegration
  ) {

    setIntegrations(
      previous =>
        previous.map(
          integration =>

            integration.id ===
              updated.id

              ? updated

              : integration
        )
    );

  }


  // ==========================================================
  // DETAIL
  // ==========================================================

  if (
    selectedIntegration
  ) {

    return (

      <OperationDetail

        integration={
          selectedIntegration
        }

        health={
          getHealth(
            selectedIntegration
          )
        }

        onBack={() =>
          setSelectedIntegrationId(
            null
          )
        }

        onChange={
          updateIntegration
        }

      />

    );

  }


  // ==========================================================
  // LIST
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

          xl:flex-row
          xl:items-center
          xl:justify-between
        "
      >

        <div>

          <div
            className="
              flex
              items-center
              gap-2
            "
          >

            <ServerCog
              size={16}
              className="text-violet-600"
            />


            <h2
              className="
                text-[14px]
                font-semibold
                tracking-[-0.025em]

                text-slate-950
              "
            >
              Data Operations
            </h2>

          </div>


          <p
            className="
              mt-0.5

              text-[10px]

              text-slate-500
            "
          >
            Monitor source connections, sync state and data readiness across all clients.
          </p>

        </div>


        <div
          className="
            flex
            flex-col
            gap-2

            sm:flex-row
            sm:flex-wrap
          "
        >

          <div
            className="
              relative

              w-full

              sm:w-[220px]
            "
          >

            <Search
              size={14}
              className="
                absolute
                left-2.5
                top-1/2

                -translate-y-1/2

                text-slate-400
              "
            />


            <input

              value={
                search
              }

              onChange={
                event =>
                  setSearch(
                    event.target.value
                  )
              }

              placeholder="Search data operations"

              className="
                h-8
                w-full

                rounded-[8px]

                border
                border-slate-300

                bg-white

                pl-8
                pr-3

                text-[10px]

                outline-none

                focus:border-violet-400
                focus:ring-2
                focus:ring-violet-100
              "

            />

          </div>


          <select

            value={
              clientFilter
            }

            onChange={
              event =>
                setClientFilter(
                  event.target.value
                )
            }

            className="gos-input"
          >

            <option value="all">
              All Clients
            </option>


            {clients.map(
              client => (

                <option
                  key={
                    client.id
                  }
                  value={
                    client.id
                  }
                >
                  {client.name}
                </option>

              )
            )}

          </select>


          <select

            value={
              providerFilter
            }

            onChange={
              event =>
                setProviderFilter(
                  event.target.value
                )
            }

            className="gos-input"
          >

            <option value="all">
              All Providers
            </option>


            {integrationProviders.map(
              provider => (

                <option
                  key={
                    provider.id
                  }
                  value={
                    provider.id
                  }
                >
                  {provider.name}
                </option>

              )
            )}

          </select>


          <select

            value={
              healthFilter
            }

            onChange={
              event =>
                setHealthFilter(
                  event.target.value as HealthFilter
                )
            }

            className="gos-input"
          >

            <option value="all">
              All Health
            </option>

            <option value="critical">
              Critical
            </option>

            <option value="attention">
              Attention
            </option>

            <option value="healthy">
              Healthy
            </option>

          </select>

        </div>

      </section>


      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-2
          gap-2

          xl:grid-cols-5
        "
      >

        <SummaryCard
          label="Connections"
          value={
            integrations.length
          }
        />


        <SummaryCard
          label="Healthy"
          value={
            healthyCount
          }
          tone="green"
        />


        <SummaryCard
          label="Attention"
          value={
            attentionCount
          }
          tone="amber"
        />


        <SummaryCard
          label="Critical"
          value={
            criticalCount
          }
          tone="red"
        />


        <SummaryCard
          label="Data Ready"
          value={
            readyCount
          }
          tone="violet"
        />

      </section>


      {/* =====================================================
          OPERATION STATUS
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-3

          lg:grid-cols-3
        "
      >

        <HealthPanel
          title="Critical"
          count={
            criticalCount
          }
          description="Connection or data failures requiring intervention."
          tone="red"
          onClick={() =>
            setHealthFilter(
              'critical'
            )
          }
        />


        <HealthPanel
          title="Needs Attention"
          count={
            attentionCount
          }
          description="Setup, stale data or synchronization not fully ready."
          tone="amber"
          onClick={() =>
            setHealthFilter(
              'attention'
            )
          }
        />


        <HealthPanel
          title="Healthy"
          count={
            healthyCount
          }
          description="Connected, data ready and synchronization enabled."
          tone="green"
          onClick={() =>
            setHealthFilter(
              'healthy'
            )
          }
        />

      </section>


      {/* =====================================================
          OPERATIONS TABLE
      ===================================================== */}

      <section className="gos-panel !p-0">

        <div
          className="
            flex
            items-center
            justify-between
            gap-3

            border-b
            border-slate-200

            px-3
            py-2.5
          "
        >

          <div>

            <h3 className="gos-section-title">
              Source Operations
            </h3>


            <p
              className="
                mt-0.5

                text-[9px]

                text-slate-500
              "
            >
              {filteredIntegrations.length} connection{filteredIntegrations.length === 1 ? '' : 's'}
            </p>

          </div>


          {healthFilter !==
            'all' && (

            <button

              type="button"

              onClick={() =>
                setHealthFilter(
                  'all'
                )
              }

              className="
                text-[9px]
                font-semibold

                text-violet-600

                hover:text-violet-800
              "
            >
              Clear health filter
            </button>

          )}

        </div>


        <div className="overflow-x-auto">

          <table
            className="
              min-w-[1180px]
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
                  Source
                </TableHeader>

                <TableHeader>
                  Health
                </TableHeader>

                <TableHeader>
                  Connection
                </TableHeader>

                <TableHeader>
                  Data
                </TableHeader>

                <TableHeader>
                  Sync
                </TableHeader>

                <TableHeader>
                  Last Success
                </TableHeader>

                <TableHeader>
                  Account
                </TableHeader>

                <TableHeader align="right">
                  Action
                </TableHeader>

              </tr>

            </thead>


            <tbody>

              {filteredIntegrations.map(
                integration => {

                  const client =
                    getClient(
                      integration.clientId
                    );


                  const provider =
                    getIntegrationProvider(
                      integration.providerId
                    );


                  const health =
                    getHealth(
                      integration
                    );


                  return (

                    <tr
                      key={
                        integration.id
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
                          {client?.name ||
                            'Unknown Client'}
                        </div>


                        <div
                          className="
                            mt-0.5

                            text-[8px]

                            text-slate-500
                          "
                        >
                          {client?.domain ||
                            client?.id ||
                            'Unknown'}
                        </div>

                      </td>


                      <td className="px-3 py-2">

                        <div
                          className="
                            flex
                            items-center
                            gap-2
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

                            <Database
                              size={13}
                            />

                          </div>


                          <div>

                            <div
                              className="
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

                                text-[8px]

                                text-slate-500
                              "
                            >
                              {integration.accountName}
                            </div>

                          </div>

                        </div>

                      </td>


                      <td className="px-3 py-2">

                        <HealthBadge
                          health={
                            health
                          }
                        />

                      </td>


                      <td className="px-3 py-2">

                        <ConnectionBadge
                          status={
                            integration.connectionStatus
                          }
                        />

                      </td>


                      <td className="px-3 py-2">

                        <DataBadge
                          status={
                            integration.dataStatus
                          }
                        />

                      </td>


                      <td className="px-3 py-2">

                        <SyncBadge
                          enabled={
                            integration.syncEnabled
                          }
                        />

                      </td>


                      <td
                        className="
                          px-3
                          py-2

                          text-[9px]

                          text-slate-500
                        "
                      >
                        {integration.lastSuccessfulSyncAt ||
                          'Never'}
                      </td>


                      <td
                        className="
                          max-w-[220px]

                          truncate

                          px-3
                          py-2

                          text-[9px]

                          text-slate-500
                        "
                      >
                        {integration.externalAccountId ||
                          'Not configured'}
                      </td>


                      <td className="px-3 py-2 text-right">

                        <button

                          type="button"

                          onClick={() =>
                            setSelectedIntegrationId(
                              integration.id
                            )
                          }

                          className="
                            inline-flex
                            h-7
                            items-center
                            gap-1

                            rounded-[7px]

                            border
                            border-slate-200

                            bg-white

                            px-2.5

                            text-[9px]
                            font-semibold

                            text-slate-700

                            hover:bg-slate-50
                          "
                        >

                          Inspect

                          <ChevronRight
                            size={12}
                          />

                        </button>

                      </td>

                    </tr>

                  );

                }
              )}


              {filteredIntegrations.length ===
                0 && (

                <tr>

                  <td
                    colSpan={
                      9
                    }

                    className="
                      px-4
                      py-12

                      text-center

                      text-[10px]

                      text-slate-500
                    "
                  >
                    No data operations match the selected filters.
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </section>

    </div>

  );

}


// ============================================================
// OPERATION DETAIL
// ============================================================

function OperationDetail({

  integration,

  health,

  onBack,

  onChange,

}: {

  integration:
    AdminClientIntegration;

  health:
    'healthy'
    |
    'attention'
    |
    'critical';

  onBack:
    () => void;

  onChange:
    (
      integration:
        AdminClientIntegration
    ) => void;

}) {


  const {
    getClient,
    getIntegrationProvider,
  } =
    useAdminStore();


  const client =
    getClient(
      integration.clientId
    );


  const provider =
    getIntegrationProvider(
      integration.providerId
    );


  return (

    <div className="space-y-3">


      {/* =====================================================
          HEADER
      ===================================================== */}

      <section className="gos-panel !p-3">

        <div
          className="
            flex
            flex-col
            gap-3

            md:flex-row
            md:items-center
            md:justify-between
          "
        >

          <div
            className="
              flex
              items-center
              gap-3
            "
          >

            <button

              type="button"

              onClick={
                onBack
              }

              className="
                flex
                h-8
                w-8
                shrink-0
                items-center
                justify-center

                rounded-[8px]

                border
                border-slate-200

                bg-white

                text-slate-500
              "
            >

              <ArrowLeft
                size={14}
              />

            </button>


            <div
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center

                rounded-[9px]

                bg-violet-50

                text-violet-600
              "
            >

              <ServerCog
                size={17}
              />

            </div>


            <div>

              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  gap-2
                "
              >

                <h2
                  className="
                    text-[15px]
                    font-semibold

                    text-slate-950
                  "
                >
                  {provider?.name ||
                    integration.providerId}
                </h2>


                <HealthBadge
                  health={
                    health
                  }
                />

              </div>


              <p
                className="
                  mt-0.5

                  text-[9px]

                  text-slate-500
                "
              >
                {client?.name ||
                  'Unknown Client'}
                {' · '}
                {integration.accountName}
              </p>

            </div>

          </div>


          <div
            className="
              flex
              flex-wrap
              gap-2
            "
          >

            <button

              type="button"

              onClick={() =>
                onChange({

                  ...integration,

                  syncEnabled:
                    !integration.syncEnabled,

                })
              }

              className="
                h-8

                rounded-[8px]

                border
                border-slate-200

                bg-white

                px-3

                text-[9px]
                font-semibold

                text-slate-700
              "
            >
              {integration.syncEnabled
                ? 'Pause Sync'
                : 'Enable Sync'
              }
            </button>

          </div>

        </div>

      </section>


      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-2
          gap-2

          md:grid-cols-4
        "
      >

        <SummaryCard
          label="Health"
          value={
            capitalize(
              health
            )
          }
          tone={
            health ===
              'healthy'

              ? 'green'

              : health ===
                  'attention'

                ? 'amber'

                : 'red'
          }
        />


        <SummaryCard
          label="Connection"
          value={
            formatConnectionStatus(
              integration.connectionStatus
            )
          }
        />


        <SummaryCard
          label="Data"
          value={
            formatDataStatus(
              integration.dataStatus
            )
          }
        />


        <SummaryCard
          label="Sync"
          value={
            integration.syncEnabled
              ? 'Enabled'
              : 'Off'
          }
        />

      </section>


      {/* =====================================================
          OPERATION CONTROL
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <h3 className="gos-section-title">
          Operation Control
        </h3>


        <div
          className="
            mt-3

            grid
            grid-cols-1
            gap-3

            md:grid-cols-2
          "
        >

          <FormField
            label="Connection Status"
          >

            <select

              value={
                integration.connectionStatus
              }

              onChange={
                event =>
                  onChange({

                    ...integration,

                    connectionStatus:
                      event.target.value as IntegrationConnectionStatus,

                  })
              }

              className="gos-input w-full"

            >

              <option value="connected">
                Connected
              </option>

              <option value="setup_required">
                Setup Required
              </option>

              <option value="configuring">
                Configuring
              </option>

              <option value="error">
                Error
              </option>

              <option value="disconnected">
                Disconnected
              </option>

              <option value="suspended">
                Suspended
              </option>

            </select>

          </FormField>


          <FormField
            label="Data Status"
          >

            <select

              value={
                integration.dataStatus
              }

              onChange={
                event =>
                  onChange({

                    ...integration,

                    dataStatus:
                      event.target.value as IntegrationDataStatus,

                  })
              }

              className="gos-input w-full"

            >

              <option value="ready">
                Ready
              </option>

              <option value="syncing">
                Syncing
              </option>

              <option value="stale">
                Stale
              </option>

              <option value="error">
                Error
              </option>

              <option value="not_ready">
                Not Ready
              </option>

            </select>

          </FormField>

        </div>

      </section>


      {/* =====================================================
          CONNECTION DETAILS
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-3

          lg:grid-cols-2
        "
      >

        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Connection
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Client"
              value={
                client?.name ||
                'Unknown'
              }
            />


            <ValueRow
              label="Provider"
              value={
                provider?.name ||
                integration.providerId
              }
            />


            <ValueRow
              label="Account"
              value={
                integration.accountName
              }
            />


            <ValueRow
              label="External ID"
              value={
                integration.externalAccountId ||
                'Not configured'
              }
            />

          </div>

        </section>


        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Sync State
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Synchronization"
              value={
                integration.syncEnabled
                  ? 'Enabled'
                  : 'Off'
              }
            />


            <ValueRow
              label="Last Successful Sync"
              value={
                integration.lastSuccessfulSyncAt ||
                'Never'
              }
            />


            <ValueRow
              label="Created"
              value={
                integration.createdAt
              }
            />


            <ValueRow
              label="Operational Health"
              value={
                capitalize(
                  health
                )
              }
            />

          </div>

        </section>

      </section>


      {/* =====================================================
          FUTURE BACKEND NOTE
      ===================================================== */}

      <section
        className="
          rounded-[10px]

          border
          border-slate-200

          bg-slate-50

          px-3
          py-3
        "
      >

        <div
          className="
            flex
            items-start
            gap-2.5
          "
        >

          <RefreshCw
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
                text-[10px]
                font-semibold

                text-slate-800
              "
            >
              Backend sync telemetry will plug into this layer
            </p>


            <p
              className="
                mt-1

                text-[9px]
                leading-4

                text-slate-500
              "
            >
              Later the connection status, freshness, last sync, failures and retries will come from your actual Growth OS sync-control tables rather than frontend state.
            </p>

          </div>

        </div>

      </section>

    </div>

  );

}


// ============================================================
// HEALTH PANEL
// ============================================================

function HealthPanel({

  title,

  count,

  description,

  tone,

  onClick,

}: {

  title:
    string;

  count:
    number;

  description:
    string;

  tone:
    'green'
    |
    'amber'
    |
    'red';

  onClick:
    () => void;

}) {


  const classes =
    tone ===
      'green'

      ? 'border-emerald-200 bg-emerald-50'

      : tone ===
          'amber'

        ? 'border-amber-200 bg-amber-50'

        : 'border-red-200 bg-red-50';


  return (

    <button

      type="button"

      onClick={
        onClick
      }

      className={`
        rounded-[10px]

        border

        p-3

        text-left

        transition

        hover:-translate-y-[1px]

        ${classes}
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
            text-[10px]
            font-semibold

            text-slate-700
          "
        >
          {title}
        </span>


        <span
          className="
            text-[18px]
            font-semibold
            tracking-[-0.03em]

            text-slate-950
          "
        >
          {count}
        </span>

      </div>


      <p
        className="
          mt-1

          text-[8px]
          leading-4

          text-slate-500
        "
      >
        {description}
      </p>

    </button>

  );

}


// ============================================================
// SUMMARY
// ============================================================

function SummaryCard({

  label,

  value,

  tone =
    'default',

}: {

  label:
    string;

  value:
    string |
    number;

  tone?:
    'default'
    |
    'green'
    |
    'amber'
    |
    'red'
    |
    'violet';

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

          : tone ===
              'violet'

            ? 'text-violet-700'

            : 'text-slate-950';


  return (

    <div
      className="
        gos-card

        min-h-[66px]

        px-3
        py-2.5
      "
    >

      <p className="gos-label">
        {label}
      </p>


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

    </div>

  );

}


// ============================================================
// HEALTH BADGE
// ============================================================

function HealthBadge({

  health,

}: {

  health:
    'healthy'
    |
    'attention'
    |
    'critical';

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
          'attention'

        ? {
            label:
              'Attention',

            cls:
              'border-amber-200 bg-amber-50 text-amber-700',
          }

        : {
            label:
              'Critical',

            cls:
              'border-red-200 bg-red-50 text-red-700',
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
// CONNECTION BADGE
// ============================================================

function ConnectionBadge({

  status,

}: {

  status:
    IntegrationConnectionStatus;

}) {


  const good =
    status ===
      'connected';


  const warning =
    status ===
      'setup_required'
    ||
    status ===
      'configuring';


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

        ${
          good

            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'

            : warning

              ? 'border-amber-200 bg-amber-50 text-amber-700'

              : 'border-red-200 bg-red-50 text-red-700'
        }
      `}
    >
      {formatConnectionStatus(
        status
      )}
    </span>

  );

}


// ============================================================
// DATA BADGE
// ============================================================

function DataBadge({

  status,

}: {

  status:
    IntegrationDataStatus;

}) {


  const good =
    status ===
      'ready';


  const warning =
    status ===
      'syncing'
    ||
    status ===
      'stale';


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

        ${
          good

            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'

            : warning

              ? 'border-amber-200 bg-amber-50 text-amber-700'

              : status ===
                  'error'

                ? 'border-red-200 bg-red-50 text-red-700'

                : 'border-slate-200 bg-slate-100 text-slate-600'
        }
      `}
    >
      {formatDataStatus(
        status
      )}
    </span>

  );

}


// ============================================================
// SYNC BADGE
// ============================================================

function SyncBadge({

  enabled,

}: {

  enabled:
    boolean;

}) {

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

        ${
          enabled

            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'

            : 'border-slate-200 bg-slate-100 text-slate-500'
        }
      `}
    >
      {enabled
        ? 'Enabled'
        : 'Off'
      }
    </span>

  );

}


// ============================================================
// VALUE ROW
// ============================================================

function ValueRow({

  label,

  value,

}: {

  label:
    string;

  value:
    string;

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


      <span
        className="
          max-w-[65%]

          truncate

          text-right
          text-[10px]
          font-semibold

          text-slate-800
        "
      >
        {value}
      </span>

    </div>

  );

}


// ============================================================
// FORM FIELD
// ============================================================

function FormField({

  label,

  children,

}: {

  label:
    string;

  children:
    ReactNode;

}) {

  return (

    <label className="block">

      <span
        className="
          mb-1.5
          block

          text-[9px]
          font-semibold
          uppercase
          tracking-[0.05em]

          text-slate-500
        "
      >
        {label}
      </span>


      {children}

    </label>

  );

}


// ============================================================
// TABLE HEADER
// ============================================================

function TableHeader({

  children,

  align =
    'left',

}: {

  children:
    ReactNode;

  align?:
    'left'
    |
    'right';

}) {

  return (

    <th
      className={`
        h-8

        px-3

        text-[9px]
        font-semibold
        uppercase
        tracking-[0.05em]

        text-slate-500

        ${
          align ===
            'right'

            ? 'text-right'

            : 'text-left'
        }
      `}
    >
      {children}
    </th>

  );

}


// ============================================================
// HELPERS
// ============================================================

function formatConnectionStatus(
  value:
    IntegrationConnectionStatus
) {

  const labels:
    Record<
      IntegrationConnectionStatus,
      string
    > = {

    connected:
      'Connected',

    setup_required:
      'Setup Required',

    configuring:
      'Configuring',

    error:
      'Error',

    disconnected:
      'Disconnected',

    suspended:
      'Suspended',

  };


  return labels[
    value
  ];

}


function formatDataStatus(
  value:
    IntegrationDataStatus
) {

  const labels:
    Record<
      IntegrationDataStatus,
      string
    > = {

    ready:
      'Ready',

    syncing:
      'Syncing',

    stale:
      'Stale',

    error:
      'Error',

    not_ready:
      'Not Ready',

  };


  return labels[
    value
  ];

}


function capitalize(
  value:
    string
) {

  return (
    value
      .charAt(
        0
      )
      .toUpperCase()
    +
    value.slice(
      1
    )
  );

}