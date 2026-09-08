'use client';

import {
  type ReactNode,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Database,
  ExternalLink,
  Plus,
  Plug,
  Search,
  X,
} from 'lucide-react';

import {
  type AdminClient,
  type ClientStatus,
  type ModuleOverride,
  type SetupStatus,
  useAdminStore,
} from './AdminStore';

import AdminClientUsers
  from './AdminClientUsers';

import AdminClientIntegrations
  from './AdminClientIntegrations';  

import AdminClientDataSetup
  from './AdminClientDataSetup';  


// ============================================================
// TYPES
// ============================================================

type DetailTab =
  | 'Overview'
  | 'Modules'
  | 'Users'
  | 'Integrations'
  | 'Data Setup';


type OrderOverrideMode =
  | 'default'
  | 'custom'
  | 'unlimited';


// ============================================================
// MAIN
// ============================================================

export default function AdminClients() {


  // ==========================================================
  // SHARED ADMIN STORE
  // ==========================================================

  const {
    clients,
    setClients,
    plans,
    modules,
    getPlan,
    getClientModuleAccess,
    getClientOrderLimit,
    getClientUserCount,
    getClientIntegrationCount,
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
    selectedClientId,
    setSelectedClientId,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const [
    detailTab,
    setDetailTab,
  ] =
    useState<DetailTab>(
      'Overview'
    );


  const [
    addOpen,
    setAddOpen,
  ] =
    useState(
      false
    );


  // ==========================================================
  // NEW CLIENT
  // ==========================================================

  const [
    newClientName,
    setNewClientName,
  ] =
    useState(
      ''
    );


  const [
    newClientDomain,
    setNewClientDomain,
  ] =
    useState(
      ''
    );


  const [
    newPlanId,
    setNewPlanId,
  ] =
    useState(
      'starter'
    );


  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredClients =
    useMemo(
      () => {

        const query =
          search
            .trim()
            .toLowerCase();


        if (!query) {

          return clients;

        }


        return clients.filter(
          client => {

            const plan =
              getPlan(
                client.planId
              );


            return (

              client.name
                .toLowerCase()
                .includes(
                  query
                )

              ||

              client.domain
                .toLowerCase()
                .includes(
                  query
                )

              ||

              (
                plan?.name ||
                ''
              )
                .toLowerCase()
                .includes(
                  query
                )

            );

          }
        );

      },
      [
        clients,
        plans,
        search,
      ]
    );


  // ==========================================================
  // SELECTED CLIENT
  // ==========================================================

  const selectedClient =
    clients.find(
      client =>
        client.id ===
        selectedClientId
    )
    ||
    null;


  // ==========================================================
  // ENABLED MODULE COUNT
  // ==========================================================

  function getEnabledModuleCount(
    client:
      AdminClient
  ) {

    return modules.filter(
      module =>
        getClientModuleAccess(
          client,
          module.id
        ).enabled
    ).length;

  }


  // ==========================================================
  // CREATE CLIENT
  // ==========================================================

  function createClient() {

    const name =
      newClientName.trim();


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


    const client:
      AdminClient = {

      id:
        `${slug}-${Date.now()}`,

      name,

      slug,

      domain:
        newClientDomain.trim(),

      planId:
        newPlanId,

      status:
        'setup',

      // ------------------------------------------------------
      // Legacy compatibility fields.
      //
      // Real counts are calculated from AdminStore registries.
      // ------------------------------------------------------

      users:
        0,

      integrations:
        0,

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

      moduleOverrides:
        {},

    };


    setClients(
      previous => [
        client,
        ...previous,
      ]
    );


    setAddOpen(
      false
    );


    setNewClientName(
      ''
    );


    setNewClientDomain(
      ''
    );


    setNewPlanId(
      plans[0]?.id ||
      'starter'
    );


    setSelectedClientId(
      client.id
    );


    setDetailTab(
      'Overview'
    );

  }


  // ==========================================================
  // UPDATE CLIENT
  // ==========================================================

  function updateClient(
    updatedClient:
      AdminClient
  ) {

    setClients(
      previous =>
        previous.map(
          client =>

            client.id ===
              updatedClient.id

              ? updatedClient

              : client
        )
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

        activeTab={
          detailTab
        }

        setActiveTab={
          setDetailTab
        }

        onBack={() => {

          setSelectedClientId(
            null
          );


          setDetailTab(
            'Overview'
          );

        }}

        onChange={
          updateClient
        }

      />

    );

  }


  // ==========================================================
  // CLIENT LIST
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

        <div className="min-w-0">

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
            Manage plans, order allowances, modules, users and integrations.
          </p>

        </div>


        <div
          className="
            flex
            flex-col
            gap-2

            sm:flex-row
            sm:items-center
          "
        >

          <div
            className="
              relative
              w-full

              sm:w-[260px]
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

              placeholder="Search clients"

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

            onClick={() => {

              setNewPlanId(
                plans[0]?.id ||
                ''
              );


              setAddOpen(
                true
              );

            }}

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

            Add Client

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
          label="Total Clients"
          value={
            clients.length
          }
        />


        <SummaryCard
          label="Active"
          value={
            clients.filter(
              client =>
                client.status ===
                'active'
            ).length
          }
        />


        <SummaryCard
          label="Setup Required"
          value={
            clients.filter(
              client =>
                client.status ===
                'setup'
            ).length
          }
        />


        <SummaryCard
          label="Suspended"
          value={
            clients.filter(
              client =>
                client.status ===
                'suspended'
            ).length
          }
        />

      </section>


      {/* =====================================================
          CLIENT TABLE
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
            Clients
          </h3>


          <p
            className="
              mt-0.5

              text-[9px]

              text-slate-500
            "
          >
            {filteredClients.length} workspace{filteredClients.length === 1 ? '' : 's'}
          </p>

        </div>


        <div className="overflow-x-auto">

          <table
            className="
              min-w-[1100px]
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
                  Status
                </TableHeader>

                <TableHeader>
                  Plan
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
                  Integrations
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
                client => {

                  const plan =
                    getPlan(
                      client.planId
                    );


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
                                text-[11px]
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

                                text-[9px]

                                text-slate-500
                              "
                            >
                              {client.domain ||
                                'No domain configured'}
                            </div>

                          </div>

                        </div>

                      </td>


                      <td className="px-3 py-2">

                        <ClientStatusBadge
                          status={
                            client.status
                          }
                        />

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
                        {getEnabledModuleCount(
                          client
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


                      <td
                        className="
                          px-3
                          py-2

                          text-[9px]

                          text-slate-500
                        "
                      >
                        {client.createdAt}
                      </td>


                      <td className="px-3 py-2 text-right">

                        <button

                          type="button"

                          onClick={() => {

                            setSelectedClientId(
                              client.id
                            );


                            setDetailTab(
                              'Overview'
                            );

                          }}

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

                  );

                }
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
                      py-10

                      text-center
                      text-[10px]

                      text-slate-500
                    "
                  >
                    No clients found.
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </section>


      {/* =====================================================
          ADD CLIENT
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
                  Add Client
                </h3>


                <p
                  className="
                    mt-0.5

                    text-[9px]

                    text-slate-500
                  "
                >
                  Create a new Growth OS client workspace.
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
                label="Client Name"
              >

                <input

                  value={
                    newClientName
                  }

                  onChange={
                    event =>
                      setNewClientName(
                        event.target.value
                      )
                  }

                  placeholder="Example: Brillare"

                  className="gos-input w-full"

                />

              </FormField>


              <FormField
                label="Store / Domain"
              >

                <input

                  value={
                    newClientDomain
                  }

                  onChange={
                    event =>
                      setNewClientDomain(
                        event.target.value
                      )
                  }

                  placeholder="example.com"

                  className="gos-input w-full"

                />

              </FormField>


              <FormField
                label="Plan"
              >

                <select

                  value={
                    newPlanId
                  }

                  onChange={
                    event =>
                      setNewPlanId(
                        event.target.value
                      )
                  }

                  className="gos-input w-full"

                >

                  {plans.map(
                    plan => (

                      <option
                        key={
                          plan.id
                        }
                        value={
                          plan.id
                        }
                      >
                        {plan.name}
                        {' · '}
                        {formatOrderLimit(
                          plan.monthlyOrderLimit
                        )}
                      </option>

                    )
                  )}

                </select>

              </FormField>

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
                  !newClientName.trim()
                  ||
                  !newPlanId
                }

                onClick={
                  createClient
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
                Create Client
              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}


// ============================================================
// CLIENT DETAIL
// ============================================================

function ClientDetail({

  client,

  activeTab,

  setActiveTab,

  onBack,

  onChange,

}: {

  client:
    AdminClient;

  activeTab:
    DetailTab;

  setActiveTab:
    (
      tab:
        DetailTab
    ) => void;

  onBack:
    () => void;

  onChange:
    (
      client:
        AdminClient
    ) => void;

}) {


  const {
    plans,
    modules,
    getPlan,
    getClientModuleAccess,
    getClientOrderLimit,
    getClientUserCount,
    getClientIntegrationCount,
  } =
    useAdminStore();


  const plan =
    getPlan(
      client.planId
    );


  const tabs:
    DetailTab[] = [

    'Overview',
    'Modules',
    'Users',
    'Integrations',
    'Data Setup',

  ];


  const enabledModuleCount =
    modules.filter(
      module =>
        getClientModuleAccess(
          client,
          module.id
        ).enabled
    ).length;


  // ==========================================================
  // MODULE OVERRIDE
  // ==========================================================

  function setModuleOverride(

    moduleId:
      string,

    override:
      ModuleOverride

  ) {

    // --------------------------------------------------------
    // Command Center remains mandatory.
    // --------------------------------------------------------

    if (
      moduleId ===
      'command-center'
    ) {

      return;

    }


    onChange({

      ...client,

      moduleOverrides: {

        ...client.moduleOverrides,

        [moduleId]:
          override,

      },

    });

  }


  // ==========================================================
  // ORDER OVERRIDE MODE
  // ==========================================================

  const orderOverrideMode:
    OrderOverrideMode =

    client.monthlyOrderLimitOverride ===
      undefined

      ? 'default'

      : client.monthlyOrderLimitOverride ===
          null

        ? 'unlimited'

        : 'custom';


  function setOrderOverrideMode(
    mode:
      OrderOverrideMode
  ) {

    if (
      mode ===
      'default'
    ) {

      onChange({

        ...client,

        monthlyOrderLimitOverride:
          undefined,

      });


      return;

    }


    if (
      mode ===
      'unlimited'
    ) {

      onChange({

        ...client,

        monthlyOrderLimitOverride:
          null,

      });


      return;

    }


    onChange({

      ...client,

      monthlyOrderLimitOverride:

        typeof client.monthlyOrderLimitOverride ===
          'number'

          ? client.monthlyOrderLimitOverride

          : plan?.monthlyOrderLimit
            ??
            10000,

    });

  }


  // ==========================================================
  // UI
  // ==========================================================

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
                  {client.name}
                </h2>


                <ClientStatusBadge
                  status={
                    client.status
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
                {client.domain ||
                  'No domain configured'}
                {' · '}
                {plan?.name ||
                  'No Plan'}
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
                client.status
              }

              onChange={
                event =>
                  onChange({

                    ...client,

                    status:
                      event.target.value as ClientStatus,

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
                font-medium

                text-slate-700
              "
            >

              <option value="active">
                Active
              </option>

              <option value="setup">
                Setup Required
              </option>

              <option value="suspended">
                Suspended
              </option>

            </select>


            <button

              type="button"

              disabled

              title="Client workspace connection will be added after admin completion"

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

                text-[10px]
                font-semibold

                text-slate-400
              "
            >

              <ExternalLink
                size={13}
              />

              Open Workspace

            </button>

          </div>

        </div>

      </section>


      {/* =====================================================
          DETAIL NAV
      ===================================================== */}

      <section
        className="
          gos-card

          flex
          gap-1

          overflow-x-auto

          p-1
        "
      >

        {tabs.map(
          tab => (

            <button

              key={
                tab
              }

              type="button"

              onClick={() =>
                setActiveTab(
                  tab
                )
              }

              className={`
                h-8
                shrink-0

                rounded-[8px]

                px-3

                text-[10px]
                font-semibold

                transition

                ${
                  activeTab ===
                    tab

                    ? `
                      bg-slate-950
                      text-white
                    `

                    : `
                      text-slate-500

                      hover:bg-slate-100
                      hover:text-slate-900
                    `
                }
              `}
            >
              {tab}
            </button>

          )
        )}

      </section>


      {/* =====================================================
          OVERVIEW
      ===================================================== */}

      {activeTab ===
        'Overview' && (

        <div className="space-y-3">


          {/* ===============================================
              SUMMARY
          =============================================== */}

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
                plan?.name ||
                'None'
              }
            />


            <SummaryCard
              label="Orders / Month"
              value={
                formatOrderLimit(
                  getClientOrderLimit(
                    client
                  )
                )
              }
            />


            <SummaryCard
              label="Modules"
              value={
                enabledModuleCount
              }
            />


            <SummaryCard
              label="Users"
              value={
                getClientUserCount(
                  client.id
                )
              }
            />

          </section>


          {/* ===============================================
              COMMERCIAL ACCESS
          =============================================== */}

          <section className="gos-panel !p-3.5">

            <h3 className="gos-section-title">
              Commercial Access
            </h3>


            <p
              className="
                mt-0.5

                text-[9px]

                text-slate-500
              "
            >
              Assign the plan and optionally override this client's monthly order allowance.
            </p>


            <div
              className="
                mt-3

                grid
                grid-cols-1
                gap-3

                lg:grid-cols-3
              "
            >

              <FormField
                label="Assigned Plan"
              >

                <select

                  value={
                    client.planId
                  }

                  onChange={
                    event =>
                      onChange({

                        ...client,

                        planId:
                          event.target.value,

                      })
                  }

                  className="gos-input w-full"

                >

                  {plans.map(
                    item => (

                      <option
                        key={
                          item.id
                        }
                        value={
                          item.id
                        }
                      >
                        {item.name}
                        {' · '}
                        {formatOrderLimit(
                          item.monthlyOrderLimit
                        )}
                      </option>

                    )
                  )}

                </select>

              </FormField>


              <FormField
                label="Order Limit Rule"
              >

                <select

                  value={
                    orderOverrideMode
                  }

                  onChange={
                    event =>
                      setOrderOverrideMode(
                        event.target.value as OrderOverrideMode
                      )
                  }

                  className="gos-input w-full"

                >

                  <option value="default">
                    Use Plan Default
                  </option>

                  <option value="custom">
                    Custom Limit
                  </option>

                  <option value="unlimited">
                    Unlimited
                  </option>

                </select>

              </FormField>


              <FormField
                label="Custom Monthly Limit"
              >

                <input

                  type="number"

                  min="1"

                  disabled={
                    orderOverrideMode !==
                    'custom'
                  }

                  value={

                    typeof client.monthlyOrderLimitOverride ===
                      'number'

                      ? client.monthlyOrderLimitOverride

                      : ''

                  }

                  placeholder={
                    orderOverrideMode ===
                      'custom'

                      ? 'Enter monthly orders'

                      : 'Not applicable'
                  }

                  onChange={
                    event =>
                      onChange({

                        ...client,

                        monthlyOrderLimitOverride:
                          parsePositiveNumber(
                            event.target.value
                          ),

                      })
                  }

                  className="
                    gos-input
                    w-full

                    disabled:cursor-not-allowed
                    disabled:bg-slate-100
                    disabled:text-slate-400
                  "

                />

              </FormField>

            </div>


            <div
              className="
                mt-3

                grid
                grid-cols-1
                gap-2

                md:grid-cols-3
              "
            >

              <ValueRow
                label="Plan Default"
                value={
                  formatOrderLimit(
                    plan?.monthlyOrderLimit ??
                    null
                  )
                }
              />


              <ValueRow
                label="Client Override"
                value={
                  formatClientOverride(
                    client.monthlyOrderLimitOverride
                  )
                }
              />


              <ValueRow
                label="Final Allowance"
                value={
                  formatOrderLimit(
                    getClientOrderLimit(
                      client
                    )
                  )
                }
                strong
              />

            </div>

          </section>


          {/* ===============================================
              WORKSPACE + ACCESS SUMMARY
          =============================================== */}

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
                Workspace
              </h3>


              <div className="mt-3 space-y-2">

                <ValueRow
                  label="Client"
                  value={
                    client.name
                  }
                />


                <ValueRow
                  label="Workspace ID"
                  value={
                    client.slug
                  }
                />


                <ValueRow
                  label="Domain"
                  value={
                    client.domain ||
                    'Not configured'
                  }
                />


                <ValueRow
                  label="Created"
                  value={
                    client.createdAt
                  }
                />

              </div>

            </section>


            <section className="gos-panel !p-3.5">

              <h3 className="gos-section-title">
                Access Summary
              </h3>


              <div className="mt-3 space-y-2">

                <ValueRow
                  label="Final Module Access"
                  value={
                    String(
                      enabledModuleCount
                    )
                  }
                />


                <ValueRow
                  label="Users"
                  value={
                    String(
                      getClientUserCount(
                        client.id
                      )
                    )
                  }
                />


                <ValueRow
                  label="Integrations"
                  value={
                    String(
                      getClientIntegrationCount(
                        client.id
                      )
                    )
                  }
                />


                <ValueRow
                  label="Status"
                  value={
                    formatClientStatus(
                      client.status
                    )
                  }
                />

              </div>

            </section>

          </section>

        </div>

      )}


      {/* =====================================================
          MODULES
      ===================================================== */}

      {activeTab ===
        'Modules' && (

        <ClientModules

          client={
            client
          }

          onSetOverride={
            setModuleOverride
          }

        />

      )}


      {/* =====================================================
          USERS
      ===================================================== */}

      {activeTab ===
        'Users' && (

        <AdminClientUsers
          client={
            client
          }
        />

      )}


      {/* =====================================================
          INTEGRATIONS
          
          We will replace this with AdminClientIntegrations
          in the next step.
      ===================================================== */}

      {activeTab ===
        'Integrations' && (

        <AdminClientIntegrations
          client={
            client
          }
        />

      )}


      {/* =====================================================
          DATA SETUP
      ===================================================== */}

      {activeTab ===
        'Data Setup' && (

        <AdminClientDataSetup
          client={
            client
          }
        />

      )}

    </div>

  );

}


