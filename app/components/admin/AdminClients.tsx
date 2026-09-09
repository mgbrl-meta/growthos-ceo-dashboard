'use client';

import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Plug,
  RefreshCw,
  Search,
  Users,
  XCircle,
} from 'lucide-react';


// ============================================================
// TYPES
// ============================================================

type AdminClient = {

  workspaceId:
    string;

  workspaceName:
    string | null;

  workspaceSlug:
    string | null;

  workspaceStatus:
    string | null;

  brandId:
    string;

  brandName:
    string | null;

  brandSlug:
    string | null;

  brandStatus:
    string | null;

  currency:
    string | null;

  timezone:
    string | null;

  createdAt:
    string | null;

  updatedAt:
    string | null;


  // ----------------------------------------------------------
  // SUBSCRIPTION
  // ----------------------------------------------------------

  subscriptionId:
    string | null;

  subscriptionStatus:
    string | null;

  planId:
    string | null;

  planName:
    string | null;

  planStatus:
    string | null;

  orderLimitOverrideMode:
    string | null;

  monthlyOrderLimitOverride:
    number | null;

  planMonthlyOrderLimit:
    number | null;

  effectiveMonthlyOrderLimit:
    number | null;

  unlimitedOrders:
    boolean;

  maxUsers:
    number | null;


  // ----------------------------------------------------------
  // USERS
  // ----------------------------------------------------------

  totalUsers:
    number;

  activeUsers:
    number;

  owners:
    number;

  admins:
    number;


  // ----------------------------------------------------------
  // INTEGRATIONS
  // ----------------------------------------------------------

  integrations:
    number;

  connectedIntegrations:
    number;

};


