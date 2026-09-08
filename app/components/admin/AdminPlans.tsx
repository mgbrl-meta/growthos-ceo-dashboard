'use client';

import {
  type ReactNode,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  Check,
  ChevronRight,
  CreditCard,
  Plus,
  Search,
  X,
} from 'lucide-react';

import {
  type AdminPlan,
  type PlanStatus,
  useAdminStore,
} from './AdminStore';


// ============================================================
// MAIN
// ============================================================

export default function AdminPlans() {

  // ==========================================================
  // SHARED ADMIN STORE
  // ==========================================================

  const {
    plans,
    setPlans,
    modules,
    clients,
  } =
    useAdminStore();


  // ==========================================================
  // LOCAL UI STATE
  // ==========================================================

  const [
    search,
    setSearch,
  ] =
    useState(
      ''
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


  const [
    addOpen,
    setAddOpen,
  ] =
    useState(
      false
    );


  // ==========================================================
  // NEW PLAN
  // ==========================================================

  const [
    newName,
    setNewName,
  ] =
    useState(
      ''
    );


  const [
    newDescription,
    setNewDescription,
  ] =
    useState(
      ''
    );


  const [
    newMonthlyOrderLimit,
    setNewMonthlyOrderLimit,
  ] =
    useState(
      '2500'
    );


  const [
    newMaxUsers,
    setNewMaxUsers,
  ] =
    useState(
      '5'
    );


  // ==========================================================
  // SEARCH
  // ==========================================================

  const filteredPlans =
    useMemo(
      () => {

        const query =
          search
            .trim()
            .toLowerCase();


        if (!query) {

          return plans;

        }


        return plans.filter(
          plan =>

            plan.name
              .toLowerCase()
              .includes(
                query
              )

            ||

            plan.description
              .toLowerCase()
              .includes(
                query
              )

            ||

            formatOrderLimit(
              plan.monthlyOrderLimit
            )
              .toLowerCase()
              .includes(
                query
              )

        );

      },
      [
        plans,
        search,
      ]
    );


  // ==========================================================
  // SELECTED PLAN
  // ==========================================================

  const selectedPlan =
    plans.find(
      plan =>
        plan.id ===
        selectedPlanId
    )
    ||
    null;


  // ==========================================================
  // PLAN CLIENT COUNT
  // ==========================================================

  function getPlanClientCount(
    planId:
      string
  ) {

    return clients.filter(
      client =>
        client.planId ===
        planId
    ).length;

  }


  // ==========================================================
  // CREATE PLAN
  // ==========================================================

  function createPlan() {

    const name =
      newName.trim();


    if (!name) {

      return;

    }


    const slug =
      name
        .toLowerCase()
        .replace(
          /[^a-z0-9]+/g,
          '-'
        )
        .replace(
          /^-|-$/g,
          ''
        );


    const plan:
      AdminPlan = {

      id:
        `${slug}-${Date.now()}`,

      name,

      description:
        newDescription.trim(),

      status:
        'draft',

      // Command Center always starts enabled.

      modules: [
        'command-center',
      ],

      monthlyOrderLimit:
        parseNullablePositiveNumber(
          newMonthlyOrderLimit
        ),

      maxUsers:
        parseNullablePositiveNumber(
          newMaxUsers
        ),

      createdAt:
        new Date()
          .toLocaleDateString(
            'en-IN',
            {
              day:
                '2-digit',

              month:
                'short',

              year:
                'numeric',
            }
          ),

    };


    setPlans(
      previous => [
        ...previous,
        plan,
      ]
    );


    setAddOpen(
      false
    );


    setNewName(
      ''
    );


    setNewDescription(
      ''
    );


    setNewMonthlyOrderLimit(
      '2500'
    );


    setNewMaxUsers(
      '5'
    );


    setSelectedPlanId(
      plan.id
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

        availableModules={
          modules
        }

        clientCount={
          getPlanClientCount(
            selectedPlan.id
          )
        }

        onBack={() =>
          setSelectedPlanId(
            null
          )
        }

        onChange={
          updatedPlan => {

            setPlans(
              previous =>
                previous.map(
                  plan =>

                    plan.id ===
                      updatedPlan.id

                      ? updatedPlan

                      : plan
                )
            );

          }
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
          TOOLBAR
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
            Growth OS Plans
          </h2>


          <p
            className="
              mt-0.5

              text-[10px]

              text-slate-500
            "
          >
            Define monthly order volume, module entitlement and user access.
          </p>

        </div>


        <div
          className="
            flex
            flex-col
            gap-2

            sm:flex-row
          "
        >

          <div
            className="
              relative

              w-full

              sm:w-[240px]
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

              placeholder="Search plans"

              className="
                h-8
                w-full

                rounded-[8px]

                border
                border-slate-300

                bg-white

                pl-8
                pr-3

                text-[11px]

                outline-none

                focus:border-violet-400
                focus:ring-2
                focus:ring-violet-100
              "

            />

          </div>


          <button

            type="button"

            onClick={() =>
              setAddOpen(
                true
              )
            }

            className="
              inline-flex
              h-8
              items-center
              justify-center
              gap-1.5

              rounded-[8px]

              bg-slate-950

              px-3

              text-[10px]
              font-semibold

              text-white

              hover:bg-slate-800
            "
          >

            <Plus
              size={14}
            />

            Add Plan

          </button>

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
          label="Plans"
          value={
            plans.length
          }
        />


        <SummaryCard
          label="Active Plans"
          value={
            plans.filter(
              plan =>
                plan.status ===
                'active'
            ).length
          }
        />


        <SummaryCard
          label="Clients Assigned"
          value={
            clients.length
          }
        />


        <SummaryCard
          label="Registry Modules"
          value={
            modules.length
          }
        />

      </section>


      {/* =====================================================
          PLANS TABLE
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
            Plans
          </h3>


          <p
            className="
              mt-0.5

              text-[9px]

              text-slate-500
            "
          >
            {filteredPlans.length} plan{filteredPlans.length === 1 ? '' : 's'}
          </p>

        </div>


        <div className="overflow-x-auto">

          <table
            className="
              min-w-[980px]
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
                  Status
                </TableHeader>

                <TableHeader>
                  Orders / Month
                </TableHeader>

                <TableHeader>
                  Modules
                </TableHeader>

                <TableHeader>
                  Clients
                </TableHeader>

                <TableHeader>
                  User Limit
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
                      plan.id
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
                              text-[11px]
                              font-semibold

                              text-slate-900
                            "
                          >
                            {plan.name}
                          </div>


                          <div
                            className="
                              mt-0.5
                              max-w-[320px]

                              truncate

                              text-[9px]

                              text-slate-500
                            "
                          >
                            {plan.description}
                          </div>

                        </div>

                      </div>

                    </td>


                    <td className="px-3 py-2">

                      <PlanStatusBadge
                        status={
                          plan.status
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
                        plan.monthlyOrderLimit
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
                      {plan.modules.length}
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
                      {getPlanClientCount(
                        plan.id
                      )}
                    </td>


                    <td
                      className="
                        px-3
                        py-2

                        text-[10px]
                        font-medium

                        text-slate-600
                      "
                    >
                      {plan.maxUsers ===
                        null

                        ? 'Unlimited'

                        : formatNumber(
                            plan.maxUsers
                          )
                      }
                    </td>


                    <td
                      className="
                        px-3
                        py-2

                        text-[9px]

                        text-slate-500
                      "
                    >
                      {plan.createdAt}
                    </td>


                    <td className="px-3 py-2 text-right">

                      <button

                        type="button"

                        onClick={() =>
                          setSelectedPlanId(
                            plan.id
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
                        Manage

                        <ChevronRight
                          size={12}
                        />

                      </button>

                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        </div>

      </section>


      {/* =====================================================
          ADD PLAN
      ===================================================== */}

      {addOpen && (

        <div
          className="
            fixed
            inset-0
            z-[100]

            flex
            items-center
            justify-center

            bg-slate-950/40

            p-4

            backdrop-blur-[2px]
          "
        >

          <div
            className="
              w-full
              max-w-[540px]

              rounded-[14px]

              border
              border-slate-200

              bg-white

              shadow-xl
            "
          >

            <div
              className="
                flex
                items-center
                justify-between

                border-b
                border-slate-200

                px-4
                py-3
              "
            >

              <div>

                <h3
                  className="
                    text-[14px]
                    font-semibold

                    text-slate-950
                  "
                >
                  Add Plan
                </h3>


                <p
                  className="
                    mt-0.5

                    text-[9px]

                    text-slate-500
                  "
                >
                  Create a Growth OS plan based on monthly business order volume.
                </p>

              </div>


              <button

                type="button"

                onClick={() =>
                  setAddOpen(
                    false
                  )
                }

                className="
                  flex
                  h-7
                  w-7
                  items-center
                  justify-center

                  rounded-[7px]

                  text-slate-400

                  hover:bg-slate-100
                "
              >

                <X
                  size={15}
                />

              </button>

            </div>


            <div className="space-y-3 p-4">

              <FormField
                label="Plan Name"
              >

                <input

                  value={
                    newName
                  }

                  onChange={
                    event =>
                      setNewName(
                        event.target.value
                      )
                  }

                  placeholder="Example: Growth Pro"

                  className="gos-input w-full"

                />

              </FormField>


              <FormField
                label="Description"
              >

                <input

                  value={
                    newDescription
                  }

                  onChange={
                    event =>
                      setNewDescription(
                        event.target.value
                      )
                  }

                  placeholder="Plan description"

                  className="gos-input w-full"

                />

              </FormField>


              <div
                className="
                  grid
                  grid-cols-1
                  gap-3

                  md:grid-cols-2
                "
              >

                <FormField
                  label="Monthly Order Limit"
                  hint="Blank = Unlimited"
                >

                  <input

                    type="number"

                    min="1"

                    value={
                      newMonthlyOrderLimit
                    }

                    onChange={
                      event =>
                        setNewMonthlyOrderLimit(
                          event.target.value
                        )
                    }

                    placeholder="Unlimited"

                    className="gos-input w-full"

                  />

                </FormField>


                <FormField
                  label="Maximum Users"
                  hint="Blank = Unlimited"
                >

                  <input

                    type="number"

                    min="1"

                    value={
                      newMaxUsers
                    }

                    onChange={
                      event =>
                        setNewMaxUsers(
                          event.target.value
                        )
                    }

                    placeholder="Unlimited"

                    className="gos-input w-full"

                  />

                </FormField>

              </div>

            </div>


            <div
              className="
                flex
                justify-end
                gap-2

                border-t
                border-slate-200

                px-4
                py-3
              "
            >

              <button

                type="button"

                onClick={() =>
                  setAddOpen(
                    false
                  )
                }

                className="
                  h-8

                  rounded-[8px]

                  border
                  border-slate-200

                  px-3

                  text-[10px]
                  font-semibold

                  text-slate-600
                "
              >
                Cancel
              </button>


              <button

                type="button"

                disabled={
                  !newName.trim()
                }

                onClick={
                  createPlan
                }

                className="
                  h-8

                  rounded-[8px]

                  bg-slate-950

                  px-3

                  text-[10px]
                  font-semibold

                  text-white

                  disabled:opacity-40
                "
              >
                Create Plan
              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}


// ============================================================
// PLAN DETAIL
// ============================================================

function PlanDetail({

  plan,

  availableModules,

  clientCount,

  onBack,

  onChange,

}: {

  plan:
    AdminPlan;

  availableModules:
    ReturnType<
      typeof useAdminStore
    >['modules'];

  clientCount:
    number;

  onBack:
    () => void;

  onChange:
    (
      plan:
        AdminPlan
    ) => void;

}) {


  // ==========================================================
  // MODULE TOGGLE
  // ==========================================================

  function toggleModule(
    moduleId:
      string
  ) {

    // Command Center is mandatory.

    if (
      moduleId ===
      'command-center'
    ) {

      return;

    }


    const enabled =
      plan.modules.includes(
        moduleId
      );


    onChange({

      ...plan,

      modules:
        enabled

          ? plan.modules.filter(
              id =>
                id !==
                moduleId
            )

          : [
              ...plan.modules,
              moduleId,
            ],

    });

  }


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
                  {plan.name}
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

                  text-[9px]

                  text-slate-500
                "
              >
                {plan.description}
              </p>

            </div>

          </div>


          <select

            value={
              plan.status
            }

            onChange={
              event =>
                onChange({

                  ...plan,

                  status:
                    event.target.value as PlanStatus,

                })
            }

            className="
              h-8

              rounded-[8px]

              border
              border-slate-300

              bg-white

              px-2.5

              text-[10px]
            "
          >

            <option value="active">
              Active
            </option>

            <option value="draft">
              Draft
            </option>

            <option value="archived">
              Archived
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

          md:grid-cols-4
        "
      >

        <SummaryCard
          label="Orders / Month"
          value={
            formatOrderLimit(
              plan.monthlyOrderLimit
            )
          }
        />


        <SummaryCard
          label="Modules"
          value={
            plan.modules.length
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
          label="Clients"
          value={
            clientCount
          }
        />

      </section>


      {/* =====================================================
          BUSINESS VOLUME
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <h3 className="gos-section-title">
          Business Volume
        </h3>


        <p
          className="
            mt-0.5

            text-[9px]

            text-slate-500
          "
        >
          Monthly orders are the commercial volume allowance for this plan.
        </p>


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
            label="Monthly Order Limit"
            hint="Blank = Unlimited"
          >

            <input

              type="number"

              min="1"

              value={
                plan.monthlyOrderLimit ??
                ''
              }

              placeholder="Unlimited"

              onChange={
                event =>
                  onChange({

                    ...plan,

                    monthlyOrderLimit:
                      parseNullablePositiveNumber(
                        event.target.value
                      ),

                  })
              }

              className="gos-input w-full"

            />

          </FormField>


          <div
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
                font-semibold
                uppercase
                tracking-[0.06em]

                text-violet-600
              "
            >
              Current Allowance
            </p>


            <p
              className="
                mt-1

                text-[17px]
                font-semibold
                tracking-[-0.03em]

                text-violet-950
              "
            >
              {formatOrderLimit(
                plan.monthlyOrderLimit
              )}
            </p>

          </div>

        </div>

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
            Modules now come directly from the shared Admin Module Registry.
          </p>

        </div>


        <div
          className="
            grid
            grid-cols-1

            lg:grid-cols-2
          "
        >

          {availableModules.map(
            module => {

              const enabled =
                plan.modules.includes(
                  module.id
                );


              const mandatory =
                module.id ===
                'command-center';


              return (

                <button

                  key={
                    module.id
                  }

                  type="button"

                  onClick={() =>
                    toggleModule(
                      module.id
                    )
                  }

                  className="
                    flex
                    items-center
                    justify-between
                    gap-4

                    border-b
                    border-slate-100

                    px-3
                    py-3

                    text-left

                    hover:bg-slate-50
                  "
                >

                  <div className="min-w-0">

                    <div
                      className="
                        flex
                        flex-wrap
                        items-center
                        gap-2
                      "
                    >

                      <div
                        className="
                          text-[11px]
                          font-semibold

                          text-slate-900
                        "
                      >
                        {module.name}
                      </div>


                      {module.type ===
                        'custom' && (

                        <span
                          className="
                            rounded-full

                            bg-amber-50

                            px-1.5
                            py-0.5

                            text-[7px]
                            font-semibold

                            text-amber-700
                          "
                        >
                          Custom
                        </span>

                      )}


                      {mandatory && (

                        <span
                          className="
                            rounded-full

                            bg-slate-100

                            px-1.5
                            py-0.5

                            text-[7px]
                            font-semibold

                            text-slate-500
                          "
                        >
                          Required
                        </span>

                      )}

                    </div>


                    <p
                      className="
                        mt-0.5

                        text-[9px]
                        leading-4

                        text-slate-500
                      "
                    >
                      {module.description}
                    </p>

                  </div>


                  <div
                    className={`
                      flex
                      h-6
                      w-6
                      shrink-0
                      items-center
                      justify-center

                      rounded-[7px]

                      border

                      ${
                        enabled

                          ? `
                            border-violet-500
                            bg-violet-500
                            text-white
                          `

                          : `
                            border-slate-300
                            bg-white
                            text-transparent
                          `
                      }
                    `}
                  >

                    <Check
                      size={13}
                    />

                  </div>

                </button>

              );

            }
          )}

        </div>

      </section>


      {/* =====================================================
          PLAN SETTINGS
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <h3 className="gos-section-title">
          Plan Settings
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
            label="Plan Name"
          >

            <input

              value={
                plan.name
              }

              onChange={
                event =>
                  onChange({

                    ...plan,

                    name:
                      event.target.value,

                  })
              }

              className="gos-input w-full"

            />

          </FormField>


          <FormField
            label="Maximum Users"
            hint="Blank = Unlimited"
          >

            <input

              type="number"

              min="1"

              value={
                plan.maxUsers ??
                ''
              }

              placeholder="Unlimited"

              onChange={
                event =>
                  onChange({

                    ...plan,

                    maxUsers:
                      parseNullablePositiveNumber(
                        event.target.value
                      ),

                  })
              }

              className="gos-input w-full"

            />

          </FormField>


          <div className="md:col-span-2">

            <FormField
              label="Description"
            >

              <input

                value={
                  plan.description
                }

                onChange={
                  event =>
                    onChange({

                      ...plan,

                      description:
                        event.target.value,

                    })
                }

                className="gos-input w-full"

              />

            </FormField>

          </div>

        </div>

      </section>

    </div>

  );

}


// ============================================================
// SMALL COMPONENTS
// ============================================================

function SummaryCard({

  label,

  value,

}: {

  label:
    string;

  value:
    string |
    number;

}) {

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
        className="
          mt-1.5

          text-[18px]
          font-semibold
          tracking-[-0.03em]

          text-slate-950
        "
      >
        {value}
      </p>

    </div>

  );

}


function PlanStatusBadge({

  status,

}: {

  status:
    PlanStatus;

}) {

  const config =

    status ===
      'active'

      ? {
          label:
            'Active',

          cls:
            'border-emerald-200 bg-emerald-50 text-emerald-700',
        }

      : status ===
          'draft'

        ? {
            label:
              'Draft',

            cls:
              'border-amber-200 bg-amber-50 text-amber-700',
          }

        : {
            label:
              'Archived',

            cls:
              'border-slate-200 bg-slate-100 text-slate-600',
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


function FormField({

  label,

  hint,

  children,

}: {

  label:
    string;

  hint?:
    string;

  children:
    ReactNode;

}) {

  return (

    <label className="block">

      <div
        className="
          mb-1.5

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
            uppercase
            tracking-[0.05em]

            text-slate-500
          "
        >
          {label}
        </span>


        {hint && (

          <span
            className="
              text-[8px]

              text-slate-400
            "
          >
            {hint}
          </span>

        )}

      </div>


      {children}

    </label>

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
    Number(
      value ||
      0
    )
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


  return `${formatNumber(
    value
  )} orders`;

}


function parseNullablePositiveNumber(
  value:
    string
) {

  const trimmed =
    value.trim();


  if (!trimmed) {

    return null;

  }


  const parsed =
    Number(
      trimmed
    );


  if (
    !Number.isFinite(
      parsed
    )
    ||
    parsed <=
      0
  ) {

    return null;

  }


  return Math.floor(
    parsed
  );

}