// ============================================================
// CLIENT MODULES
// ============================================================

function ClientModules({

  client,

  onSetOverride,

}: {

  client:
    AdminClient;

  onSetOverride:
    (
      moduleId:
        string,
      override:
        ModuleOverride
    ) => void;

}) {


  const {
    modules,
    getClientModuleAccess,
  } =
    useAdminStore();


  const enabledCount =
    modules.filter(
      module =>
        getClientModuleAccess(
          client,
          module.id
        ).enabled
    ).length;


  const overrideCount =
    Object
      .values(
        client.moduleOverrides
      )
      .filter(
        value =>
          value !==
          'default'
      )
      .length;


  const customCount =
    modules.filter(
      module =>
        module.type ===
          'custom'
        &&
        getClientModuleAccess(
          client,
          module.id
        ).enabled
    ).length;


  return (

    <div className="space-y-3">


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
          label="Registry Modules"
          value={
            modules.length
          }
        />


        <SummaryCard
          label="Final Access"
          value={
            enabledCount
          }
        />


        <SummaryCard
          label="Overrides"
          value={
            overrideCount
          }
        />


        <SummaryCard
          label="Custom Modules"
          value={
            customCount
          }
        />

      </section>


      {/* =====================================================
          ENTITLEMENT TABLE
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
            Plan inclusion sets the default. Client overrides can explicitly enable or disable modules.
          </p>

        </div>


        <div className="overflow-x-auto">

          <table
            className="
              min-w-[950px]
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
                  Plan Default
                </TableHeader>

                <TableHeader>
                  Client Override
                </TableHeader>

                <TableHeader>
                  Final Access
                </TableHeader>

                <TableHeader>
                  Module Status
                </TableHeader>

                <TableHeader>
                  Setup
                </TableHeader>

              </tr>

            </thead>


            <tbody>

              {modules.map(
                module => {

                  const access =
                    getClientModuleAccess(
                      client,
                      module.id
                    );


                  const mandatory =
                    module.id ===
                    'command-center';


                  return (

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

                        <div>

                          <div
                            className="
                              flex
                              items-center
                              gap-2
                            "
                          >

                            <span
                              className="
                                text-[10px]
                                font-semibold

                                text-slate-900
                              "
                            >
                              {module.name}
                            </span>


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

                              max-w-[300px]

                              truncate

                              text-[8px]

                              text-slate-500
                            "
                          >
                            {module.description}
                          </p>

                        </div>

                      </td>


                      <td className="px-3 py-2">

                        <SimpleBadge
                          label={
                            module.type ===
                              'custom'

                              ? 'Custom'

                              : 'Standard'
                          }
                          tone={
                            module.type ===
                              'custom'

                              ? 'amber'

                              : 'violet'
                          }
                        />

                      </td>


                      <td className="px-3 py-2">

                        <AccessBadge
                          enabled={
                            access.planIncluded
                          }
                          enabledLabel="Included"
                          disabledLabel="Not Included"
                        />

                      </td>


                      <td className="px-3 py-2">

                        {mandatory ? (

                          <span
                            className="
                              text-[9px]
                              font-medium

                              text-slate-400
                            "
                          >
                            Required
                          </span>

                        ) : (

                          <select

                            value={
                              access.override
                            }

                            onChange={
                              event =>
                                onSetOverride(
                                  module.id,
                                  event.target.value as ModuleOverride
                                )
                            }

                            className="
                              h-7

                              rounded-[7px]

                              border
                              border-slate-300

                              bg-white

                              px-2

                              text-[9px]
                              font-medium

                              text-slate-700
                            "
                          >

                            <option value="default">
                              Plan Default
                            </option>

                            <option value="enabled">
                              Force Enable
                            </option>

                            <option value="disabled">
                              Force Disable
                            </option>

                          </select>

                        )}

                      </td>


                      <td className="px-3 py-2">

                        <AccessBadge
                          enabled={
                            access.enabled
                          }
                          enabledLabel="Enabled"
                          disabledLabel="Disabled"
                        />

                      </td>


                      <td className="px-3 py-2">

                        <SimpleBadge
                          label={
                            capitalize(
                              module.status
                            )
                          }
                          tone={
                            module.status ===
                              'active'

                              ? 'green'

                              : module.status ===
                                  'draft'

                                ? 'amber'

                                : 'red'
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

                    </tr>

                  );

                }
              )}

            </tbody>

          </table>

        </div>

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
// CLIENT STATUS
// ============================================================

function ClientStatusBadge({

  status,

}: {

  status:
    ClientStatus;

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
          'setup'

        ? {
            label:
              'Setup Required',

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
// ACCESS BADGE
// ============================================================

function AccessBadge({

  enabled,

  enabledLabel,

  disabledLabel,

}: {

  enabled:
    boolean;

  enabledLabel:
    string;

  disabledLabel:
    string;

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

            ? `
              border-emerald-200
              bg-emerald-50
              text-emerald-700
            `

            : `
              border-slate-200
              bg-slate-100
              text-slate-500
            `
        }
      `}
    >
      {enabled
        ? enabledLabel
        : disabledLabel
      }
    </span>

  );

}


// ============================================================
// GENERIC BADGE
// ============================================================

function SimpleBadge({

  label,

  tone,

}: {

  label:
    string;

  tone:
    'green'
    |
    'amber'
    |
    'red'
    |
    'violet'
    |
    'slate';

}) {

  const classes =
    tone ===
      'green'

      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'

      : tone ===
          'amber'

        ? 'border-amber-200 bg-amber-50 text-amber-700'

        : tone ===
            'red'

          ? 'border-red-200 bg-red-50 text-red-700'

          : tone ===
              'violet'

            ? 'border-violet-200 bg-violet-50 text-violet-700'

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

        ${classes}
      `}
    >
      {label}
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
// VALUE ROW
// ============================================================

function ValueRow({

  label,

  value,

  strong =
    false,

}: {

  label:
    string;

  value:
    string;

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
          text-[9px]

          text-slate-500
        "
      >
        {label}
      </span>


      <span
        className={`
          text-[10px]
          font-semibold

          ${
            strong

              ? 'text-violet-700'

              : 'text-slate-800'
          }
        `}
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
// PLACEHOLDER
// ============================================================

function SectionPlaceholder({

  icon:
    Icon,

  title,

  description,

  action,

}: {

  icon:
    any;

  title:
    string;

  description:
    string;

  action:
    string;

}) {

  return (

    <section className="gos-panel !p-3.5">

      <div
        className="
          flex
          flex-col
          gap-3

          sm:flex-row
          sm:items-center
          sm:justify-between
        "
      >

        <div
          className="
            flex
            items-center
            gap-3
          "
        >

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

            <Icon
              size={16}
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

                max-w-2xl

                text-[9px]
                leading-4

                text-slate-500
              "
            >
              {description}
            </p>

          </div>

        </div>


        <button

          type="button"

          disabled

          className="
            h-8
            shrink-0

            rounded-[8px]

            bg-slate-100

            px-3

            text-[9px]
            font-semibold

            text-slate-400
          "
        >
          {action}
        </button>

      </div>

    </section>

  );

}


// ============================================================
// HELPERS
// ============================================================

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


  return `${new Intl.NumberFormat(
    'en-IN',
    {
      maximumFractionDigits:
        0,
    }
  ).format(
    value
  )} orders`;

}


function formatClientOverride(
  value:
    number |
    null |
    undefined
) {

  if (
    value ===
    undefined
  ) {

    return 'Plan Default';

  }


  if (
    value ===
    null
  ) {

    return 'Unlimited';

  }


  return formatOrderLimit(
    value
  );

}


function parsePositiveNumber(
  value:
    string
) {

  const parsed =
    Number(
      value
    );


  if (
    !Number.isFinite(
      parsed
    )
    ||
    parsed <=
      0
  ) {

    return undefined;

  }


  return Math.floor(
    parsed
  );

}


function formatClientStatus(
  status:
    ClientStatus
) {

  if (
    status ===
    'active'
  ) {

    return 'Active';

  }


  if (
    status ===
    'setup'
  ) {

    return 'Setup Required';

  }


  return 'Suspended';

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