type AdminClientsResponse = {

  ok:
    boolean;

  scope?:
    string;

  summary?: {

    total:
      number;

    active:
      number;

    setup:
      number;

    suspended:
      number;

    withSubscription:
      number;

    withoutSubscription:
      number;

    users:
      number;

    integrations:
      number;

  };

  clients?:
    AdminClient[];

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


type StatusFilter =
  | 'all'
  | 'active'
  | 'setup'
  | 'suspended';


type SubscriptionFilter =
  | 'all'
  | 'with'
  | 'without';


// ============================================================
// MAIN
// ============================================================

export default function AdminClients() {


  // ==========================================================
  // SERVER DATA
  // ==========================================================

  const [
    data,
    setData,
  ] =
    useState<
      AdminClientsResponse |
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
    statusFilter,
    setStatusFilter,
  ] =
    useState<StatusFilter>(
      'all'
    );


  const [
    planFilter,
    setPlanFilter,
  ] =
    useState(
      'all'
    );


  const [
    subscriptionFilter,
    setSubscriptionFilter,
  ] =
    useState<SubscriptionFilter>(
      'all'
    );


  const [
    selectedClientKey,
    setSelectedClientKey,
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

  async function loadClients() {

    setLoading(
      true
    );


    setError(
      null
    );


    try {

      const response =
        await fetch(
          '/api/admin/clients',
          {

            cache:
              'no-store',

            credentials:
              'same-origin',

          }
        );


      const json:
        AdminClientsResponse =
          await response.json();


      if (
        !response.ok
        ||
        !json.ok
      ) {

        throw new Error(
          json.error
          ||
          'Unable to load Admin Clients'
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
        'ADMIN_CLIENTS_UI_ERROR',
        error
      );


      setData(
        null
      );


      setError(
        String(
          error?.message
          ||
          'Unable to load Admin Clients'
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

      loadClients();

    },
    []
  );


  // ==========================================================
  // CLIENTS
  // ==========================================================

  const clients =
    data?.clients
    ||
    [];


  // ==========================================================
  // PLAN OPTIONS
  // ==========================================================

  const plans =
    useMemo(
      () => {

        const map =
          new Map<
            string,
            string
          >();


        clients.forEach(
          client => {

            if (
              !client.planId
            ) {

              return;

            }


            map.set(
              client.planId,
              client.planName
              ||
              client.planId
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
        clients,
      ]
    );


  // ==========================================================
  // FILTERED CLIENTS
  // ==========================================================

  const filteredClients =
    useMemo(
      () => {

        const query =
          search
            .trim()
            .toLowerCase();


        return clients.filter(
          client => {


            // --------------------------------------------------
            // STATUS
            // --------------------------------------------------

            if (
              statusFilter !==
                'all'
              &&
              getClientStatusGroup(
                client
              ) !==
                statusFilter
            ) {

              return false;

            }


            // --------------------------------------------------
            // PLAN
            // --------------------------------------------------

            if (
              planFilter !==
                'all'
              &&
              client.planId !==
                planFilter
            ) {

              return false;

            }


            // --------------------------------------------------
            // SUBSCRIPTION
            // --------------------------------------------------

            if (
              subscriptionFilter ===
                'with'
              &&
              !client.subscriptionId
            ) {

              return false;

            }


            if (
              subscriptionFilter ===
                'without'
              &&
              client.subscriptionId
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

                client.workspaceId,
                client.workspaceName,
                client.workspaceSlug,
                client.workspaceStatus,

                client.brandId,
                client.brandName,
                client.brandSlug,
                client.brandStatus,

                client.currency,
                client.timezone,

                client.subscriptionId,
                client.subscriptionStatus,

                client.planId,
                client.planName,
                client.planStatus,

                client.orderLimitOverrideMode,

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
        clients,
        search,
        statusFilter,
        planFilter,
        subscriptionFilter,
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
        clients.length,

      active:
        clients.filter(
          client =>
            getClientStatusGroup(
              client
            ) ===
            'active'
        ).length,

      setup:
        clients.filter(
          client =>
            getClientStatusGroup(
              client
            ) ===
            'setup'
        ).length,

      suspended:
        clients.filter(
          client =>
            getClientStatusGroup(
              client
            ) ===
            'suspended'
        ).length,

      withSubscription:
        clients.filter(
          client =>
            Boolean(
              client.subscriptionId
            )
        ).length,

      withoutSubscription:
        clients.filter(
          client =>
            !client.subscriptionId
        ).length,

      users:
        clients.reduce(
          (
            total,
            client
          ) =>
            total
            +
            client.totalUsers,
          0
        ),

      integrations:
        clients.reduce(
          (
            total,
            client
          ) =>
            total
            +
            client.integrations,
          0
        ),

    };


  // ==========================================================
  // SELECTED CLIENT
  // ==========================================================

  const selectedClient =
    clients.find(
      client =>
        getClientKey(
          client
        ) ===
        selectedClientKey
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
          Loading Clients...
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
                Unable to load Clients
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
              loadClients
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
    selectedClient
  ) {

    return (

      <ClientDetail

        client={
          selectedClient
        }

        onBack={() =>
          setSelectedClientKey(
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
            Client Workspaces
          </h2>


          <p
            className="
              mt-0.5

              text-[10px]

              text-slate-500
            "
          >
            Global registry of Growth OS workspaces, brands, subscriptions, users and integrations.
          </p>

        </div>


        <button

          type="button"

          onClick={
            loadClients
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

          md:grid-cols-4
          xl:grid-cols-8
        "
      >

        <SummaryCard
          label="Clients"
          value={
            summary.total
          }
        />


        <SummaryCard
          label="Active"
          value={
            summary.active
          }
          tone="green"
        />


        <SummaryCard
          label="Setup"
          value={
            summary.setup
          }
          tone="amber"
        />


        <SummaryCard
          label="Suspended"
          value={
            summary.suspended
          }
          tone="red"
        />


        <SummaryCard
          label="Subscribed"
          value={
            summary.withSubscription
          }
          tone="violet"
        />


        <SummaryCard
          label="No Plan"
          value={
            summary.withoutSubscription
          }
          tone="amber"
        />


        <SummaryCard
          label="Users"
          value={
            summary.users
          }
        />


        <SummaryCard
          label="Integrations"
          value={
            summary.integrations
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

            placeholder="Search client, workspace, plan..."

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
            All Status
          </option>

          <option value="active">
            Active
          </option>

          <option value="setup">
            Setup
          </option>

          <option value="suspended">
            Suspended
          </option>

        </select>


        <select

          value={
            planFilter
          }

          onChange={
            event =>
              setPlanFilter(
                event.target.value
              )
          }

          className="gos-input"
        >

          <option value="all">
            All Plans
          </option>


          {plans.map(
            plan => (

              <option

                key={
                  plan.value
                }

                value={
                  plan.value
                }

              >
                {plan.label}
              </option>

            )
          )}

        </select>


        <select

          value={
            subscriptionFilter
          }

          onChange={
            event =>
              setSubscriptionFilter(
                event.target.value as SubscriptionFilter
              )
          }

          className="gos-input"
        >

          <option value="all">
            All Subscription States
          </option>

          <option value="with">
            With Subscription
          </option>

          <option value="without">
            Without Subscription
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
          {filteredClients.length}
          {' / '}
          {clients.length}
          {' clients'}
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
              Clients
            </h3>


            <p
              className="
                mt-0.5

                text-[9px]

                text-slate-500
              "
            >
              One row per Growth OS workspace and brand.
            </p>

          </div>


          {(
            search
            ||
            statusFilter !==
              'all'
            ||
            planFilter !==
              'all'
            ||
            subscriptionFilter !==
              'all'
          ) && (

            <button

              type="button"

              onClick={() => {

                setSearch(
                  ''
                );

                setStatusFilter(
                  'all'
                );

                setPlanFilter(
                  'all'
                );

                setSubscriptionFilter(
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
              min-w-[1350px]

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
                  Orders / Month
                </TableHeader>

                <TableHeader>
                  Users
                </TableHeader>

                <TableHeader>
                  Integrations
                </TableHeader>

                <TableHeader>
                  Currency
                </TableHeader>

                <TableHeader>
                  Created
                </TableHeader>

                <TableHeader align="right">
                  Action
                </TableHeader>

              </tr>

            </thead>


            <tbody>

              {filteredClients.map(
                client => (

                  <tr

                    key={
                      getClientKey(
                        client
                      )
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
                          flex
                          items-center
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
                          <Building2
                            size={15}
                          />
                        </div>


                        <div className="min-w-0">

                          <div
                            className="
                              text-[10px]
                              font-semibold

                              text-slate-900
                            "
                          >
                            {getClientName(
                              client
                            )}
                          </div>


                          <div
                            className="
                              mt-0.5

                              max-w-[250px]

                              truncate

                              font-mono
                              text-[8px]

                              text-slate-500
                            "
                          >
                            {client.workspaceId}
                            {' · '}
                            {client.brandId}
                          </div>

                        </div>

                      </div>

                    </td>


                    {/* STATUS */}

                    <td className="px-3 py-2.5">

                      <ClientStatusBadge
                        client={
                          client
                        }
                      />

                    </td>


                    {/* PLAN */}

                    <td className="px-3 py-2.5">

                      <div
                        className="
                          text-[10px]
                          font-semibold

                          text-slate-800
                        "
                      >
                        {client.planName
                          ||
                          'No Plan'}
                      </div>


                      {client.subscriptionStatus && (

                        <div
                          className="
                            mt-0.5

                            text-[8px]

                            text-slate-500
                          "
                        >
                          {formatLabel(
                            client.subscriptionStatus
                          )}
                        </div>

                      )}

                    </td>


                    {/* ORDERS */}

                    <td
                      className="
                        px-3
                        py-2.5

                        text-[10px]
                        font-semibold

                        text-slate-800
                      "
                    >
                      {formatClientOrderLimit(
                        client
                      )}
                    </td>


                    {/* USERS */}

                    <td className="px-3 py-2.5">

                      <div
                        className="
                          flex
                          items-center
                          gap-1.5

                          text-[10px]
                          font-semibold

                          text-slate-800
                        "
                      >
                        <Users
                          size={12}

                          className="
                            text-slate-400
                          "
                        />

                        {client.activeUsers}
                        {' / '}
                        {client.totalUsers}
                      </div>

                    </td>


                    {/* INTEGRATIONS */}

                    <td className="px-3 py-2.5">

                      <div
                        className="
                          flex
                          items-center
                          gap-1.5

                          text-[10px]
                          font-semibold

                          text-slate-800
                        "
                      >
                        <Plug
                          size={12}

                          className="
                            text-slate-400
                          "
                        />

                        {client.connectedIntegrations}
                        {' / '}
                        {client.integrations}
                      </div>

                    </td>


                    {/* CURRENCY */}

                    <td
                      className="
                        px-3
                        py-2.5

                        text-[9px]
                        font-semibold

                        text-slate-600
                      "
                    >
                      {client.currency
                        ||
                        '—'}
                    </td>


                    {/* CREATED */}

                    <td
                      className="
                        px-3
                        py-2.5

                        text-[9px]

                        text-slate-500
                      "
                    >
                      {formatTimestamp(
                        client.createdAt
                      )
                      ||
                      '—'}
                    </td>


                    {/* ACTION */}

                    <td className="px-3 py-2.5 text-right">

                      <button

                        type="button"

                        onClick={() =>
                          setSelectedClientKey(
                            getClientKey(
                              client
                            )
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


              {filteredClients.length ===
                0 && (

                <tr>

                  <td

                    colSpan={
                      9
                    }

                    className="
                      px-4
                      py-14

                      text-center

                      text-[10px]

                      text-slate-500
                    "
                  >
                    No clients match the selected filters.
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
          Source of truth: Growth OS workspaces, brands, subscriptions, plans, memberships and integration connections. Admin Clients is read-only during this architecture phase.
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
// CLIENT DETAIL
// ============================================================

function ClientDetail({

  client,

  onBack,

}: {

  client:
    AdminClient;

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
                shrink-0
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
                shrink-0
                items-center
                justify-center

                rounded-[9px]

                bg-violet-50

                text-violet-600
              "
            >
              <Building2
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
                  {getClientName(
                    client
                  )}
                </h2>


                <ClientStatusBadge
                  client={
                    client
                  }
                />

              </div>


              <p
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
          label="Plan"
          value={
            client.planName
            ||
            'No Plan'
          }
          tone={
            client.planId
              ? 'violet'
              : 'amber'
          }
        />


        <SummaryCard
          label="Orders / Month"
          value={
            formatClientOrderLimit(
              client
            )
          }
        />


        <SummaryCard
          label="Users"
          value={
            `${client.activeUsers} / ${client.totalUsers}`
          }
          tone="green"
        />


        <SummaryCard
          label="Integrations"
          value={
            `${client.connectedIntegrations} / ${client.integrations}`
          }
          tone="green"
        />

      </section>


      {/* =====================================================
          WORKSPACE / BRAND
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
            WORKSPACE
        =================================================== */}

        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Workspace
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Workspace"
              value={
                client.workspaceName
                ||
                client.workspaceId
              }
            />


            <ValueRow
              label="Workspace ID"
              value={
                client.workspaceId
              }
              mono
            />


            <ValueRow
              label="Workspace Slug"
              value={
                client.workspaceSlug
                ||
                '—'
              }
              mono
            />


            <ValueRow
              label="Status"
              value={
                formatLabelOrDash(
                  client.workspaceStatus
                )
              }
            />

          </div>

        </section>


        {/* ===================================================
            BRAND
        =================================================== */}

        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Brand
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Brand"
              value={
                client.brandName
                ||
                client.brandId
              }
            />


            <ValueRow
              label="Brand ID"
              value={
                client.brandId
              }
              mono
            />


            <ValueRow
              label="Brand Slug"
              value={
                client.brandSlug
                ||
                '—'
              }
              mono
            />


            <ValueRow
              label="Status"
              value={
                formatLabelOrDash(
                  client.brandStatus
                )
              }
            />


            <ValueRow
              label="Currency"
              value={
                client.currency
                ||
                '—'
              }
            />


            <ValueRow
              label="Timezone"
              value={
                client.timezone
                ||
                '—'
              }
            />

          </div>

        </section>

      </section>


      {/* =====================================================
          SUBSCRIPTION
      ===================================================== */}

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
              Subscription
            </h3>


            <p
              className="
                mt-0.5

                text-[9px]

                text-slate-500
              "
            >
              Commercial entitlement currently assigned to this brand.
            </p>

          </div>


          <SubscriptionBadge
            client={
              client
            }
          />

        </div>


        <div
          className="
            mt-3

            grid
            grid-cols-1
            gap-2

            md:grid-cols-2
            xl:grid-cols-3
          "
        >

          <ValueRow
            label="Subscription ID"
            value={
              client.subscriptionId
              ||
              '—'
            }
            mono
          />


          <ValueRow
            label="Plan"
            value={
              client.planName
              ||
              'No Plan'
            }
          />


          <ValueRow
            label="Plan ID"
            value={
              client.planId
              ||
              '—'
            }
            mono
          />


          <ValueRow
            label="Subscription Status"
            value={
              formatLabelOrDash(
                client.subscriptionStatus
              )
            }
          />


          <ValueRow
            label="Plan Status"
            value={
              formatLabelOrDash(
                client.planStatus
              )
            }
          />


          <ValueRow
            label="Max Users"
            value={
              client.maxUsers ===
                null

                ? 'Unlimited'

                : formatNumber(
                    client.maxUsers
                  )
            }
          />

        </div>

      </section>


      {/* =====================================================
          ORDER LIMIT
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
            Order Allowance
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Plan Default"
              value={
                formatOrderLimit(
                  client.planMonthlyOrderLimit,
                  false
                )
              }
            />


            <ValueRow
              label="Override Mode"
              value={
                formatLabelOrDash(
                  client.orderLimitOverrideMode
                )
              }
            />


            <ValueRow
              label="Custom Override"
              value={
                client.monthlyOrderLimitOverride ===
                  null

                  ? '—'

                  : formatOrderLimit(
                      client.monthlyOrderLimitOverride,
                      false
                    )
              }
            />


            <ValueRow
              label="Effective Limit"
              value={
                formatClientOrderLimit(
                  client
                )
              }
              strong
            />

          </div>

        </section>


        {/* ===================================================
            ACCESS
        =================================================== */}

        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Access Summary
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Users"
              value={
                formatNumber(
                  client.totalUsers
                )
              }
            />


            <ValueRow
              label="Active Users"
              value={
                formatNumber(
                  client.activeUsers
                )
              }
            />


            <ValueRow
              label="Owners"
              value={
                formatNumber(
                  client.owners
                )
              }
            />


            <ValueRow
              label="Admins"
              value={
                formatNumber(
                  client.admins
                )
              }
            />


            <ValueRow
              label="Integrations"
              value={
                formatNumber(
                  client.integrations
                )
              }
            />


            <ValueRow
              label="Connected Integrations"
              value={
                formatNumber(
                  client.connectedIntegrations
                )
              }
            />

          </div>

        </section>

      </section>


      {/* =====================================================
          LIFECYCLE
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <h3 className="gos-section-title">
          Lifecycle
        </h3>


        <div
          className="
            mt-3

            grid
            grid-cols-1
            gap-2

            md:grid-cols-2
          "
        >

          <ValueRow
            label="Created"
            value={
              formatTimestamp(
                client.createdAt
              )
              ||
              '—'
            }
          />


          <ValueRow
            label="Updated"
            value={
              formatTimestamp(
                client.updatedAt
              )
              ||
              '—'
            }
          />

        </div>

      </section>


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
          Administrative ownership
        </p>


        <p
          className="
            mt-1

            text-[8px]
            leading-4

            text-violet-600
          "
        >
          This screen reflects real Growth OS control-plane state. Client creation, plan changes, status changes and entitlement overrides are intentionally disabled until dedicated authenticated Admin command APIs are introduced.
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
// CLIENT STATUS
// ============================================================

function ClientStatusBadge({

  client,

}: {

  client:
    AdminClient;

}) {


  const status =
    getClientStatusGroup(
      client
    );


  if (
    status ===
    'active'
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
        Active
      </span>

    );

  }


  if (
    status ===
    'suspended'
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
        Suspended
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
      Setup
    </span>

  );

}


// ============================================================
// SUBSCRIPTION BADGE
// ============================================================

function SubscriptionBadge({

  client,

}: {

  client:
    AdminClient;

}) {

  if (
    !client.subscriptionId
  ) {

    return (

      <span
        className="
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

    );

  }


  return (

    <span
      className="
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
        client.subscriptionStatus
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

  strong =
    false,

}: {

  label:
    string;

  value:
    string;

  mono?:
    boolean;

  strong?:
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

          ${
            strong
              ? 'text-violet-700'
              : 'text-slate-800'
          }

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
  client:
    AdminClient
) {

  return [
    client.workspaceId,
    client.brandId,
  ].join(
    ':'
  );

}


function getClientName(
  client:
    AdminClient
) {

  return (
    client.brandName
    ||
    client.workspaceName
    ||
    client.brandId
    ||
    client.workspaceId
  );

}


function getClientStatusGroup(
  client:
    AdminClient
):
  Exclude<
    StatusFilter,
    'all'
  > {

  const status =
    String(
      client.brandStatus
      ||
      ''
    )
      .trim()
      .toLowerCase();


  if (
    status ===
    'active'
  ) {

    return 'active';

  }


  if (
    status ===
    'suspended'
  ) {

    return 'suspended';

  }


  return 'setup';

}


function formatClientOrderLimit(
  client:
    AdminClient
) {

  if (
    client.unlimitedOrders
  ) {

    return 'Unlimited';

  }


  return formatOrderLimit(
    client.effectiveMonthlyOrderLimit,
    true
  );

}


function formatOrderLimit(

  value:
    number |
    null,

  allowUnlimited:
    boolean

) {

  if (
    value ===
    null
  ) {

    return allowUnlimited
      ? 'Unlimited'
      : '—';

  }


  return `${formatNumber(
    value
  )} orders`;

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