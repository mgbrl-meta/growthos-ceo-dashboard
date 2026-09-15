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
  Save,
  Search,
  Users,
  XCircle,
} from 'lucide-react';

import AdminBillingPanel
  from './AdminBillingPanel';


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




type ClientAccessSubmodule = {
  moduleId: string;
  submoduleId: string;
  label: string;
  status: string | null;
  accessMode: string;
  releaseStage: string;
  planEnabled: boolean;
  brandOverride: string;
  releaseAllowed: boolean;
  enabled: boolean;
};


type ClientAccessModule = {
  moduleId: string;
  name: string | null;
  description: string | null;
  accessMode: string;
  releaseStage: string;
  status: string | null;
  planEnabled: boolean;
  brandOverride: string;
  releaseAllowed: boolean;
  enabled: boolean;
  submodules: ClientAccessSubmodule[];
};


type ClientAccessResponse = {
  ok: boolean;
  access?: {
    configured: boolean;
    plan: {
      planId: string;
      name: string;
    } | null;
    modules: ClientAccessModule[];
  };
  error?: string;
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

  async function loadClients(fresh = false) {

    setLoading(
      true
    );


    setError(
      null
    );


    try {

      const response =
        await fetch(
          fresh ? '/api/admin/clients?fresh=1' : '/api/admin/clients',
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

            onClick={() => {
              void loadClients();
            }}

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

          onClick={() => {
            void loadClients(true);
          }}

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
          Source of truth: Growth OS workspaces, brands, subscriptions, plans, memberships and integration connections. Product-access overrides are editable from each client detail.
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
            Platform Admin
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


      <AdminBillingPanel
        client={{
          workspaceId: client.workspaceId,
          brandId: client.brandId,
          planId: client.planId,
          planName: client.planName,
        }}
      />


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


      <ClientAccessControl client={client} />


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
          This screen reflects real Growth OS control-plane state. Product access overrides are editable here; subscription, billing and other client controls remain owned by their dedicated Admin sections.
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
// CLIENT ACCESS CONTROL
// ============================================================

function ClientAccessControl({

  client,

}: {

  client:
    AdminClient;

}) {

  const [
    data,
    setData,
  ] =
    useState<
      ClientAccessResponse |
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
    saving,
    setSaving,
  ] =
    useState(
      false
    );


  const [
    message,
    setMessage,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const [
    moduleOverrides,
    setModuleOverrides,
  ] =
    useState<
      Record<
        string,
        string
      >
    >(
      {}
    );


  const [
    submoduleOverrides,
    setSubmoduleOverrides,
  ] =
    useState<
      Record<
        string,
        string
      >
    >(
      {}
    );


  async function loadAccess() {

    setLoading(
      true
    );


    setMessage(
      null
    );


    try {

      const params =
        new URLSearchParams({
          workspaceId:
            client.workspaceId,
          brandId:
            client.brandId,
        });


      const response =
        await fetch(
          `/api/admin/clients/access?${params.toString()}`,
          {
            cache:
              'no-store',
            credentials:
              'same-origin',
          }
        );


      const json:
        ClientAccessResponse =
          await response.json();


      if (
        !response.ok
        ||
        !json.ok
      ) {

        throw new Error(
          json.error
          ||
          'Unable to load client access'
        );

      }


      setData(
        json
      );


      const nextModuleOverrides:
        Record<string, string> = {};


      const nextSubmoduleOverrides:
        Record<string, string> = {};


      for (
        const module
        of json.access?.modules
        ||
        []
      ) {

        nextModuleOverrides[
          module.moduleId
        ] =
          module.brandOverride
          ||
          'default';


        for (
          const submodule
          of module.submodules
          ||
          []
        ) {

          nextSubmoduleOverrides[
            `${module.moduleId}:${submodule.submoduleId}`
          ] =
            submodule.brandOverride
            ||
            'default';

        }

      }


      setModuleOverrides(
        nextModuleOverrides
      );


      setSubmoduleOverrides(
        nextSubmoduleOverrides
      );

    } catch (
      error:
        any
    ) {

      setMessage(
        String(
          error?.message
          ||
          'Unable to load client access'
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

      loadAccess();

    },
    [
      client.workspaceId,
      client.brandId,
    ]
  );


  async function saveAccess() {

    setSaving(
      true
    );


    setMessage(
      null
    );


    try {

      const response =
        await fetch(
          '/api/admin/clients/access',
          {
            method:
              'PATCH',
            credentials:
              'same-origin',
            headers: {
              'content-type':
                'application/json',
            },
            body:
              JSON.stringify({
                workspaceId:
                  client.workspaceId,
                brandId:
                  client.brandId,
                moduleOverrides:
                  Object.entries(
                    moduleOverrides
                  ).map(
                    ([
                      moduleId,
                      override,
                    ]) => ({
                      moduleId,
                      override,
                    })
                  ),
                submoduleOverrides:
                  Object.entries(
                    submoduleOverrides
                  ).map(
                    ([
                      key,
                      override,
                    ]) => {

                      const separator =
                        key.indexOf(
                          ':'
                        );


                      return {
                        moduleId:
                          separator >= 0
                            ? key.slice(
                                0,
                                separator
                              )
                            : key,
                        submoduleId:
                          separator >= 0
                            ? key.slice(
                                separator + 1
                              )
                            : '',
                        override,
                      };

                    }
                  ),
              }),
          }
        );


      const json:
        ClientAccessResponse =
          await response.json();


      if (
        !response.ok
        ||
        !json.ok
      ) {

        throw new Error(
          json.error
          ||
          'Unable to save client access'
        );

      }


      setData(
        json
      );


      setMessage(
        'Client access overrides saved.'
      );


      await loadAccess();

    } catch (
      error:
        any
    ) {

      setMessage(
        String(
          error?.message
          ||
          'Unable to save client access'
        )
      );

    } finally {

      setSaving(
        false
      );

    }

  }


  const modules =
    data?.access?.modules
    ||
    [];


  return (

    <section className="gos-panel !p-3.5">

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

        <div>

          <h3 className="gos-section-title">
            Product Access Overrides
          </h3>


          <p
            className="
              mt-0.5
              text-[9px]
              text-slate-500
            "
          >
            Inherit follows Standard / Plan / Custom rules. Allow or Deny creates a client-specific exception. Release-stage gates still apply.
          </p>

        </div>


        <button
          type="button"
          onClick={
            saveAccess
          }
          disabled={
            saving
            ||
            loading
          }
          className="
            inline-flex
            h-8
            items-center
            gap-2
            rounded-[8px]
            bg-slate-950
            px-3
            text-[9px]
            font-semibold
            text-white
            hover:bg-slate-800
            disabled:opacity-50
          "
        >
          <Save
            size={12}
          />
          {saving
            ? 'Saving…'
            : 'Save Access'}
        </button>

      </div>


      {message && (
        <p
          className="
            mt-2
            text-[9px]
            text-slate-600
          "
        >
          {message}
        </p>
      )}


      {loading ? (

        <div
          className="
            mt-3
            rounded-[8px]
            border
            border-slate-200
            bg-slate-50
            p-4
            text-center
            text-[9px]
            text-slate-500
          "
        >
          Loading product access…
        </div>

      ) : modules.length === 0 ? (

        <div
          className="
            mt-3
            rounded-[8px]
            border
            border-amber-200
            bg-amber-50
            p-3
            text-[9px]
            text-amber-700
          "
        >
          No commercial access snapshot is available for this client. Confirm that a plan is assigned first.
        </div>

      ) : (

        <div className="mt-3 space-y-2">

          {modules.map(
            module => {

              const moduleOverride =
                moduleOverrides[
                  module.moduleId
                ]
                ||
                'default';


              return (

                <div
                  key={
                    module.moduleId
                  }
                  className="
                    rounded-[10px]
                    border
                    border-slate-200
                    bg-white
                  "
                >

                  <div
                    className="
                      grid
                      grid-cols-1
                      gap-3
                      px-3
                      py-2.5

                      md:grid-cols-[minmax(180px,1fr)_100px_100px_130px]
                      md:items-center
                    "
                  >

                    <div className="min-w-0">

                      <div
                        className="
                          text-[9px]
                          font-semibold
                          text-slate-900
                        "
                      >
                        {module.name
                          ||
                          module.moduleId}
                      </div>


                      <div
                        className="
                          mt-0.5
                          text-[8px]
                          text-slate-400
                        "
                      >
                        {formatLabel(
                          module.accessMode
                        )}
                        {' · '}
                        {formatLabel(
                          module.releaseStage
                        )}
                      </div>

                    </div>


                    <AccessState
                      label="Plan"
                      enabled={
                        module.planEnabled
                      }
                    />


                    <AccessState
                      label="Effective"
                      enabled={
                        module.enabled
                      }
                    />


                    <OverrideSelect
                      value={
                        moduleOverride
                      }
                      onChange={
                        value =>
                          setModuleOverrides(
                            current => ({
                              ...current,
                              [module.moduleId]:
                                value,
                            })
                          )
                      }
                    />

                  </div>


                  {module.submodules?.length > 0 && (

                    <div
                      className="
                        border-t
                        border-slate-100
                        bg-slate-50/40
                        px-3
                        py-2.5
                      "
                    >

                      <div
                        className="
                          grid
                          grid-cols-1
                          gap-1.5

                          xl:grid-cols-2
                        "
                      >

                        {module.submodules.map(
                          submodule => {

                            const key =
                              `${module.moduleId}:${submodule.submoduleId}`;


                            const override =
                              submoduleOverrides[
                                key
                              ]
                              ||
                              'default';


                            return (

                              <div
                                key={
                                  key
                                }
                                className="
                                  grid
                                  grid-cols-[minmax(120px,1fr)_72px_72px_105px]
                                  items-center
                                  gap-2
                                  rounded-[8px]
                                  border
                                  border-slate-200
                                  bg-white
                                  px-2.5
                                  py-2
                                "
                              >

                                <div className="min-w-0">

                                  <div
                                    className="
                                      truncate
                                      text-[8px]
                                      font-semibold
                                      text-slate-700
                                    "
                                  >
                                    {submodule.label}
                                  </div>


                                  <div
                                    className="
                                      mt-0.5
                                      truncate
                                      text-[7px]
                                      text-slate-400
                                    "
                                  >
                                    {formatLabel(
                                      submodule.accessMode
                                    )}
                                    {' · '}
                                    {formatLabel(
                                      submodule.releaseStage
                                    )}
                                  </div>

                                </div>


                                <TinyState
                                  enabled={
                                    submodule.planEnabled
                                  }
                                />


                                <TinyState
                                  enabled={
                                    submodule.enabled
                                  }
                                />


                                <OverrideSelect
                                  value={
                                    override
                                  }
                                  compact
                                  onChange={
                                    value =>
                                      setSubmoduleOverrides(
                                        current => ({
                                          ...current,
                                          [key]:
                                            value,
                                        })
                                      )
                                  }
                                />

                              </div>

                            );

                          }
                        )}

                      </div>

                    </div>

                  )}

                </div>

              );

            }
          )}

        </div>

      )}

    </section>

  );

}


function OverrideSelect({

  value,
  onChange,
  compact =
    false,

}: {

  value:
    string;

  onChange:
    (
      value:
        string
    ) => void;

  compact?:
    boolean;

}) {

  return (

    <select
      value={
        value
      }
      onChange={
        event =>
          onChange(
            event.target.value
          )
      }
      className={`rounded-[7px] border border-slate-200 bg-white px-2 text-slate-700 outline-none focus:border-violet-300 ${compact ? 'h-7 text-[7px]' : 'h-8 text-[8px]'}`}
    >
      <option value="default">
        Inherit
      </option>
      <option value="enabled">
        Allow
      </option>
      <option value="disabled">
        Deny
      </option>
    </select>

  );

}


function AccessState({

  label,
  enabled,

}: {

  label:
    string;

  enabled:
    boolean;

}) {

  return (

    <div>

      <div
        className="
          text-[7px]
          font-semibold
          uppercase
          tracking-[0.08em]
          text-slate-400
        "
      >
        {label}
      </div>


      <div
        className={`mt-1 text-[8px] font-semibold ${enabled ? 'text-emerald-700' : 'text-slate-400'}`}
      >
        {enabled
          ? 'Enabled'
          : 'Disabled'}
      </div>

    </div>

  );

}


function TinyState({

  enabled,

}: {

  enabled:
    boolean;

}) {

  return (

    <span
      className={`text-[7px] font-semibold ${enabled ? 'text-emerald-700' : 'text-slate-400'}`}
    >
      {enabled
        ? 'Yes'
        : 'No'}
    </span>

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