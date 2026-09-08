'use client';

import {
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  Database,
  Plug,
  RefreshCw,
} from 'lucide-react';

import {
  type AdminClient,
  useAdminStore,
} from './AdminStore';


// ============================================================
// TYPES
// ============================================================

type ReadinessStatus =
  | 'ready'
  | 'setup_required'
  | 'blocked';


type RequirementState =
  | 'ready'
  | 'missing'
  | 'connection_issue'
  | 'data_issue';


// ============================================================
// MODULE → INTEGRATION REQUIREMENTS
//
// These are onboarding requirements.
//
// Later we can move this mapping into Module Registry so every
// module defines its own required data sources dynamically.
// ============================================================

const MODULE_REQUIREMENTS:
  Record<
    string,
    string[]
  > = {

  'command-center': [
    'shopify',
  ],

  meta: [
    'meta',
  ],

  google: [
    'google_ads',
  ],

  attribution: [
    'shopify',
    'meta',
    'google_ads',
  ],

  retention: [
    'shopify',
  ],

  product: [
    'shopify',
  ],

};


// ============================================================
// MAIN
// ============================================================

export default function AdminClientDataSetup({

  client,

}: {

  client:
    AdminClient;

}) {


  const {

    modules,

    integrations,

    getClientModuleAccess,

    getClientIntegrations,

    getIntegrationProvider,

  } =
    useAdminStore();


  // ==========================================================
  // CLIENT ENABLED MODULES
  // ==========================================================

  const enabledModules =
    modules.filter(
      module =>
        getClientModuleAccess(
          client,
          module.id
        ).enabled
    );


  // ==========================================================
  // CLIENT INTEGRATIONS
  // ==========================================================

  const clientIntegrations =
    getClientIntegrations(
      client.id
    );


  // ==========================================================
  // REQUIRED PROVIDER IDS
  //
  // Deduplicated union of requirements for all enabled modules.
  // ==========================================================

  const requiredProviderIds =
    Array.from(
      new Set(
        enabledModules.flatMap(
          module =>
            MODULE_REQUIREMENTS[
              module.id
            ]
            ||
            []
        )
      )
    );


  // ==========================================================
  // PROVIDER REQUIREMENTS
  // ==========================================================

  const requirements =
    requiredProviderIds.map(
      providerId => {

        const provider =
          getIntegrationProvider(
            providerId
          );


        const integration =
          clientIntegrations.find(
            item =>
              item.providerId ===
              providerId
          );


        let state:
          RequirementState =
            'missing';


        if (
          integration
        ) {

          if (
            integration.connectionStatus !==
              'connected'
          ) {

            state =
              'connection_issue';

          }

          else if (
            integration.dataStatus !==
              'ready'
          ) {

            state =
              'data_issue';

          }

          else {

            state =
              'ready';

          }

        }


        const requiredBy =
          enabledModules
            .filter(
              module =>
                (
                  MODULE_REQUIREMENTS[
                    module.id
                  ]
                  ||
                  []
                ).includes(
                  providerId
                )
            )
            .map(
              module =>
                module.name
            );


        return {

          providerId,

          provider,

          integration,

          state,

          requiredBy,

        };

      }
    );


  // ==========================================================
  // READINESS COUNTS
  // ==========================================================

  const readyRequirements =
    requirements.filter(
      requirement =>
        requirement.state ===
        'ready'
    ).length;


  const missingRequirements =
    requirements.filter(
      requirement =>
        requirement.state ===
        'missing'
    ).length;


  const issueRequirements =
    requirements.filter(
      requirement =>
        requirement.state ===
          'connection_issue'
        ||
        requirement.state ===
          'data_issue'
    ).length;


  // ==========================================================
  // WORKSPACE READINESS
  // ==========================================================

  const readiness:
    ReadinessStatus =

    requirements.length ===
      0

      ? 'setup_required'

      : readyRequirements ===
          requirements.length

        ? 'ready'

        : missingRequirements >
            0

          ? 'blocked'

          : 'setup_required';


  const readinessPct =
    requirements.length ===
      0

      ? 0

      : Math.round(
          (
            readyRequirements
            /
            requirements.length
          )
          *
          100
        );


  // ==========================================================
  // MODULE READINESS
  // ==========================================================

  const moduleRows =
    enabledModules.map(
      module => {

        const providerIds =
          MODULE_REQUIREMENTS[
            module.id
          ]
          ||
          [];


        const relatedRequirements =
          providerIds.map(
            providerId =>
              requirements.find(
                requirement =>
                  requirement.providerId ===
                  providerId
              )
          );


        const moduleReady =
          providerIds.length ===
            0
          ||
          relatedRequirements.every(
            requirement =>
              requirement?.state ===
              'ready'
          );


        return {

          module,

          providerIds,

          moduleReady,

        };

      }
    );


  // ==========================================================
  // UI
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
          label="Readiness"
          value={
            `${readinessPct}%`
          }
        />


        <SummaryCard
          label="Required Sources"
          value={
            requirements.length
          }
        />


        <SummaryCard
          label="Data Ready"
          value={
            readyRequirements
          }
        />


        <SummaryCard
          label="Issues"
          value={
            missingRequirements
            +
            issueRequirements
          }
        />

      </section>


      {/* =====================================================
          WORKSPACE READINESS
      ===================================================== */}

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

            <div
              className="
                flex
                items-center
                gap-2
              "
            >

              <ReadinessIcon
                status={
                  readiness
                }
              />


              <h3
                className="
                  text-[13px]
                  font-semibold

                  text-slate-950
                "
              >
                Workspace Readiness
              </h3>

            </div>


            <p
              className="
                mt-1

                text-[9px]
                leading-4

                text-slate-500
              "
            >
              Data readiness is calculated from the requirements of the modules currently enabled for {client.name}.
            </p>

          </div>


          <ReadinessBadge
            status={
              readiness
            }
          />

        </div>


        {/* =================================================
            PROGRESS
        ================================================= */}

        <div className="mt-4">

          <div
            className="
              mb-1.5

              flex
              items-center
              justify-between
            "
          >

            <span
              className="
                text-[9px]
                font-medium

                text-slate-500
              "
            >
              Setup completion
            </span>


            <span
              className="
                text-[10px]
                font-semibold

                text-slate-800
              "
            >
              {readyRequirements}
              {' / '}
              {requirements.length}
            </span>

          </div>


          <div
            className="
              h-2

              overflow-hidden

              rounded-full

              bg-slate-100
            "
          >

            <div

              className={`
                h-full

                rounded-full

                transition-all

                ${
                  readiness ===
                    'ready'

                    ? 'bg-emerald-500'

                    : readiness ===
                        'blocked'

                      ? 'bg-red-500'

                      : 'bg-amber-500'
                }
              `}

              style={{
                width:
                  `${readinessPct}%`,
              }}

            />

          </div>

        </div>

      </section>


      {/* =====================================================
          REQUIRED DATA SOURCES
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
            Required Data Sources
          </h3>


          <p
            className="
              mt-0.5

              text-[9px]

              text-slate-500
            "
          >
            Every enabled module contributes its required source connections.
          </p>

        </div>


        <div className="overflow-x-auto">

          <table
            className="
              min-w-[900px]
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
                  Source
                </TableHeader>

                <TableHeader>
                  Required By
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
                  Readiness
                </TableHeader>

              </tr>

            </thead>


            <tbody>

              {requirements.map(
                requirement => {

                  const integration =
                    requirement.integration;


                  return (

                    <tr
                      key={
                        requirement.providerId
                      }

                      className="
                        border-b
                        border-slate-100

                        last:border-0
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


                          <div>

                            <div
                              className="
                                text-[10px]
                                font-semibold

                                text-slate-900
                              "
                            >
                              {requirement
                                .provider
                                ?.name
                                ||
                                requirement.providerId}
                            </div>


                            <p
                              className="
                                mt-0.5

                                max-w-[260px]

                                truncate

                                text-[8px]

                                text-slate-500
                              "
                            >
                              {integration
                                ?.accountName
                                ||
                                'Integration not configured'}
                            </p>

                          </div>

                        </div>

                      </td>


                      <td className="px-3 py-2">

                        <div
                          className="
                            flex
                            flex-wrap
                            gap-1
                          "
                        >

                          {requirement
                            .requiredBy
                            .map(
                              moduleName => (

                                <span

                                  key={
                                    moduleName
                                  }

                                  className="
                                    rounded-full

                                    border
                                    border-slate-200

                                    bg-slate-50

                                    px-2
                                    py-0.5

                                    text-[8px]
                                    font-medium

                                    text-slate-600
                                  "
                                >
                                  {moduleName}
                                </span>

                              )
                            )}

                        </div>

                      </td>


                      <td className="px-3 py-2">

                        {integration ? (

                          <StatusBadge

                            good={
                              integration.connectionStatus ===
                              'connected'
                            }

                            label={
                              formatConnectionStatus(
                                integration.connectionStatus
                              )
                            }

                          />

                        ) : (

                          <StatusBadge
                            good={
                              false
                            }
                            label="Missing"
                          />

                        )}

                      </td>


                      <td className="px-3 py-2">

                        {integration ? (

                          <StatusBadge

                            good={
                              integration.dataStatus ===
                              'ready'
                            }

                            label={
                              formatDataStatus(
                                integration.dataStatus
                              )
                            }

                          />

                        ) : (

                          <StatusBadge
                            good={
                              false
                            }
                            label="Not Ready"
                          />

                        )}

                      </td>


                      <td className="px-3 py-2">

                        <StatusBadge

                          good={
                            Boolean(
                              integration?.syncEnabled
                            )
                          }

                          label={
                            integration?.syncEnabled
                              ? 'Enabled'
                              : 'Off'
                          }

                        />

                      </td>


                      <td className="px-3 py-2">

                        <RequirementBadge
                          state={
                            requirement.state
                          }
                        />

                      </td>

                    </tr>

                  );

                }
              )}


              {requirements.length ===
                0 && (

                <tr>

                  <td

                    colSpan={
                      6
                    }

                    className="
                      px-4
                      py-10

                      text-center

                      text-[10px]

                      text-slate-500
                    "
                  >
                    No data source requirements were found for the enabled modules.
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </section>


      {/* =====================================================
          MODULE READINESS
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
            Module Readiness
          </h3>


          <p
            className="
              mt-0.5

              text-[9px]

              text-slate-500
            "
          >
            A module becomes data-ready only when all of its required sources are ready.
          </p>

        </div>


        <div
          className="
            grid
            grid-cols-1

            lg:grid-cols-2
          "
        >

          {moduleRows.map(
            row => (

              <div

                key={
                  row.module.id
                }

                className="
                  flex
                  items-center
                  justify-between
                  gap-3

                  border-b
                  border-slate-100

                  px-3
                  py-3
                "
              >

                <div>

                  <div
                    className="
                      text-[10px]
                      font-semibold

                      text-slate-900
                    "
                  >
                    {row.module.name}
                  </div>


                  <p
                    className="
                      mt-0.5

                      text-[8px]

                      text-slate-500
                    "
                  >
                    {row.providerIds.length ===
                      0

                      ? 'No external source required'

                      : row.providerIds
                          .map(
                            providerId =>
                              getIntegrationProvider(
                                providerId
                              )
                                ?.name
                              ||
                              providerId
                          )
                          .join(
                            ' + '
                          )
                    }
                  </p>

                </div>


                <StatusBadge

                  good={
                    row.moduleReady
                  }

                  label={
                    row.moduleReady
                      ? 'Ready'
                      : 'Waiting'
                  }

                />

              </div>

            )
          )}

        </div>

      </section>


      {/* =====================================================
          READINESS RULE
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

          <Database
            size={15}
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
              Readiness is derived, not manually entered
            </p>


            <p
              className="
                mt-1

                text-[9px]
                leading-4

                text-slate-500
              "
            >
              Changing a client's plan, module entitlement, integration connection or data status automatically recalculates this workspace readiness.
            </p>

          </div>

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
// READINESS ICON
// ============================================================

function ReadinessIcon({

  status,

}: {

  status:
    ReadinessStatus;

}) {

  if (
    status ===
    'ready'
  ) {

    return (

      <CheckCircle2
        size={17}
        className="text-emerald-600"
      />

    );

  }


  if (
    status ===
    'blocked'
  ) {

    return (

      <CircleAlert
        size={17}
        className="text-red-600"
      />

    );

  }


  return (

    <CircleDashed
      size={17}
      className="text-amber-600"
    />

  );

}


// ============================================================
// READINESS BADGE
// ============================================================

function ReadinessBadge({

  status,

}: {

  status:
    ReadinessStatus;

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
          'blocked'

        ? {
            label:
              'Blocked',

            cls:
              'border-red-200 bg-red-50 text-red-700',
          }

        : {
            label:
              'Setup Required',

            cls:
              'border-amber-200 bg-amber-50 text-amber-700',
          };


  return (

    <span
      className={`
        inline-flex

        rounded-full

        border

        px-2.5
        py-1

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
// REQUIREMENT BADGE
// ============================================================

function RequirementBadge({

  state,

}: {

  state:
    RequirementState;

}) {

  const config =

    state ===
      'ready'

      ? {
          label:
            'Ready',

          cls:
            'border-emerald-200 bg-emerald-50 text-emerald-700',
        }

      : state ===
          'missing'

        ? {
            label:
              'Missing',

            cls:
              'border-red-200 bg-red-50 text-red-700',
          }

        : state ===
            'connection_issue'

          ? {
              label:
                'Connection Issue',

              cls:
                'border-amber-200 bg-amber-50 text-amber-700',
            }

          : {
              label:
                'Data Not Ready',

              cls:
                'border-amber-200 bg-amber-50 text-amber-700',
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
// GENERIC STATUS
// ============================================================

function StatusBadge({

  good,

  label,

}: {

  good:
    boolean;

  label:
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
          good

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
      {label}
    </span>

  );

}


// ============================================================
// TABLE HEADER
// ============================================================

function TableHeader({

  children,

}: {

  children:
    React.ReactNode;

}) {

  return (

    <th
      className="
        h-8

        px-3

        text-left
        text-[9px]
        font-semibold
        uppercase
        tracking-[0.05em]

        text-slate-500
      "
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
    string
) {

  const labels:
    Record<
      string,
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


  return (
    labels[
      value
    ]
    ||
    value
  );

}


function formatDataStatus(
  value:
    string
) {

  const labels:
    Record<
      string,
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


  return (
    labels[
      value
    ]
    ||
    value
  );

}