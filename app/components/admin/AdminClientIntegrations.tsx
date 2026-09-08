'use client';

import {
  type ReactNode,
  useState,
} from 'react';

import {
  ArrowLeft,
  ChevronRight,
  Plug,
  Plus,
  X,
} from 'lucide-react';

import {
  type AdminClient,
  type AdminClientIntegration,
  type IntegrationConnectionStatus,
  type IntegrationDataStatus,
  useAdminStore,
} from './AdminStore';


// ============================================================
// MAIN
// ============================================================

export default function AdminClientIntegrations({

  client,

}: {

  client:
    AdminClient;

}) {


  const {

    integrations,

    setIntegrations,

    integrationProviders,

    getClientIntegrations,

    getIntegrationProvider,

  } =
    useAdminStore();


  // ==========================================================
  // LOCAL UI STATE
  // ==========================================================

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


  const [
    addOpen,
    setAddOpen,
  ] =
    useState(
      false
    );


  // ==========================================================
  // ADD FORM
  // ==========================================================

  const [
    newProviderId,
    setNewProviderId,
  ] =
    useState(
      integrationProviders[0]?.id ||
      ''
    );


  const [
    newAccountName,
    setNewAccountName,
  ] =
    useState(
      ''
    );


  const [
    newExternalAccountId,
    setNewExternalAccountId,
  ] =
    useState(
      ''
    );


  // ==========================================================
  // CLIENT INTEGRATIONS
  // ==========================================================

  const clientIntegrations =
    getClientIntegrations(
      client.id
    );


  const selectedIntegration =
    integrations.find(
      integration =>
        integration.id ===
          selectedIntegrationId
        &&
        integration.clientId ===
          client.id
    )
    ||
    null;


  // ==========================================================
  // COUNTS
  // ==========================================================

  const connectedCount =
    clientIntegrations.filter(
      integration =>
        integration.connectionStatus ===
        'connected'
    ).length;


  const readyCount =
    clientIntegrations.filter(
      integration =>
        integration.dataStatus ===
        'ready'
    ).length;


  const issueCount =
    clientIntegrations.filter(
      integration =>

        integration.connectionStatus ===
          'error'

        ||

        integration.connectionStatus ===
          'disconnected'

        ||

        integration.dataStatus ===
          'error'

        ||

        integration.dataStatus ===
          'stale'

    ).length;


  // ==========================================================
  // CREATE INTEGRATION
  // ==========================================================

  function createIntegration() {

    if (
      !newProviderId
    ) {

      return;

    }


    const provider =
      getIntegrationProvider(
        newProviderId
      );


    const integration:
      AdminClientIntegration = {

      id:
        `${client.id}-${newProviderId}-${Date.now()}`,

      clientId:
        client.id,

      providerId:
        newProviderId,

      accountName:
        newAccountName.trim()
        ||
        provider?.name
        ||
        'Integration',

      externalAccountId:
        newExternalAccountId.trim(),

      connectionStatus:
        'setup_required',

      dataStatus:
        'not_ready',

      syncEnabled:
        false,

      lastSuccessfulSyncAt:
        null,

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


    setIntegrations(
      previous => [
        integration,
        ...previous,
      ]
    );


    resetForm();


    setAddOpen(
      false
    );


    setSelectedIntegrationId(
      integration.id
    );

  }


  // ==========================================================
  // UPDATE
  // ==========================================================

  function updateIntegration(
    updatedIntegration:
      AdminClientIntegration
  ) {

    setIntegrations(
      previous =>
        previous.map(
          integration =>

            integration.id ===
              updatedIntegration.id

              ? updatedIntegration

              : integration
        )
    );

  }


  // ==========================================================
  // RESET
  // ==========================================================

  function resetForm() {

    setNewProviderId(
      integrationProviders[0]?.id ||
      ''
    );


    setNewAccountName(
      ''
    );


    setNewExternalAccountId(
      ''
    );

  }


  // ==========================================================
  // DETAIL
  // ==========================================================

  if (
    selectedIntegration
  ) {

    return (

      <ClientIntegrationDetail

        integration={
          selectedIntegration
        }

        client={
          client
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
          label="Integrations"
          value={
            clientIntegrations.length
          }
        />


        <SummaryCard
          label="Connected"
          value={
            connectedCount
          }
        />


        <SummaryCard
          label="Data Ready"
          value={
            readyCount
          }
        />


        <SummaryCard
          label="Issues"
          value={
            issueCount
          }
        />

      </section>


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

          sm:flex-row
          sm:items-center
          sm:justify-between
        "
      >

        <div>

          <h3
            className="
              text-[13px]
              font-semibold

              text-slate-950
            "
          >
            Workspace Integrations
          </h3>


          <p
            className="
              mt-0.5

              text-[9px]

              text-slate-500
            "
          >
            Manage source connections and data readiness for {client.name}.
          </p>

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
            shrink-0
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

          Add Integration

        </button>

      </section>


      {/* =====================================================
          TABLE
      ===================================================== */}

      <section className="gos-panel !p-0">

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
                  Integration
                </TableHeader>

                <TableHeader>
                  Provider
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

                <TableHeader align="right">
                  Action
                </TableHeader>

              </tr>

            </thead>


            <tbody>

              {clientIntegrations.map(
                integration => {

                  const provider =
                    getIntegrationProvider(
                      integration.providerId
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

                            <Plug
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
                              {integration.accountName}
                            </div>


                            <div
                              className="
                                mt-0.5

                                max-w-[260px]

                                truncate

                                text-[9px]

                                text-slate-500
                              "
                            >
                              {integration.externalAccountId ||
                                'No account ID configured'}
                            </div>

                          </div>

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
                        {provider?.name ||
                          integration.providerId}
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


              {clientIntegrations.length ===
                0 && (

                <tr>

                  <td
                    colSpan={
                      7
                    }

                    className="
                      px-4
                      py-10

                      text-center

                      text-[10px]

                      text-slate-500
                    "
                  >
                    No integrations have been assigned to this client.
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </section>


      {/* =====================================================
          ADD INTEGRATION
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
                  Add Integration
                </h3>


                <p
                  className="
                    mt-0.5

                    text-[9px]

                    text-slate-500
                  "
                >
                  Add a source connection to {client.name}.
                </p>

              </div>


              <button

                type="button"

                onClick={() => {

                  setAddOpen(
                    false
                  );


                  resetForm();

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
                label="Provider"
              >

                <select

                  value={
                    newProviderId
                  }

                  onChange={
                    event =>
                      setNewProviderId(
                        event.target.value
                      )
                  }

                  className="gos-input w-full"

                >

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

              </FormField>


              <FormField
                label="Account Name"
              >

                <input

                  value={
                    newAccountName
                  }

                  onChange={
                    event =>
                      setNewAccountName(
                        event.target.value
                      )
                  }

                  placeholder="Example: Brillare Meta Ads"

                  className="gos-input w-full"

                />

              </FormField>


              <FormField
                label="External Account ID"
              >

                <input

                  value={
                    newExternalAccountId
                  }

                  onChange={
                    event =>
                      setNewExternalAccountId(
                        event.target.value
                      )
                  }

                  placeholder="Store domain / ad account ID"

                  className="gos-input w-full"

                />

              </FormField>


              <div
                className="
                  rounded-[9px]

                  border
                  border-slate-200

                  bg-slate-50

                  px-3
                  py-2.5
                "
              >

                <p
                  className="
                    text-[9px]
                    font-semibold

                    text-slate-700
                  "
                >
                  Initial state
                </p>


                <p
                  className="
                    mt-1

                    text-[9px]
                    leading-4

                    text-slate-500
                  "
                >
                  New integrations begin as Setup Required with data marked Not Ready. The actual connector will be attached later.
                </p>

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


                  resetForm();

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
                  !newProviderId
                }

                onClick={
                  createIntegration
                }

                className="
                  h-8

                  rounded-[8px]

                  bg-slate-950

                  px-3

                  text-[10px]
                  font-semibold

                  text-white

                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
              >
                Add Integration
              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}


// ============================================================
// CLIENT INTEGRATION DETAIL
// ============================================================

function ClientIntegrationDetail({

  integration,

  client,

  onBack,

  onChange,

}: {

  integration:
    AdminClientIntegration;

  client:
    AdminClient;

  onBack:
    () => void;

  onChange:
    (
      integration:
        AdminClientIntegration
    ) => void;

}) {


  const {
    getIntegrationProvider,
  } =
    useAdminStore();


  const provider =
    getIntegrationProvider(
      integration.providerId
    );


  // ==========================================================
  // SETUP LIFECYCLE
  // ==========================================================

  function advanceSetup() {

    if (
      integration.connectionStatus ===
        'configuring'
    ) {

      onChange({

        ...integration,

        connectionStatus:
          'connected',

      });


      return;

    }


    onChange({

      ...integration,

      connectionStatus:
        'configuring',

    });

  }


  // ==========================================================
  // MARK DATA READY
  // ==========================================================

  function markDataReady() {

    if (
      integration.connectionStatus !==
        'connected'
    ) {

      return;

    }


    onChange({

      ...integration,

      dataStatus:
        'ready',

      syncEnabled:
        true,

      lastSuccessfulSyncAt:
        new Date()
          .toLocaleString(
            'en-IN'
          ),

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

              <Plug
                size={17}
              />

            </div>


            <div className="min-w-0">

              <h3
                className="
                  text-[14px]
                  font-semibold

                  text-slate-950
                "
              >
                {integration.accountName}
              </h3>


              <p
                className="
                  mt-0.5

                  text-[9px]

                  text-slate-500
                "
              >
                {client.name}
                {' · '}
                {provider?.name ||
                  integration.providerId}
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

            {integration.connectionStatus !==
              'connected' && (

              <button

                type="button"

                onClick={
                  advanceSetup
                }

                className="
                  h-8

                  rounded-[8px]

                  bg-slate-950

                  px-3

                  text-[10px]
                  font-semibold

                  text-white
                "
              >
                {integration.connectionStatus ===
                  'configuring'

                  ? 'Mark Connected'

                  : 'Initiate Setup'
                }
              </button>

            )}


            {integration.connectionStatus ===
              'connected'
              &&
              integration.dataStatus !==
                'ready' && (

              <button

                type="button"

                onClick={
                  markDataReady
                }

                className="
                  h-8

                  rounded-[8px]

                  bg-violet-600

                  px-3

                  text-[10px]
                  font-semibold

                  text-white
                "
              >
                Mark Data Ready
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
          label="Provider"
          value={
            provider?.name ||
            integration.providerId
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
          CONNECTION
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <h3 className="gos-section-title">
          Connection Configuration
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
            label="Account Name"
          >

            <input

              value={
                integration.accountName
              }

              onChange={
                event =>
                  onChange({

                    ...integration,

                    accountName:
                      event.target.value,

                  })
              }

              className="gos-input w-full"

            />

          </FormField>


          <FormField
            label="External Account ID"
          >

            <input

              value={
                integration.externalAccountId
              }

              onChange={
                event =>
                  onChange({

                    ...integration,

                    externalAccountId:
                      event.target.value,

                  })
              }

              className="gos-input w-full"

            />

          </FormField>


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
          SYNC
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <div
          className="
            flex
            items-center
            justify-between
            gap-4
          "
        >

          <div>

            <h3 className="gos-section-title">
              Synchronization
            </h3>


            <p
              className="
                mt-0.5

                text-[9px]

                text-slate-500
              "
            >
              Controls whether Growth OS should process this client connection.
            </p>

          </div>


          <Toggle

            checked={
              integration.syncEnabled
            }

            onChange={
              checked =>
                onChange({

                  ...integration,

                  syncEnabled:
                    checked,

                })
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
          "
        >

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

        </div>

      </section>

    </div>

  );

}


// ============================================================
// SUMMARY
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
// CONNECTION BADGE
// ============================================================

function ConnectionBadge({

  status,

}: {

  status:
    IntegrationConnectionStatus;

}) {

  const healthy =
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
          healthy

            ? `
              border-emerald-200
              bg-emerald-50
              text-emerald-700
            `

            : warning

              ? `
                border-amber-200
                bg-amber-50
                text-amber-700
              `

              : `
                border-red-200
                bg-red-50
                text-red-700
              `
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

  const healthy =
    status ===
      'ready';


  const warning =
    status ===
      'syncing'
    ||
    status ===
      'stale';


  const error =
    status ===
      'error';


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
          healthy

            ? `
              border-emerald-200
              bg-emerald-50
              text-emerald-700
            `

            : error

              ? `
                border-red-200
                bg-red-50
                text-red-700
              `

              : warning

                ? `
                  border-amber-200
                  bg-amber-50
                  text-amber-700
                `

                : `
                  border-slate-200
                  bg-slate-100
                  text-slate-600
                `
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
        ? 'Enabled'
        : 'Off'}
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