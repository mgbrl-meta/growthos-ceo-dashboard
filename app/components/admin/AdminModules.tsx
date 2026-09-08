'use client';

import {
  type ReactNode,
  useMemo,
  useState,
} from 'react';

import {
  Activity,
  ArrowLeft,
  Boxes,
  ChevronRight,
  CircleGauge,
  GitBranch,
  Megaphone,
  PackageSearch,
  Plus,
  Repeat2,
  Search,
  Sparkles,
  X,
} from 'lucide-react';

import {
  type GrowthModule,
  type ModuleCategory,
  type ModuleStatus,
  type ModuleType,
  type SetupStatus,
  useAdminStore,
} from './AdminStore';


// ============================================================
// MAIN
// ============================================================

export default function AdminModules() {


  // ==========================================================
  // SHARED ADMIN STORE
  // ==========================================================

  const {
    modules,
    setModules,
    plans,
    clients,
    getClientModuleAccess,
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
    selectedModuleId,
    setSelectedModuleId,
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
  // NEW MODULE
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
    newType,
    setNewType,
  ] =
    useState<ModuleType>(
      'custom'
    );


  const [
    newCategory,
    setNewCategory,
  ] =
    useState<ModuleCategory>(
      'custom'
    );


  const [
    newRouteKey,
    setNewRouteKey,
  ] =
    useState(
      ''
    );


  const [
    newSetupRequired,
    setNewSetupRequired,
  ] =
    useState(
      true
    );


  // ==========================================================
  // SEARCH
  // ==========================================================

  const filteredModules =
    useMemo(
      () => {

        const query =
          search
            .trim()
            .toLowerCase();


        if (!query) {

          return modules;

        }


        return modules.filter(
          module =>

            module.name
              .toLowerCase()
              .includes(
                query
              )

            ||

            module.description
              .toLowerCase()
              .includes(
                query
              )

            ||

            module.type
              .toLowerCase()
              .includes(
                query
              )

            ||

            module.category
              .toLowerCase()
              .includes(
                query
              )

        );

      },
      [
        modules,
        search,
      ]
    );


  // ==========================================================
  // SELECTED MODULE
  // ==========================================================

  const selectedModule =
    modules.find(
      module =>
        module.id ===
        selectedModuleId
    )
    ||
    null;


  // ==========================================================
  // COUNTS
  // ==========================================================

  function getPlanCount(
    moduleId:
      string
  ) {

    return plans.filter(
      plan =>
        plan.modules.includes(
          moduleId
        )
    ).length;

  }


  function getClientCount(
    moduleId:
      string
  ) {

    return clients.filter(
      client =>
        getClientModuleAccess(
          client,
          moduleId
        ).enabled
    ).length;

  }


  // ==========================================================
  // CREATE MODULE
  // ==========================================================

  function createModule() {

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


    const id =
      `${slug}-${Date.now()}`;


    const module:
      GrowthModule = {

      id,

      name,

      description:
        newDescription.trim(),

      type:
        newType,

      category:
        newCategory,

      routeKey:
        newRouteKey.trim()
        ||
        name,

      status:
        'draft',

      setupStatus:
        newSetupRequired

          ? 'not_started'

          : 'ready',

      setupRequired:
        newSetupRequired,

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


    setModules(
      previous => [
        ...previous,
        module,
      ]
    );


    resetNewModuleForm();


    setAddOpen(
      false
    );


    setSelectedModuleId(
      id
    );

  }


  // ==========================================================
  // RESET FORM
  // ==========================================================

  function resetNewModuleForm() {

    setNewName(
      ''
    );


    setNewDescription(
      ''
    );


    setNewType(
      'custom'
    );


    setNewCategory(
      'custom'
    );


    setNewRouteKey(
      ''
    );


    setNewSetupRequired(
      true
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

        planCount={
          getPlanCount(
            selectedModule.id
          )
        }

        clientCount={
          getClientCount(
            selectedModule.id
          )
        }

        onBack={() =>
          setSelectedModuleId(
            null
          )
        }

        onChange={
          updatedModule => {

            setModules(
              previous =>
                previous.map(
                  module =>

                    module.id ===
                      updatedModule.id

                      ? updatedModule

                      : module
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
            Module Registry
          </h2>


          <p
            className="
              mt-0.5

              text-[10px]

              text-slate-500
            "
          >
            Master registry for standard and custom Growth OS modules.
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

              sm:w-[250px]
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

              placeholder="Search modules"

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

            Add Module

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
          label="Total Modules"
          value={
            modules.length
          }
        />


        <SummaryCard
          label="Standard"
          value={
            modules.filter(
              module =>
                module.type ===
                'standard'
            ).length
          }
        />


        <SummaryCard
          label="Custom"
          value={
            modules.filter(
              module =>
                module.type ===
                'custom'
            ).length
          }
        />


        <SummaryCard
          label="Ready"
          value={
            modules.filter(
              module =>
                module.setupStatus ===
                'ready'
            ).length
          }
        />

      </section>


      {/* =====================================================
          REGISTRY TABLE
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
            Modules
          </h3>


          <p
            className="
              mt-0.5

              text-[9px]

              text-slate-500
            "
          >
            {filteredModules.length} module{filteredModules.length === 1 ? '' : 's'}
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
                  Clients
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
                      module.id
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

                        <ModuleIcon

                          moduleId={
                            module.id
                          }

                          type={
                            module.type
                          }

                        />


                        <div className="min-w-0">

                          <div
                            className="
                              text-[11px]
                              font-semibold

                              text-slate-900
                            "
                          >
                            {module.name}
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
                            {module.description}
                          </div>

                        </div>

                      </div>

                    </td>


                    <td className="px-3 py-2">

                      <TypeBadge
                        type={
                          module.type
                        }
                      />

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
                      {formatCategory(
                        module.category
                      )}
                    </td>


                    <td className="px-3 py-2">

                      <ModuleStatusBadge
                        status={
                          module.status
                        }
                      />

                    </td>


                    <td className="px-3 py-2">

                      <SetupBadge
                        status={
                          module.setupStatus
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
                      {getPlanCount(
                        module.id
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
                      {getClientCount(
                        module.id
                      )}
                    </td>


                    <td className="px-3 py-2 text-right">

                      <button

                        type="button"

                        onClick={() =>
                          setSelectedModuleId(
                            module.id
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
          ADD MODULE
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
              max-w-[600px]

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
                  Add Module
                </h3>


                <p
                  className="
                    mt-0.5

                    text-[9px]

                    text-slate-500
                  "
                >
                  Register a standard or custom Growth OS module.
                </p>

              </div>


              <button

                type="button"

                onClick={() => {

                  setAddOpen(
                    false
                  );


                  resetNewModuleForm();

                }}

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
                label="Module Name"
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

                  placeholder="Example: Salon OS"

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

                  placeholder="What does this module do?"

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
                  label="Module Type"
                >

                  <select

                    value={
                      newType
                    }

                    onChange={
                      event =>
                        setNewType(
                          event.target.value as ModuleType
                        )
                    }

                    className="gos-input w-full"

                  >

                    <option value="standard">
                      Standard
                    </option>

                    <option value="custom">
                      Custom
                    </option>

                  </select>

                </FormField>


                <FormField
                  label="Sidebar Category"
                >

                  <select

                    value={
                      newCategory
                    }

                    onChange={
                      event =>
                        setNewCategory(
                          event.target.value as ModuleCategory
                        )
                    }

                    className="gos-input w-full"

                  >

                    <option value="workspace">
                      Workspace
                    </option>

                    <option value="growth">
                      Growth
                    </option>

                    <option value="customers">
                      Customers
                    </option>

                    <option value="commerce">
                      Commerce
                    </option>

                    <option value="data">
                      Data
                    </option>

                    <option value="system">
                      System
                    </option>

                    <option value="custom">
                      Custom
                    </option>

                  </select>

                </FormField>

              </div>


              <FormField
                label="Route Key"
                hint="Internal identity"
              >

                <input

                  value={
                    newRouteKey
                  }

                  onChange={
                    event =>
                      setNewRouteKey(
                        event.target.value
                      )
                  }

                  placeholder="Example: Salon OS"

                  className="gos-input w-full"

                />

              </FormField>


              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-4

                  rounded-[9px]

                  border
                  border-slate-200

                  bg-slate-50

                  px-3
                  py-2.5
                "
              >

                <div>

                  <p
                    className="
                      text-[10px]
                      font-semibold

                      text-slate-800
                    "
                  >
                    Setup Required
                  </p>


                  <p
                    className="
                      mt-0.5

                      text-[9px]

                      text-slate-500
                    "
                  >
                    Require initialization before the module becomes usable.
                  </p>

                </div>


                <Toggle

                  checked={
                    newSetupRequired
                  }

                  onChange={
                    setNewSetupRequired
                  }

                />

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

                onClick={() => {

                  setAddOpen(
                    false
                  );


                  resetNewModuleForm();

                }}

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
                  createModule
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
                Create Module
              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}


// ============================================================
// MODULE DETAIL
// ============================================================

function ModuleDetail({

  module,

  planCount,

  clientCount,

  onBack,

  onChange,

}: {

  module:
    GrowthModule;

  planCount:
    number;

  clientCount:
    number;

  onBack:
    () => void;

  onChange:
    (
      module:
        GrowthModule
    ) => void;

}) {


  // ==========================================================
  // SETUP ACTION
  // ==========================================================

  function advanceSetup() {

    if (
      !module.setupRequired
    ) {

      onChange({

        ...module,

        setupStatus:
          'ready',

      });


      return;

    }


    if (
      module.setupStatus ===
        'not_started'
      ||
      module.setupStatus ===
        'setup_required'
    ) {

      onChange({

        ...module,

        setupStatus:
          'configuring',

      });


      return;

    }


    if (
      module.setupStatus ===
        'configuring'
    ) {

      onChange({

        ...module,

        setupStatus:
          'ready',

      });

    }

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

            lg:flex-row
            lg:items-center
            lg:justify-between
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

                hover:bg-slate-50
              "
            >

              <ArrowLeft
                size={14}
              />

            </button>


            <ModuleIcon

              moduleId={
                module.id
              }

              type={
                module.type
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
                  {module.name}
                </h2>


                <TypeBadge
                  type={
                    module.type
                  }
                />


                <ModuleStatusBadge
                  status={
                    module.status
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
                {module.description}
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

            <select

              value={
                module.status
              }

              onChange={
                event =>
                  onChange({

                    ...module,

                    status:
                      event.target.value as ModuleStatus,

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

              <option value="suspended">
                Suspended
              </option>

            </select>


            {module.setupStatus !==
              'ready' && (

              <button

                type="button"

                onClick={
                  advanceSetup
                }

                className="
                  inline-flex
                  h-8
                  items-center
                  gap-1.5

                  rounded-[8px]

                  bg-slate-950

                  px-3

                  text-[10px]
                  font-semibold

                  text-white
                "
              >

                <Activity
                  size={13}
                />

                {module.setupStatus ===
                  'configuring'

                  ? 'Mark Ready'

                  : 'Initiate Setup'
                }

              </button>

            )}

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
          label="Setup"
          value={
            formatSetupStatus(
              module.setupStatus
            )
          }
        />


        <SummaryCard
          label="Plans"
          value={
            planCount
          }
        />


        <SummaryCard
          label="Clients"
          value={
            clientCount
          }
        />


        <SummaryCard
          label="Category"
          value={
            formatCategory(
              module.category
            )
          }
        />

      </section>


      {/* =====================================================
          CONFIGURATION
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <h3 className="gos-section-title">
          Module Configuration
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

          <FormField label="Module Name">

            <input

              value={
                module.name
              }

              onChange={
                event =>
                  onChange({

                    ...module,

                    name:
                      event.target.value,

                  })
              }

              className="gos-input w-full"

            />

          </FormField>


          <FormField label="Route Key">

            <input

              value={
                module.routeKey
              }

              onChange={
                event =>
                  onChange({

                    ...module,

                    routeKey:
                      event.target.value,

                  })
              }

              className="gos-input w-full"

            />

          </FormField>


          <FormField label="Type">

            <select

              value={
                module.type
              }

              onChange={
                event =>
                  onChange({

                    ...module,

                    type:
                      event.target.value as ModuleType,

                  })
              }

              className="gos-input w-full"

            >

              <option value="standard">
                Standard
              </option>

              <option value="custom">
                Custom
              </option>

            </select>

          </FormField>


          <FormField label="Sidebar Category">

            <select

              value={
                module.category
              }

              onChange={
                event =>
                  onChange({

                    ...module,

                    category:
                      event.target.value as ModuleCategory,

                  })
              }

              className="gos-input w-full"

            >

              <option value="workspace">
                Workspace
              </option>

              <option value="growth">
                Growth
              </option>

              <option value="customers">
                Customers
              </option>

              <option value="commerce">
                Commerce
              </option>

              <option value="data">
                Data
              </option>

              <option value="system">
                System
              </option>

              <option value="custom">
                Custom
              </option>

            </select>

          </FormField>


          <div className="md:col-span-2">

            <FormField label="Description">

              <input

                value={
                  module.description
                }

                onChange={
                  event =>
                    onChange({

                      ...module,

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


      {/* =====================================================
          SETUP LIFECYCLE
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <div
          className="
            flex
            items-start
            justify-between
            gap-3
          "
        >

          <div>

            <h3 className="gos-section-title">
              Setup Lifecycle
            </h3>


            <p
              className="
                mt-0.5

                text-[9px]

                text-slate-500
              "
            >
              Determines whether module initialization is required.
            </p>

          </div>


          <SetupBadge
            status={
              module.setupStatus
            }
          />

        </div>


        <div
          className="
            mt-3

            flex
            items-center
            justify-between
            gap-4

            rounded-[9px]

            border
            border-slate-200

            bg-slate-50

            px-3
            py-2.5
          "
        >

          <div>

            <p
              className="
                text-[10px]
                font-semibold

                text-slate-800
              "
            >
              Setup Required
            </p>


            <p
              className="
                mt-0.5

                text-[9px]

                text-slate-500
              "
            >
              Require initialization before client use.
            </p>

          </div>


          <Toggle

            checked={
              module.setupRequired
            }

            onChange={
              checked =>
                onChange({

                  ...module,

                  setupRequired:
                    checked,

                  setupStatus:
                    checked

                      ? module.setupStatus ===
                          'ready'

                        ? 'setup_required'

                        : module.setupStatus

                      : 'ready',

                })
            }

          />

        </div>

      </section>


      {/* =====================================================
          ASSIGNMENT
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <h3 className="gos-section-title">
          Assignment
        </h3>


        <p
          className="
            mt-0.5

            text-[9px]

            text-slate-500
          "
        >
          Counts are calculated live from Plans and Client entitlement.
        </p>


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
            label="Plans Including Module"
            value={
              String(
                planCount
              )
            }
          />


          <ValueRow
            label="Clients With Access"
            value={
              String(
                clientCount
              )
            }
          />

        </div>

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
    ModuleType;

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
    type ===
      'custom'
  ) {

    Icon =
      Sparkles;

  }


  return (

    <div
      className={`
        flex
        shrink-0
        items-center
        justify-center

        rounded-[9px]

        ${
          type ===
            'custom'

            ? `
              bg-amber-50
              text-amber-600
            `

            : `
              bg-violet-50
              text-violet-600
            `
        }

        ${
          large

            ? `
              h-9
              w-9
            `

            : `
              h-8
              w-8
            `
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
    ModuleType;

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
          type ===
            'custom'

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
      {type ===
        'standard'

        ? 'Standard'

        : 'Custom'
      }
    </span>

  );

}


// ============================================================
// MODULE STATUS BADGE
// ============================================================

function ModuleStatusBadge({

  status,

}: {

  status:
    ModuleStatus;

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
              'Suspended',

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
// SETUP BADGE
// ============================================================

function SetupBadge({

  status,

}: {

  status:
    SetupStatus;

}) {

  const config =

    status ===
      'ready'

      ? {
          label:
            'Ready',

          cls:
            'border-emerald-200 bg-emerald-50 text-emerald-700',
        }

      : status ===
          'configuring'

        ? {
            label:
              'Configuring',

            cls:
              'border-blue-200 bg-blue-50 text-blue-700',
          }

        : status ===
            'setup_required'

          ? {
              label:
                'Setup Required',

              cls:
                'border-amber-200 bg-amber-50 text-amber-700',
            }

          : {
              label:
                'Not Started',

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


// ============================================================
// TOGGLE
// ============================================================

function Toggle({

  checked,

  onChange,

}: {

  checked:
    boolean;

  onChange:
    (
      checked:
        boolean
    ) => void;

}) {

  return (

    <button

      type="button"

      role="switch"

      aria-checked={
        checked
      }

      onClick={() =>
        onChange(
          !checked
        )
      }

      className={`
        relative

        h-5
        w-9
        shrink-0

        rounded-full

        p-[2px]

        transition

        ${
          checked

            ? 'bg-violet-500'

            : 'bg-slate-300'
        }
      `}
    >

      <span
        className={`
          block

          h-4
          w-4

          rounded-full

          bg-white

          shadow-sm

          transition-transform

          ${
            checked

              ? 'translate-x-4'

              : 'translate-x-0'
          }
        `}
      />

    </button>

  );

}


// ============================================================
// SUMMARY CARD
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
// FORM FIELD
// ============================================================

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

function formatCategory(
  category:
    ModuleCategory
) {

  const labels:
    Record<
      ModuleCategory,
      string
    > = {

    workspace:
      'Workspace',

    growth:
      'Growth',

    customers:
      'Customers',

    commerce:
      'Commerce',

    data:
      'Data',

    system:
      'System',

    custom:
      'Custom',

  };


  return labels[
    category
  ];

}


function formatSetupStatus(
  status:
    SetupStatus
) {

  const labels:
    Record<
      SetupStatus,
      string
    > = {

    ready:
      'Ready',

    setup_required:
      'Setup Required',

    configuring:
      'Configuring',

    not_started:
      'Not Started',

  };


  return labels[
    status
  ];

}