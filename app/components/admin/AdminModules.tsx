'use client';

import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  Boxes,
  ChevronRight,
  CircleGauge,
  GitBranch,
  Megaphone,
  PackageSearch,
  RefreshCw,
  Repeat2,
  Search,
  Sparkles,
  XCircle,
} from 'lucide-react';


// ============================================================
// TYPES
// ============================================================

type AdminModule = {

  moduleId:
    string;

  moduleName:
    string;

  description:
    string | null;

  moduleType:
    string | null;

  category:
    string | null;

  routeKey:
    string | null;

  status:
    string;

  setupRequired:
    boolean;

  createdAt:
    string | null;

  updatedAt:
    string | null;

  enabledPlans:
    number;

  totalPlanRows:
    number;

  clientOverrides:
    number;

  enabledOverrides:
    number;

  disabledOverrides:
    number;

};


type AdminModulesResponse = {

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

    standard:
      number;

    custom:
      number;

    setupRequired:
      number;

    planAssignments:
      number;

    clientOverrides:
      number;

  };

  modules?:
    AdminModule[];

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


type TypeFilter =
  | 'all'
  | 'standard'
  | 'custom';


type SetupFilter =
  | 'all'
  | 'required'
  | 'not_required';


// ============================================================
// MAIN
// ============================================================

