'use client';

import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Plug,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';


// ============================================================
// TYPES
// ============================================================

type AdminIntegration = {

  connectionId:
    string;

  workspaceId:
    string;

  workspaceName:
    string | null;

  brandId:
    string;

  brandName:
    string | null;

  provider:
    string;

  connectionMode:
    string | null;

  ingestionAdapter:
    string | null;

  status:
    string;

  providerUserId:
    string | null;

  providerUserName:
    string | null;

  providerAccountId:
    string | null;

  providerAccountName:
    string | null;

  integrationAccountId:
    string | null;

  selectedAccountId:
    string | null;

  selectedAccountName:
    string | null;

  accountType:
    string | null;

  currency:
    string | null;

  timezone:
    string | null;

  connectedAt:
    string | null;

  updatedAt:
    string | null;

  lastVerifiedAt:
    string | null;

  lastSyncAt:
    string | null;

  accountSelectedAt:
    string | null;

  error:
    string | null;

};


type IntegrationsResponse = {

  ok:
    boolean;

  scope?:
    string;

  summary?: {

    total:
      number;

    connected:
      number;

    attention:
      number;

    disconnected:
      number;

    clients:
      number;

    providers:
      number;

  };

  integrations?:
    AdminIntegration[];

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


type ConnectionGroup =
  | 'connected'
  | 'attention'
  | 'disconnected';


type StatusFilter =
  | 'all'
  | ConnectionGroup;


// ============================================================
// MAIN
// ============================================================

export default function AdminIntegrations() {


  // ==========================================================
  // SERVER DATA
  // ==========================================================

  const [
    data,
    setData,
  ] =
    useState<IntegrationsResponse | null>(
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
  // FILTERS
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
    statusFilter,
    setStatusFilter,
  ] =
    useState<StatusFilter>(
      'all'
    );


  const [
    selectedConnectionId,
    setSelectedConnectionId,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  // ==========================================================
  // LOAD REAL ADMIN INTEGRATIONS
  // ==========================================================

  async function loadIntegrations() {

    setLoading(
      true
    );


    setError(
      null
    );


    try {

      const response =
        await fetch(
          '/api/admin/integrations',
          {

            cache:
              'no-store',

            credentials:
              'same-origin',

          }
        );


      const json:
        IntegrationsResponse =
          await response.json();


      if (
        !response.ok
        ||
        !json.ok
      ) {

        throw new Error(
          json.error
          ||
          'Unable to load Admin Integrations'
        );

      }


      setData(
        json
      );

    } catch (
      error: any
    ) {

      console.error(
        'ADMIN_INTEGRATIONS_UI_ERROR',
        error
      );


      setData(
        null
      );


      setError(
        String(
          error?.message
          ||
          'Unable to load Admin Integrations'
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

      loadIntegrations();

    },
    []
  );


  // ==========================================================
  // ROWS
  // ==========================================================

  const integrations =
    data?.integrations
    ||
    [];


  // ==========================================================
  // CLIENT FILTER OPTIONS
  // ==========================================================

  const clients =
    useMemo(
      () => {

        const map =
          new Map<
            string,
            string
          >();


        integrations.forEach(
          integration => {

            const value =
              getClientKey(
                integration
              );


            const label =
              getClientName(
                integration
              );


            map.set(
              value,
              label
            );

          }
        );


        return Array
          .from(
            map.entries()
          )
          .map(
            (
              [
                value,
                label,
              ]
            ) => ({

              value,

              label,

            })
          )
          .sort(
            (
              a,
              b
            ) =>
              a.label.localeCompare(
                b.label
              )
          );

      },
      [
        integrations,
      ]
    );


  // ==========================================================
  // PROVIDER FILTER OPTIONS
  // ==========================================================

  const providers =
    useMemo(
      () => {

        return Array
          .from(
            new Set(
              integrations
                .map(
                  integration =>
                    integration.provider
                )
                .filter(
                  Boolean
                )
            )
          )
          .sort();

      },
      [
        integrations,
      ]
    );


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


        return integrations.filter(
          integration => {


            // --------------------------------------------------
            // CLIENT
            // --------------------------------------------------

            if (
              clientFilter !==
                'all'
              &&
              getClientKey(
                integration
              ) !==
                clientFilter
            ) {

              return false;

            }


            // --------------------------------------------------
            // PROVIDER
            // --------------------------------------------------

            if (
              providerFilter !==
                'all'
              &&
              integration.provider !==
                providerFilter
            ) {

              return false;

            }


            // --------------------------------------------------
            // CONNECTION GROUP
            // --------------------------------------------------

            if (
              statusFilter !==
                'all'
              &&
              getConnectionGroup(
                integration
              ) !==
                statusFilter
            ) {

              return false;

            }


            // --------------------------------------------------
            // SEARCH
            // --------------------------------------------------

            if (!query) {

              return true;

            }


            const haystack =
              [

                integration.connectionId,
                integration.workspaceId,
                integration.workspaceName,
                integration.brandId,
                integration.brandName,
                integration.provider,
                integration.status,
                integration.connectionMode,
                integration.ingestionAdapter,
                integration.providerUserId,
                integration.providerUserName,
                integration.providerAccountId,
                integration.providerAccountName,
                integration.integrationAccountId,
                integration.selectedAccountId,
                integration.selectedAccountName,
                integration.accountType,
                integration.currency,
                integration.timezone,
                integration.error,

              ]
                .filter(
                  Boolean
                )
                .join(
                  ' '
                )
                .toLowerCase();


            return haystack.includes(
              query
            );

          }
        );

      },
      [
        integrations,
        search,
        clientFilter,
        providerFilter,
        statusFilter,
      ]
    );


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const summary =
    data?.summary
    ||
    {

      total:
        integrations.length,

      connected:
        integrations.filter(
          integration =>
            getConnectionGroup(
              integration
            ) ===
            'connected'
        ).length,

      attention:
        integrations.filter(
          integration =>
            getConnectionGroup(
              integration
            ) ===
            'attention'
        ).length,

      disconnected:
        integrations.filter(
          integration =>
            getConnectionGroup(
              integration
            ) ===
            'disconnected'
        ).length,

      clients:
        clients.length,

      providers:
        providers.length,

    };


  // ==========================================================
  // SELECTED
  // ==========================================================

  const selectedIntegration =
    integrations.find(
      integration =>
        integration.connectionId ===
        selectedConnectionId
    )
    ||
    null;


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

        <p
          className="
            text-[10px]

            text-slate-500
          "
        >
          Loading Integrations...
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
                Unable to load Integrations
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
              loadIntegrations
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


  // ==========================================================
  // DETAIL
  // ==========================================================

  if (
    selectedIntegration
  ) {

    return (

      <IntegrationDetail

        integration={
          selectedIntegration
        }

        onBack={() =>
          setSelectedConnectionId(
            null
          )
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

          <h2
            className="
              text-[14px]
              font-semibold
              tracking-[-0.025em]

              text-slate-950
            "
          >
            Client Integrations
          </h2>


          <p
            className="
              mt-0.5

              text-[10px]

              text-slate-500
            "
          >
            Cross-client registry of connected platforms, provider accounts and ingestion configuration.
          </p>

        </div>


        <button

          type="button"

          onClick={
            loadIntegrations
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
          SUMMARY
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

        <SummaryCard
          label="Connections"
          value={
            summary.total
          }
        />


        <SummaryCard
          label="Connected"
          value={
            summary.connected
          }
          tone="green"
        />


        <SummaryCard
          label="Attention"
          value={
            summary.attention
          }
          tone="amber"
        />


        <SummaryCard
          label="Disconnected"
          value={
            summary.disconnected
          }
          tone="red"
        />


        <SummaryCard
          label="Clients"
          value={
            summary.clients
          }
          tone="violet"
        />


        <SummaryCard
          label="Providers"
          value={
            summary.providers
          }
        />

      </section>


      {/* =====================================================
          QUICK STATUS
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-2

          md:grid-cols-3
        "
      >

        <StatusCard

          label="Connected"

          count={
            summary.connected
          }

          description="Connections currently configured and active."

          tone="green"

          onClick={() =>
            setStatusFilter(
              'connected'
            )
          }

        />


        <StatusCard

          label="Needs Attention"

          count={
            summary.attention
          }

          description="Connection errors or non-standard states requiring review."

          tone="amber"

          onClick={() =>
            setStatusFilter(
              'attention'
            )
          }

        />


        <StatusCard

          label="Disconnected"

          count={
            summary.disconnected
          }

          description="Connections currently disabled, removed or suspended."

          tone="red"

          onClick={() =>
            setStatusFilter(
              'disconnected'
            )
          }

        />

      </section>


      {/* =====================================================
          FILTERS
      ===================================================== */}

      <section
        className="
          gos-panel

          flex
          flex-col
          gap-2

          !p-3

          xl:flex-row
          xl:items-center
        "
      >

        <div
          className="
            relative

            w-full

            xl:max-w-[340px]
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

            placeholder="Search client, provider, account..."

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
                  client.value
                }

                value={
                  client.value
                }

              >
                {client.label}
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


          {providers.map(
            provider => (

              <option

                key={
                  provider
                }

                value={
                  provider
                }

              >
                {formatProvider(
                  provider
                )}
              </option>

            )
          )}

        </select>


        <select

          value={
            statusFilter
          }

          onChange={
            event =>
              setStatusFilter(
                event.target.value as StatusFilter
              )
          }

          className="gos-input"
        >

          <option value="all">
            All Connection States
          </option>

          <option value="connected">
            Connected
          </option>

          <option value="attention">
            Needs Attention
          </option>

          <option value="disconnected">
            Disconnected
          </option>

        </select>


        <div
          className="
            ml-auto

            whitespace-nowrap

            text-[9px]

            text-slate-500
          "
        >
          {filteredIntegrations.length}
          {' / '}
          {integrations.length}
          {' connections'}
        </div>

      </section>


      {/* =====================================================
          TABLE
      ===================================================== */}

      <section className="gos-panel !p-0">

        <div
          className="
            flex
            items-center
            justify-between

            border-b
            border-slate-200

            px-3
            py-2.5
          "
        >

          <div>

            <h3 className="gos-section-title">
              Integration Connections
            </h3>


            <p
              className="
                mt-0.5

                text-[9px]

                text-slate-500
              "
            >
              Real connection configuration from the Growth OS integration control plane.
            </p>

          </div>


          {(
            search
            ||
            clientFilter !==
              'all'
            ||
            providerFilter !==
              'all'
            ||
            statusFilter !==
              'all'
          ) && (

            <button

              type="button"

              onClick={() => {

                setSearch(
                  ''
                );

                setClientFilter(
                  'all'
                );

                setProviderFilter(
                  'all'
                );

                setStatusFilter(
                  'all'
                );

              }}

              className="
                text-[9px]
                font-semibold

                text-violet-600
              "
            >
              Clear filters
            </button>

          )}

        </div>


        <div className="overflow-x-auto">

          <table
            className="
              w-full
              min-w-[1500px]

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
                  Provider
                </TableHeader>

                <TableHeader>
                  Account
                </TableHeader>

                <TableHeader>
                  Connection
                </TableHeader>

                <TableHeader>
                  Mode
                </TableHeader>

                <TableHeader>
                  Adapter
                </TableHeader>

                <TableHeader>
                  Connected
                </TableHeader>

                <TableHeader>
                  Last Verified
                </TableHeader>

                <TableHeader>
                  Last Sync
                </TableHeader>

                <TableHeader>
                  Error
                </TableHeader>

                <TableHeader align="right">
                  Action
                </TableHeader>

              </tr>

            </thead>


            <tbody>

              {filteredIntegrations.map(
                integration => (

                  <tr

                    key={
                      integration.connectionId
                    }

                    className="
                      border-b
                      border-slate-100

                      last:border-0

                      hover:bg-slate-50/70
                    "
                  >


                    {/* CLIENT */}

                    <td className="px-3 py-2.5">

                      <div
                        className="
                          text-[10px]
                          font-semibold

                          text-slate-900
                        "
                      >
                        {getClientName(
                          integration
                        )}
                      </div>


                      <div
                        className="
                          mt-0.5

                          text-[8px]

                          text-slate-500
                        "
                      >
                        {integration.workspaceId}
                        {' · '}
                        {integration.brandId}
                      </div>

                    </td>


                    {/* PROVIDER */}

                    <td className="px-3 py-2.5">

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
                          <Plug
                            size={13}
                          />
                        </div>


                        <span
                          className="
                            text-[10px]
                            font-semibold

                            text-slate-800
                          "
                        >
                          {formatProvider(
                            integration.provider
                          )}
                        </span>

                      </div>

                    </td>


                    {/* ACCOUNT */}

                    <td className="px-3 py-2.5">

                      <div
                        className="
                          max-w-[220px]

                          truncate

                          text-[10px]
                          font-semibold

                          text-slate-800
                        "
                        title={
                          getAccountName(
                            integration
                          )
                        }
                      >
                        {getAccountName(
                          integration
                        )}
                      </div>


                      <div
                        className="
                          mt-0.5
                          max-w-[220px]

                          truncate

                          font-mono
                          text-[8px]

                          text-slate-500
                        "
                        title={
                          getAccountId(
                            integration
                          )
                        }
                      >
                        {getAccountId(
                          integration
                        )}
                      </div>

                    </td>


                    {/* STATUS */}

                    <td className="px-3 py-2.5">

                      <ConnectionBadge
                        integration={
                          integration
                        }
                      />

                    </td>


                    {/* MODE */}

                    <td
                      className="
                        px-3
                        py-2.5

                        text-[9px]

                        text-slate-600
                      "
                    >
                      {formatLabelOrDash(
                        integration.connectionMode
                      )}
                    </td>


                    {/* ADAPTER */}

                    <td
                      className="
                        px-3
                        py-2.5

                        text-[9px]

                        text-slate-600
                      "
                    >
                      {formatLabelOrDash(
                        integration.ingestionAdapter
                      )}
                    </td>


                    {/* CONNECTED AT */}

                    <td
                      className="
                        px-3
                        py-2.5

                        text-[9px]

                        text-slate-500
                      "
                    >
                      {formatTimestamp(
                        integration.connectedAt
                      )
                      ||
                      '—'}
                    </td>


                    {/* LAST VERIFIED */}

                    <td
                      className="
                        px-3
                        py-2.5

                        text-[9px]

                        text-slate-500
                      "
                    >
                      {formatTimestamp(
                        integration.lastVerifiedAt
                      )
                      ||
                      '—'}
                    </td>


                    {/* LAST SYNC */}

                    <td
                      className="
                        px-3
                        py-2.5

                        text-[9px]

                        text-slate-500
                      "
                    >
                      {formatTimestamp(
                        integration.lastSyncAt
                      )
                      ||
                      '—'}
                    </td>


                    {/* ERROR */}

                    <td className="px-3 py-2.5">

                      <div
                        className={`
                          max-w-[230px]

                          truncate

                          text-[9px]

                          ${
                            integration.error

                              ? 'text-red-600'

                              : 'text-slate-400'
                          }
                        `}
                        title={
                          integration.error
                          ||
                          ''
                        }
                      >
                        {integration.error
                          ||
                          '—'}
                      </div>

                    </td>


                    {/* ACTION */}

                    <td className="px-3 py-2.5 text-right">

                      <button

                        type="button"

                        onClick={() =>
                          setSelectedConnectionId(
                            integration.connectionId
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

                )
              )}


              {filteredIntegrations.length ===
                0 && (

                <tr>

                  <td

                    colSpan={
                      11
                    }

                    className="
                      px-4
                      py-14

                      text-center

                      text-[10px]

                      text-slate-500
                    "
                  >
                    No integrations match the selected filters.
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </section>


      {/* =====================================================
          SOURCE
      ===================================================== */}

      <section
        className="
          rounded-[9px]

          border
          border-violet-200

          bg-violet-50

          px-3
          py-2.5
        "
      >

        <p
          className="
            text-[8px]
            leading-4

            text-violet-700
          "
        >
          Source of truth: growthos_control.integration_connections and integration_accounts. Admin Integrations is read-only; provider connection actions remain in each client's Settings → Integrations.
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

      </section>

    </div>

  );

}


// ============================================================
// DETAIL
// ============================================================

function IntegrationDetail({

  integration,

  onBack,

}: {

  integration:
    AdminIntegration;

  onBack:
    () => void;

}) {

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
                items-center
                justify-center

                rounded-[8px]

                border
                border-slate-200

                bg-white

                hover:bg-slate-50
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
                items-center
                justify-center

                rounded-[9px]

                bg-violet-50

                text-violet-600
              "
            >
              <Plug
                size={17}
              />
            </div>


            <div className="min-w-0">

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
                  {formatProvider(
                    integration.provider
                  )}
                </h2>


                <ConnectionBadge
                  integration={
                    integration
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
                {getClientName(
                  integration
                )}
                {' · '}
                {getAccountName(
                  integration
                )}
              </p>

            </div>

          </div>


          <span
            className="
              rounded-full

              border
              border-slate-200

              bg-slate-50

              px-2.5
              py-1

              text-[8px]
              font-semibold

              text-slate-500
            "
          >
            Read Only
          </span>

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
          label="Connection"
          value={
            formatLabel(
              integration.status
            )
          }
        />


        <SummaryCard
          label="Provider"
          value={
            formatProvider(
              integration.provider
            )
          }
        />


        <SummaryCard
          label="Mode"
          value={
            formatLabelOrDash(
              integration.connectionMode
            )
          }
        />


        <SummaryCard
          label="Adapter"
          value={
            formatLabelOrDash(
              integration.ingestionAdapter
            )
          }
        />

      </section>


      {/* =====================================================
          DETAILS
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-3

          lg:grid-cols-2
        "
      >


        {/* ===================================================
            CLIENT
        =================================================== */}

        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Client
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Client"
              value={
                getClientName(
                  integration
                )
              }
            />


            <ValueRow
              label="Workspace ID"
              value={
                integration.workspaceId
              }
              mono
            />


            <ValueRow
              label="Brand ID"
              value={
                integration.brandId
              }
              mono
            />


            <ValueRow
              label="Connection ID"
              value={
                integration.connectionId
              }
              mono
            />

          </div>

        </section>


        {/* ===================================================
            PROVIDER ACCOUNT
        =================================================== */}

        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Provider Account
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Account Name"
              value={
                getAccountName(
                  integration
                )
              }
            />


            <ValueRow
              label="Account ID"
              value={
                getAccountId(
                  integration
                )
              }
              mono
            />


            <ValueRow
              label="Integration Account ID"
              value={
                integration.integrationAccountId
                ||
                '—'
              }
              mono
            />


            <ValueRow
              label="Account Type"
              value={
                formatLabelOrDash(
                  integration.accountType
                )
              }
            />


            <ValueRow
              label="Currency"
              value={
                integration.currency
                ||
                '—'
              }
            />


            <ValueRow
              label="Timezone"
              value={
                integration.timezone
                ||
                '—'
              }
            />

          </div>

        </section>


        {/* ===================================================
            CONNECTION
        =================================================== */}

        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Connection
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Status"
              value={
                formatLabel(
                  integration.status
                )
              }
            />


            <ValueRow
              label="Connection Mode"
              value={
                formatLabelOrDash(
                  integration.connectionMode
                )
              }
            />


            <ValueRow
              label="Ingestion Adapter"
              value={
                formatLabelOrDash(
                  integration.ingestionAdapter
                )
              }
              mono
            />


            <ValueRow
              label="Provider User"
              value={
                integration.providerUserName
                ||
                integration.providerUserId
                ||
                '—'
              }
            />

          </div>

        </section>


        {/* ===================================================
            TIMING
        =================================================== */}

        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Lifecycle
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Connected"
              value={
                formatTimestamp(
                  integration.connectedAt
                )
                ||
                '—'
              }
            />


            <ValueRow
              label="Last Updated"
              value={
                formatTimestamp(
                  integration.updatedAt
                )
                ||
                '—'
              }
            />


            <ValueRow
              label="Last Verified"
              value={
                formatTimestamp(
                  integration.lastVerifiedAt
                )
                ||
                '—'
              }
            />


            <ValueRow
              label="Last Sync"
              value={
                formatTimestamp(
                  integration.lastSyncAt
                )
                ||
                '—'
              }
            />


            <ValueRow
              label="Account Selected"
              value={
                formatTimestamp(
                  integration.accountSelectedAt
                )
                ||
                '—'
              }
            />

          </div>

        </section>

      </section>


      {/* =====================================================
          ERROR
      ===================================================== */}

      {integration.error && (

        <section
          className="
            rounded-[10px]

            border
            border-red-200

            bg-red-50

            p-3
          "
        >

          <div
            className="
              flex
              items-start
              gap-2.5
            "
          >

            <AlertTriangle
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
                Connection Error
              </p>


              <p
                className="
                  mt-1

                  break-words

                  font-mono
                  text-[9px]
                  leading-4

                  text-red-700
                "
              >
                {integration.error}
              </p>

            </div>

          </div>

        </section>

      )}


      {/* =====================================================
          OWNERSHIP
      ===================================================== */}

      <section
        className="
          rounded-[10px]

          border
          border-violet-200

          bg-violet-50

          p-3
        "
      >

        <p
          className="
            text-[9px]
            font-semibold

            text-violet-800
          "
        >
          Connection ownership
        </p>


        <p
          className="
            mt-1

            text-[8px]
            leading-4

            text-violet-600
          "
        >
          Admin Integrations provides cross-client visibility only. Connect, reconnect, authorize or change provider accounts from the relevant client's Settings → Integrations flow.
        </p>

      </section>

    </div>

  );

}


// ============================================================
// SUMMARY CARD
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
    | 'default'
    | 'green'
    | 'amber'
    | 'red'
    | 'violet';

}) {


  const cls =
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

          truncate

          text-[18px]
          font-semibold
          tracking-[-0.03em]

          ${cls}
        `}
      >
        {value}
      </p>

    </div>

  );

}


// ============================================================
// STATUS CARD
// ============================================================

function StatusCard({

  label,

  count,

  description,

  tone,

  onClick,

}: {

  label:
    string;

  count:
    number;

  description:
    string;

  tone:
    | 'green'
    | 'amber'
    | 'red';

  onClick:
    () => void;

}) {


  const cls =
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

        ${cls}
      `}
    >

      <div
        className="
          flex
          items-center
          justify-between
        "
      >

        <span
          className="
            text-[10px]
            font-semibold

            text-slate-700
          "
        >
          {label}
        </span>


        <span
          className="
            text-[18px]
            font-semibold

            text-slate-950
          "
        >
          {formatNumber(
            count
          )}
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
// CONNECTION BADGE
// ============================================================

function ConnectionBadge({

  integration,

}: {

  integration:
    AdminIntegration;

}) {


  const group =
    getConnectionGroup(
      integration
    );


  if (
    group ===
      'connected'
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
        {formatLabel(
          integration.status
        )}
      </span>

    );

  }


  if (
    group ===
      'disconnected'
  ) {

    return (

      <span
        className="
          inline-flex

          rounded-full

          border
          border-slate-200

          bg-slate-100

          px-2
          py-0.5

          text-[8px]
          font-semibold

          text-slate-600
        "
      >
        {formatLabel(
          integration.status
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
      {integration.error
        ? 'Attention'
        : formatLabel(
            integration.status
          )}
    </span>

  );

}


// ============================================================
// VALUE ROW
// ============================================================

function ValueRow({

  label,

  value,

  mono =
    false,

}: {

  label:
    string;

  value:
    string;

  mono?:
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
          shrink-0

          text-[9px]

          text-slate-500
        "
      >
        {label}
      </span>


      <span
        title={
          value
        }
        className={`
          max-w-[68%]

          truncate

          text-right
          text-[10px]
          font-semibold

          text-slate-800

          ${
            mono

              ? 'font-mono text-[8px]'

              : ''
          }
        `}
      >
        {value}
      </span>

    </div>

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

        text-[8px]
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

function getClientKey(
  integration:
    AdminIntegration
) {

  return [
    integration.workspaceId,
    integration.brandId,
  ].join(
    ':'
  );

}


function getClientName(
  integration:
    AdminIntegration
) {

  return (
    integration.brandName
    ||
    integration.workspaceName
    ||
    integration.brandId
    ||
    integration.workspaceId
  );

}


function getAccountName(
  integration:
    AdminIntegration
) {

  return (
    integration.selectedAccountName
    ||
    integration.providerAccountName
    ||
    integration.providerUserName
    ||
    'No selected account'
  );

}


function getAccountId(
  integration:
    AdminIntegration
) {

  return (
    integration.selectedAccountId
    ||
    integration.providerAccountId
    ||
    integration.providerUserId
    ||
    '—'
  );

}


function getConnectionGroup(
  integration:
    AdminIntegration
):
  ConnectionGroup {

  const status =
    String(
      integration.status
      ||
      ''
    )
      .trim()
      .toLowerCase();


  if (
    integration.error
  ) {

    return 'attention';

  }


  if (
    [
      'connected',
      'active',
      'ready',
    ].includes(
      status
    )
  ) {

    return 'connected';

  }


  if (
    [
      'disconnected',
      'uninstalled',
      'disabled',
      'suspended',
    ].includes(
      status
    )
  ) {

    return 'disconnected';

  }


  return 'attention';

}


function formatProvider(
  value:
    string
) {

  const labels:
    Record<
      string,
      string
    > = {

    shopify:
      'Shopify',

    meta_ads:
      'Meta Ads',

    google_ads:
      'Google Ads',

    bigquery:
      'BigQuery',

  };


  return (
    labels[
      value
    ]
    ||
    formatLabel(
      value
    )
  );

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


function formatTimestamp(
  value:
    string |
    null
) {

  if (!value) {

    return null;

  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return value;

  }


  return date.toLocaleString(
    'en-IN',
    {

      dateStyle:
        'medium',

      timeStyle:
        'short',

    }
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