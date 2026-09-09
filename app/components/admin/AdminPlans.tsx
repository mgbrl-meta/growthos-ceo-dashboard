'use client';

import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  ChevronRight,
  CreditCard,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';


// ============================================================
// TYPES
// ============================================================

type AdminPlanModule = {

  moduleId:
    string;

  moduleName:
    string | null;

  description:
    string | null;

  category:
    string | null;

  routeKey:
    string | null;

  moduleStatus:
    string | null;

  setupRequired:
    boolean;

  enabled:
    boolean;

};


type AdminPlan = {

  planId:
    string;

  planName:
    string;

  description:
    string | null;

  status:
    string;

  monthlyOrderLimit:
    number | null;

  maxUsers:
    number | null;

  createdAt:
    string | null;

  updatedAt:
    string | null;

  assignedClients:
    number;

  enabledModules:
    number;

  totalModules:
    number;

  modules:
    AdminPlanModule[];

};


type AdminPlansResponse = {

  ok:
    boolean;

  scope?:
    string;

  summary?: {

    total:
      number;

    active:
      number;

    inactive:
      number;

    assignedClients:
      number;

    unassignedPlans:
      number;

  };

  plans?:
    AdminPlan[];

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
  | 'inactive';


type AssignmentFilter =
  | 'all'
  | 'assigned'
  | 'unassigned';


// ============================================================
// MAIN
// ============================================================

export default function AdminPlans() {


  // ==========================================================
  // SERVER DATA
  // ==========================================================

  const [
    data,
    setData,
  ] =
    useState<
      AdminPlansResponse |
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
    assignmentFilter,
    setAssignmentFilter,
  ] =
    useState<AssignmentFilter>(
      'all'
    );


  const [
    selectedPlanId,
    setSelectedPlanId,
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

  async function loadPlans() {

    setLoading(
      true
    );


    setError(
      null
    );


    try {

      const response =
        await fetch(
          '/api/admin/plans',
          {

            cache:
              'no-store',

            credentials:
              'same-origin',

          }
        );


      const json:
        AdminPlansResponse =
          await response.json();


      if (
        !response.ok
        ||
        !json.ok
      ) {

        throw new Error(
          json.error
          ||
          'Unable to load Admin Plans'
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
        'ADMIN_PLANS_UI_ERROR',
        error
      );


      setData(
        null
      );


      setError(
        String(
          error?.message
          ||
          'Unable to load Admin Plans'
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

      loadPlans();

    },
    []
  );


  // ==========================================================
  // PLANS
  // ==========================================================

  const plans =
    data?.plans
    ||
    [];


  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredPlans =
    useMemo(
      () => {

        const query =
          search
            .trim()
            .toLowerCase();


        return plans.filter(
          plan => {


            // --------------------------------------------------
            // STATUS
            // --------------------------------------------------

            if (
              statusFilter !==
                'all'
            ) {

              const active =
                normalizeStatus(
                  plan.status
                ) ===
                'active';


              if (
                statusFilter ===
                  'active'
                &&
                !active
              ) {

                return false;

              }


              if (
                statusFilter ===
                  'inactive'
                &&
                active
              ) {

                return false;

              }

            }


            // --------------------------------------------------
            // ASSIGNMENT
            // --------------------------------------------------

            if (
              assignmentFilter ===
                'assigned'
              &&
              plan.assignedClients ===
                0
            ) {

              return false;

            }


            if (
              assignmentFilter ===
                'unassigned'
              &&
              plan.assignedClients >
                0
            ) {

              return false;

            }


            // --------------------------------------------------
            // SEARCH
            // --------------------------------------------------

            if (!query) {

              return true;

            }


            const moduleText =
              plan.modules
                .map(
                  module =>
                    [

                      module.moduleId,
                      module.moduleName,
                      module.category,
                      module.routeKey,

                    ]
                      .filter(
                        Boolean
                      )
                      .join(
                        ' '
                      )
                )
                .join(
                  ' '
                );


            const haystack =
              [

                plan.planId,
                plan.planName,
                plan.description,
                plan.status,
                moduleText,

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
        plans,
        search,
        statusFilter,
        assignmentFilter,
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
        plans.length,

      active:
        plans.filter(
          plan =>
            normalizeStatus(
              plan.status
            ) ===
            'active'
        ).length,

      inactive:
        plans.filter(
          plan =>
            normalizeStatus(
              plan.status
            ) !==
            'active'
        ).length,

      assignedClients:
        plans.reduce(
          (
            total,
            plan
          ) =>
            total
            +
            plan.assignedClients,
          0
        ),

      unassignedPlans:
        plans.filter(
          plan =>
            plan.assignedClients ===
            0
        ).length,

    };


  // ==========================================================
  // SELECTED PLAN
  // ==========================================================

  const selectedPlan =
    plans.find(
      plan =>
        plan.planId ===
        selectedPlanId
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
          Loading Plans...
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
                Unable to load Plans
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
              loadPlans
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
    selectedPlan
  ) {

    return (

      <PlanDetail

        plan={
          selectedPlan
        }

        onBack={() =>
          setSelectedPlanId(
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
            Growth OS Plans
          </h2>


          <p
            className="
              mt-0.5

              text-[10px]

              text-slate-500
            "
          >
            Canonical commercial plans, usage limits and module entitlements.
          </p>

        </div>


        <button

          type="button"

          onClick={
            loadPlans
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

          md:grid-cols-5
        "
      >

        <SummaryCard
          label="Plans"
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
          label="Inactive"
          value={
            summary.inactive
          }
          tone="slate"
        />


        <SummaryCard
          label="Assigned Clients"
          value={
            summary.assignedClients
          }
          tone="violet"
        />


        <SummaryCard
          label="Unassigned Plans"
          value={
            summary.unassignedPlans
          }
          tone="amber"
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

            xl:max-w-[360px]
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

            placeholder="Search plan, module, category..."

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

          <option value="inactive">
            Inactive
          </option>

        </select>


        <select

          value={
            assignmentFilter
          }

          onChange={
            event =>
              setAssignmentFilter(
                event.target.value as AssignmentFilter
              )
          }

          className="gos-input"
        >

          <option value="all">
            All Assignments
          </option>

          <option value="assigned">
            Assigned
          </option>

          <option value="unassigned">
            Unassigned
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
          {filteredPlans.length}
          {' / '}
          {plans.length}
          {' plans'}
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
              Plans
            </h3>


            <p
              className="
                mt-0.5

                text-[9px]

                text-slate-500
              "
            >
              Commercial entitlement definitions from the Growth OS control plane.
            </p>

          </div>


          {(
            search
            ||
            statusFilter !==
              'all'
            ||
            assignmentFilter !==
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

                setAssignmentFilter(
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
              min-w-[1150px]

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
                  Status
                </TableHeader>

                <TableHeader>
                  Orders / Month
                </TableHeader>

                <TableHeader>
                  User Limit
                </TableHeader>

                <TableHeader>
                  Enabled Modules
                </TableHeader>

                <TableHeader>
                  Clients
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

              {filteredPlans.map(
                plan => (

                  <tr

                    key={
                      plan.planId
                    }

                    className="
                      border-b
                      border-slate-100

                      last:border-0

                      hover:bg-slate-50/70
                    "
                  >


                    {/* PLAN */}

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
                          <CreditCard
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
                            {plan.planName}
                          </div>


                          <div
                            className="
                              mt-0.5

                              max-w-[340px]

                              truncate

                              text-[8px]

                              text-slate-500
                            "
                            title={
                              plan.description
                              ||
                              ''
                            }
                          >
                            {plan.description
                              ||
                              plan.planId}
                          </div>

                        </div>

                      </div>

                    </td>


                    {/* STATUS */}

                    <td className="px-3 py-2.5">

                      <PlanStatusBadge
                        status={
                          plan.status
                        }
                      />

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
                      {formatLimit(
                        plan.monthlyOrderLimit,
                        'orders'
                      )}
                    </td>


                    {/* USERS */}

                    <td
                      className="
                        px-3
                        py-2.5

                        text-[10px]
                        font-semibold

                        text-slate-700
                      "
                    >
                      {plan.maxUsers ===
                        null

                        ? 'Unlimited'

                        : formatNumber(
                            plan.maxUsers
                          )}
                    </td>


                    {/* MODULES */}

                    <td
                      className="
                        px-3
                        py-2.5

                        text-[10px]
                        font-semibold

                        text-slate-800
                      "
                    >
                      {plan.enabledModules}
                      {' / '}
                      {plan.totalModules}
                    </td>


                    {/* CLIENTS */}

                    <td
                      className="
                        px-3
                        py-2.5

                        text-[10px]
                        font-semibold

                        text-slate-800
                      "
                    >
                      {plan.assignedClients}
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
                        plan.createdAt
                      )
                      ||
                      '—'}
                    </td>


                    {/* ACTION */}

                    <td className="px-3 py-2.5 text-right">

                      <button

                        type="button"

                        onClick={() =>
                          setSelectedPlanId(
                            plan.planId
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


              {filteredPlans.length ===
                0 && (

                <tr>

                  <td

                    colSpan={
                      8
                    }

                    className="
                      px-4
                      py-14

                      text-center

                      text-[10px]

                      text-slate-500
                    "
                  >
                    No plans match the selected filters.
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
          Source of truth: growthos_control.plans, plan_modules, modules and brand_subscriptions. Admin Plans is read-only during this architecture phase.
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
// PLAN DETAIL
// ============================================================

function PlanDetail({

  plan,

  onBack,

}: {

  plan:
    AdminPlan;

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
              <CreditCard
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
                  {plan.planName}
                </h2>


                <PlanStatusBadge
                  status={
                    plan.status
                  }
                />

              </div>


              <p
                className="
                  mt-0.5

                  max-w-3xl

                  text-[9px]

                  text-slate-500
                "
              >
                {plan.description
                  ||
                  plan.planId}
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
          label="Orders / Month"
          value={
            formatLimit(
              plan.monthlyOrderLimit,
              'orders'
            )
          }
        />


        <SummaryCard
          label="User Limit"
          value={
            plan.maxUsers ===
              null

              ? 'Unlimited'

              : formatNumber(
                  plan.maxUsers
                )
          }
        />


        <SummaryCard
          label="Enabled Modules"
          value={
            `${plan.enabledModules} / ${plan.totalModules}`
          }
          tone="violet"
        />


        <SummaryCard
          label="Assigned Clients"
          value={
            plan.assignedClients
          }
          tone={
            plan.assignedClients >
              0

              ? 'green'

              : 'amber'
          }
        />

      </section>


      {/* =====================================================
          PLAN IDENTITY
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
            Plan
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Plan ID"
              value={
                plan.planId
              }
              mono
            />


            <ValueRow
              label="Plan Name"
              value={
                plan.planName
              }
            />


            <ValueRow
              label="Status"
              value={
                formatLabel(
                  plan.status
                )
              }
            />


            <ValueRow
              label="Assigned Clients"
              value={
                formatNumber(
                  plan.assignedClients
                )
              }
            />

          </div>

        </section>


        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Commercial Limits
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Monthly Orders"
              value={
                formatLimit(
                  plan.monthlyOrderLimit,
                  'orders'
                )
              }
              strong
            />


            <ValueRow
              label="Maximum Users"
              value={
                plan.maxUsers ===
                  null

                  ? 'Unlimited'

                  : formatNumber(
                      plan.maxUsers
                    )
              }
            />


            <ValueRow
              label="Enabled Modules"
              value={
                formatNumber(
                  plan.enabledModules
                )
              }
            />


            <ValueRow
              label="Registry Modules"
              value={
                formatNumber(
                  plan.totalModules
                )
              }
            />

          </div>

        </section>

      </section>


      {/* =====================================================
          DESCRIPTION
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <h3 className="gos-section-title">
          Description
        </h3>


        <p
          className="
            mt-2

            text-[10px]
            leading-5

            text-slate-600
          "
        >
          {plan.description
            ||
            'No plan description configured.'}
        </p>

      </section>


      {/* =====================================================
          MODULE ENTITLEMENT
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
            Module Entitlement
          </h3>


          <p
            className="
              mt-0.5

              text-[9px]

              text-slate-500
            "
          >
            Canonical module access defined by this plan.
          </p>

        </div>


        <div className="overflow-x-auto">

          <table
            className="
              w-full
              min-w-[1100px]

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
                  Module
                </TableHeader>

                <TableHeader>
                  Category
                </TableHeader>

                <TableHeader>
                  Route
                </TableHeader>

                <TableHeader>
                  Module Status
                </TableHeader>

                <TableHeader>
                  Setup
                </TableHeader>

                <TableHeader>
                  Plan Access
                </TableHeader>

              </tr>

            </thead>


            <tbody>

              {plan.modules.map(
                module => (

                  <tr

                    key={
                      module.moduleId
                    }

                    className="
                      border-b
                      border-slate-100

                      last:border-0
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
                        {module.moduleName
                          ||
                          module.moduleId}
                      </div>


                      <div
                        className="
                          mt-0.5

                          max-w-[360px]

                          truncate

                          text-[8px]

                          text-slate-500
                        "
                        title={
                          module.description
                          ||
                          ''
                        }
                      >
                        {module.description
                          ||
                          module.moduleId}
                      </div>

                    </td>


                    <td
                      className="
                        px-3
                        py-2.5

                        text-[9px]
                        font-medium

                        text-slate-600
                      "
                    >
                      {formatLabelOrDash(
                        module.category
                      )}
                    </td>


                    <td
                      className="
                        px-3
                        py-2.5

                        font-mono
                        text-[8px]

                        text-slate-500
                      "
                    >
                      {module.routeKey
                        ||
                        '—'}
                    </td>


                    <td className="px-3 py-2.5">

                      <SimpleBadge
                        label={
                          formatLabelOrDash(
                            module.moduleStatus
                          )
                        }
                        tone={
                          normalizeStatus(
                            module.moduleStatus
                          ) ===
                            'active'

                            ? 'green'

                            : 'slate'
                        }
                      />

                    </td>


                    <td className="px-3 py-2.5">

                      <SimpleBadge
                        label={
                          module.setupRequired

                            ? 'Required'

                            : 'No Setup'
                        }
                        tone={
                          module.setupRequired

                            ? 'amber'

                            : 'slate'
                        }
                      />

                    </td>


                    <td className="px-3 py-2.5">

                      <SimpleBadge
                        label={
                          module.enabled

                            ? 'Enabled'

                            : 'Disabled'
                        }
                        tone={
                          module.enabled

                            ? 'green'

                            : 'slate'
                        }
                      />

                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        </div>

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
                plan.createdAt
              )
              ||
              '—'
            }
          />


          <ValueRow
            label="Updated"
            value={
              formatTimestamp(
                plan.updatedAt
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
          Commercial entitlement ownership
        </p>


        <p
          className="
            mt-1

            text-[8px]
            leading-4

            text-violet-600
          "
        >
          This screen reflects the canonical Growth OS plan registry. Plan creation, pricing-limit changes, status changes and module-entitlement mutations are intentionally disabled until dedicated authenticated Admin command APIs are introduced.
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
    | 'violet'
    | 'slate';

}) {


  const cls =
    tone ===
      'green'

      ? 'text-emerald-700'

      : tone ===
          'amber'

        ? 'text-amber-700'

        : tone ===
            'violet'

          ? 'text-violet-700'

          : tone ===
              'slate'

            ? 'text-slate-500'

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
// PLAN STATUS
// ============================================================

function PlanStatusBadge({

  status,

}: {

  status:
    string;

}) {


  const normalized =
    normalizeStatus(
      status
    );


  if (
    normalized ===
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
        status
      )}
    </span>

  );

}


// ============================================================
// SIMPLE BADGE
// ============================================================

function SimpleBadge({

  label,

  tone,

}: {

  label:
    string;

  tone:
    | 'green'
    | 'amber'
    | 'slate';

}) {


  const cls =
    tone ===
      'green'

      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'

      : tone ===
          'amber'

        ? 'border-amber-200 bg-amber-50 text-amber-700'

        : 'border-slate-200 bg-slate-100 text-slate-600';


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

        ${cls}
      `}
    >
      {label}
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

function normalizeStatus(
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


function formatLimit(

  value:
    number |
    null,

  suffix:
    string

) {

  if (
    value ===
    null
  ) {

    return 'Unlimited';

  }


  return `${formatNumber(
    value
  )} ${suffix}`;

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