export default function AdminModules() {


  // ==========================================================
  // SERVER DATA
  // ==========================================================

  const [
    data,
    setData,
  ] =
    useState<
      AdminModulesResponse |
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
    typeFilter,
    setTypeFilter,
  ] =
    useState<TypeFilter>(
      'all'
    );


  const [
    categoryFilter,
    setCategoryFilter,
  ] =
    useState(
      'all'
    );


  const [
    setupFilter,
    setSetupFilter,
  ] =
    useState<SetupFilter>(
      'all'
    );


  const [
    selectedModuleId,
    setSelectedModuleId,
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

  async function loadModules() {

    setLoading(
      true
    );


    setError(
      null
    );


    try {

      const response =
        await fetch(
          '/api/admin/modules',
          {

            cache:
              'no-store',

            credentials:
              'same-origin',

          }
        );


      const json:
        AdminModulesResponse =
          await response.json();


      if (
        !response.ok
        ||
        !json.ok
      ) {

        throw new Error(
          json.error
          ||
          'Unable to load Admin Modules'
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
        'ADMIN_MODULES_UI_ERROR',
        error
      );


      setData(
        null
      );


      setError(
        String(
          error?.message
          ||
          'Unable to load Admin Modules'
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

      loadModules();

    },
    []
  );


  // ==========================================================
  // MODULES
  // ==========================================================

  const modules =
    data?.modules
    ||
    [];


  // ==========================================================
  // CATEGORIES
  // ==========================================================

  const categories =
    useMemo(
      () => {

        return Array
          .from(
            new Set(
              modules
                .map(
                  module =>
                    module.category
                )
                .filter(
                  Boolean
                ) as string[]
            )
          )
          .sort();

      },
      [
        modules,
      ]
    );


  // ==========================================================
  // FILTERED MODULES
  // ==========================================================

  const filteredModules =
    useMemo(
      () => {

        const query =
          search
            .trim()
            .toLowerCase();


        return modules.filter(
          module => {


            // --------------------------------------------------
            // STATUS
            // --------------------------------------------------

            if (
              statusFilter !==
                'all'
            ) {

              const active =
                normalize(
                  module.status
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
            // TYPE
            // --------------------------------------------------

            if (
              typeFilter !==
                'all'
              &&
              normalize(
                module.moduleType
              ) !==
                typeFilter
            ) {

              return false;

            }


            // --------------------------------------------------
            // CATEGORY
            // --------------------------------------------------

            if (
              categoryFilter !==
                'all'
              &&
              module.category !==
                categoryFilter
            ) {

              return false;

            }


            // --------------------------------------------------
            // SETUP
            // --------------------------------------------------

            if (
              setupFilter ===
                'required'
              &&
              !module.setupRequired
            ) {

              return false;

            }


            if (
              setupFilter ===
                'not_required'
              &&
              module.setupRequired
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

                module.moduleId,
                module.moduleName,
                module.description,
                module.moduleType,
                module.category,
                module.routeKey,
                module.status,

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
        modules,
        search,
        statusFilter,
        typeFilter,
        categoryFilter,
        setupFilter,
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
        modules.length,

      active:
        modules.filter(
          module =>
            normalize(
              module.status
            ) ===
            'active'
        ).length,

      inactive:
        modules.filter(
          module =>
            normalize(
              module.status
            ) !==
            'active'
        ).length,

      standard:
        modules.filter(
          module =>
            normalize(
              module.moduleType
            ) ===
            'standard'
        ).length,

      custom:
        modules.filter(
          module =>
            normalize(
              module.moduleType
            ) ===
            'custom'
        ).length,

      setupRequired:
        modules.filter(
          module =>
            module.setupRequired
        ).length,

      planAssignments:
        modules.reduce(
          (
            total,
            module
          ) =>
            total
            +
            module.enabledPlans,
          0
        ),

      clientOverrides:
        modules.reduce(
          (
            total,
            module
          ) =>
            total
            +
            module.clientOverrides,
          0
        ),

    };


  // ==========================================================
  // SELECTED MODULE
  // ==========================================================

  const selectedModule =
    modules.find(
      module =>
        module.moduleId ===
        selectedModuleId
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

        <p className="text-[10px] text-slate-500">
          Loading Modules...
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
                Unable to load Modules
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
              loadModules
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
    selectedModule
  ) {

    return (

      <ModuleDetail

        module={
          selectedModule
        }

        onBack={() =>
          setSelectedModuleId(
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
            Module Registry
          </h2>


          <p
            className="
              mt-0.5
              text-[10px]
              text-slate-500
            "
          >
            Canonical registry of Growth OS capabilities and their entitlement usage.
          </p>

        </div>


        <button

          type="button"

          onClick={
            loadModules
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
          label="Modules"
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
          label="Standard"
          value={
            summary.standard
          }
          tone="violet"
        />


        <SummaryCard
          label="Custom"
          value={
            summary.custom
          }
          tone="amber"
        />


        <SummaryCard
          label="Setup Required"
          value={
            summary.setupRequired
          }
          tone="amber"
        />


        <SummaryCard
          label="Plan Assignments"
          value={
            summary.planAssignments
          }
        />


        <SummaryCard
          label="Client Overrides"
          value={
            summary.clientOverrides
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

            placeholder="Search module, route, category..."

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
            typeFilter
          }

          onChange={
            event =>
              setTypeFilter(
                event.target.value as TypeFilter
              )
          }

          className="gos-input"
        >

          <option value="all">
            All Types
          </option>

          <option value="standard">
            Standard
          </option>

          <option value="custom">
            Custom
          </option>

        </select>


        <select

          value={
            categoryFilter
          }

          onChange={
            event =>
              setCategoryFilter(
                event.target.value
              )
          }

          className="gos-input"
        >

          <option value="all">
            All Categories
          </option>


          {categories.map(
            category => (

              <option
                key={
                  category
                }
                value={
                  category
                }
              >
                {formatLabel(
                  category
                )}
              </option>

            )
          )}

        </select>


        <select

          value={
            setupFilter
          }

          onChange={
            event =>
              setSetupFilter(
                event.target.value as SetupFilter
              )
          }

          className="gos-input"
        >

          <option value="all">
            All Setup
          </option>

          <option value="required">
            Setup Required
          </option>

          <option value="not_required">
            No Setup Required
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
          {filteredModules.length}
          {' / '}
          {modules.length}
          {' modules'}
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
              Modules
            </h3>


            <p
              className="
                mt-0.5
                text-[9px]
                text-slate-500
              "
            >
              Registry definitions only. Client and user entitlement are separate downstream layers.
            </p>

          </div>


          {(
            search
            ||
            statusFilter !==
              'all'
            ||
            typeFilter !==
              'all'
            ||
            categoryFilter !==
              'all'
            ||
            setupFilter !==
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

                setTypeFilter(
                  'all'
                );

                setCategoryFilter(
                  'all'
                );

                setSetupFilter(
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
              min-w-[1250px]
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
                  Type
                </TableHeader>

                <TableHeader>
                  Category
                </TableHeader>

                <TableHeader>
                  Status
                </TableHeader>

                <TableHeader>
                  Setup
                </TableHeader>

                <TableHeader>
                  Plans
                </TableHeader>

                <TableHeader>
                  Overrides
                </TableHeader>

                <TableHeader>
                  Route
                </TableHeader>

                <TableHeader align="right">
                  Action
                </TableHeader>

              </tr>

            </thead>


            <tbody>

              {filteredModules.map(
                module => (

                  <tr

                    key={
                      module.moduleId
                    }

                    className="
                      border-b
                      border-slate-100
                      last:border-0
                      hover:bg-slate-50/70
                    "
                  >


                    {/* MODULE */}

                    <td className="px-3 py-2.5">

                      <div
                        className="
                          flex
                          items-center
                          gap-2.5
                        "
                      >

                        <ModuleIcon
                          moduleId={
                            module.moduleId
                          }
                          type={
                            module.moduleType
                          }
                        />


                        <div className="min-w-0">

                          <div
                            className="
                              text-[10px]
                              font-semibold
                              text-slate-900
                            "
                          >
                            {module.moduleName}
                          </div>


                          <div
                            className="
                              mt-0.5
                              max-w-[320px]
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

                        </div>

                      </div>

                    </td>


                    {/* TYPE */}

                    <td className="px-3 py-2.5">

                      <TypeBadge
                        type={
                          module.moduleType
                        }
                      />

                    </td>


                    {/* CATEGORY */}

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


                    {/* STATUS */}

                    <td className="px-3 py-2.5">

                      <StatusBadge
                        status={
                          module.status
                        }
                      />

                    </td>


                    {/* SETUP */}

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


                    {/* PLANS */}

                    <td
                      className="
                        px-3
                        py-2.5
                        text-[10px]
                        font-semibold
                        text-slate-800
                      "
                    >
                      {module.enabledPlans}
                      {' / '}
                      {module.totalPlanRows}
                    </td>


                    {/* OVERRIDES */}

                    <td
                      className="
                        px-3
                        py-2.5
                        text-[10px]
                        font-semibold
                        text-slate-800
                      "
                    >
                      {module.clientOverrides}
                    </td>


                    {/* ROUTE */}

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


                    {/* ACTION */}

                    <td className="px-3 py-2.5 text-right">

                      <button

                        type="button"

                        onClick={() =>
                          setSelectedModuleId(
                            module.moduleId
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


              {filteredModules.length ===
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
                    No modules match the selected filters.
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
          Source of truth: growthos_control.modules, plan_modules and brand_module_overrides. Admin Modules is read-only during this architecture phase.
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
// MODULE DETAIL
// ============================================================

function ModuleDetail({

  module,

  onBack,

}: {

  module:
    AdminModule;

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


            <ModuleIcon
              moduleId={
                module.moduleId
              }
              type={
                module.moduleType
              }
              large
            />


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
                  {module.moduleName}
                </h2>


                <TypeBadge
                  type={
                    module.moduleType
                  }
                />


                <StatusBadge
                  status={
                    module.status
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
                {module.description
                  ||
                  module.moduleId}
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
          label="Plans Enabled"
          value={
            module.enabledPlans
          }
          tone="violet"
        />


        <SummaryCard
          label="Plan Rows"
          value={
            module.totalPlanRows
          }
        />


        <SummaryCard
          label="Client Overrides"
          value={
            module.clientOverrides
          }
          tone={
            module.clientOverrides >
              0
              ? 'amber'
              : 'slate'
          }
        />


        <SummaryCard
          label="Setup"
          value={
            module.setupRequired
              ? 'Required'
              : 'Not Required'
          }
          tone={
            module.setupRequired
              ? 'amber'
              : 'green'
          }
        />

      </section>


      {/* =====================================================
          IDENTITY
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
            Module Identity
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Module ID"
              value={
                module.moduleId
              }
              mono
            />


            <ValueRow
              label="Module Name"
              value={
                module.moduleName
              }
            />


            <ValueRow
              label="Type"
              value={
                formatLabelOrDash(
                  module.moduleType
                )
              }
            />


            <ValueRow
              label="Status"
              value={
                formatLabel(
                  module.status
                )
              }
            />

          </div>

        </section>


        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Navigation
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Category"
              value={
                formatLabelOrDash(
                  module.category
                )
              }
            />


            <ValueRow
              label="Route Key"
              value={
                module.routeKey
                ||
                '—'
              }
              mono
            />


            <ValueRow
              label="Setup Required"
              value={
                module.setupRequired
                  ? 'Yes'
                  : 'No'
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
          {module.description
            ||
            'No module description configured.'}
        </p>

      </section>


      {/* =====================================================
          ENTITLEMENT USAGE
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
            Plan Entitlement
          </h3>


          <p
            className="
              mt-0.5
              text-[9px]
              text-slate-500
            "
          >
            How this module is currently represented across canonical plans.
          </p>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Enabled Plans"
              value={
                formatNumber(
                  module.enabledPlans
                )
              }
              strong
            />


            <ValueRow
              label="Total Plan Rows"
              value={
                formatNumber(
                  module.totalPlanRows
                )
              }
            />

          </div>

        </section>


        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Client Overrides
          </h3>


          <p
            className="
              mt-0.5
              text-[9px]
              text-slate-500
            "
          >
            Explicit brand-level deviations from normal plan entitlement.
          </p>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Total Overrides"
              value={
                formatNumber(
                  module.clientOverrides
                )
              }
            />


            <ValueRow
              label="Enabled Overrides"
              value={
                formatNumber(
                  module.enabledOverrides
                )
              }
            />


            <ValueRow
              label="Disabled Overrides"
              value={
                formatNumber(
                  module.disabledOverrides
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
                module.createdAt
              )
              ||
              '—'
            }
          />


          <ValueRow
            label="Updated"
            value={
              formatTimestamp(
                module.updatedAt
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
          Module registry ownership
        </p>


        <p
          className="
            mt-1
            text-[8px]
            leading-4
            text-violet-600
          "
        >
          Modules define which capabilities exist in Growth OS. Plans determine commercial entitlement, client overrides adjust brand-level access, and user-level permissions will be implemented separately when we return to the client access system.
        </p>

      </section>

    </div>

  );

}


// ============================================================
// MODULE ICON
// ============================================================

function ModuleIcon({

  moduleId,

  type,

  large =
    false,

}: {

  moduleId:
    string;

  type:
    string |
    null;

  large?:
    boolean;

}) {

  let Icon =
    Boxes;


  if (
    moduleId ===
    'command-center'
  ) {

    Icon =
      CircleGauge;

  }


  if (
    moduleId ===
    'meta'
  ) {

    Icon =
      Megaphone;

  }


  if (
    moduleId ===
    'google'
  ) {

    Icon =
      Search;

  }


  if (
    moduleId ===
    'attribution'
  ) {

    Icon =
      GitBranch;

  }


  if (
    moduleId ===
    'retention'
  ) {

    Icon =
      Repeat2;

  }


  if (
    moduleId ===
    'product'
  ) {

    Icon =
      PackageSearch;

  }


  if (
    normalize(
      type
    ) ===
    'custom'
  ) {

    Icon =
      Sparkles;

  }


  const custom =
    normalize(
      type
    ) ===
    'custom';


  return (

    <div
      className={`
        flex
        shrink-0
        items-center
        justify-center
        rounded-[9px]

        ${
          custom
            ? 'bg-amber-50 text-amber-600'
            : 'bg-violet-50 text-violet-600'
        }

        ${
          large
            ? 'h-9 w-9'
            : 'h-8 w-8'
        }
      `}
    >

      <Icon
        size={
          large
            ? 17
            : 15
        }
      />

    </div>

  );

}


// ============================================================
// TYPE BADGE
// ============================================================

function TypeBadge({

  type,

}: {

  type:
    string |
    null;

}) {

  const custom =
    normalize(
      type
    ) ===
    'custom';


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
          custom

            ? `
              border-amber-200
              bg-amber-50
              text-amber-700
            `

            : `
              border-violet-200
              bg-violet-50
              text-violet-700
            `
        }
      `}
    >
      {formatLabelOrDash(
        type
      )}
    </span>

  );

}


// ============================================================
// STATUS BADGE
// ============================================================

function StatusBadge({

  status,

}: {

  status:
    string;

}) {

  const active =
    normalize(
      status
    ) ===
    'active';


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
          active

            ? `
              border-emerald-200
              bg-emerald-50
              text-emerald-700
            `

            : `
              border-slate-200
              bg-slate-100
              text-slate-600
            `
        }
      `}
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