'use client';

import {
  type ReactNode,
  useEffect,
  useState,
} from 'react';

import {
  CheckCircle2,
  CloudCog,
  Database,
  RefreshCw,
  Server,
  ShieldCheck,
  XCircle,
} from 'lucide-react';


// ============================================================
// TYPES
// ============================================================

type TableCheck = {

  tableId:
    string;

  exists:
    boolean;

};


type AdminSystemSnapshot = {

  runtime: {

    environment:
      string;

    vercelEnvironment:
      string | null;

    nodeEnvironment:
      string | null;

    deploymentRegion:
      string | null;

    commitSha:
      string | null;

  };


  bigquery: {

    projectId:
      string;

    location:
      string;

    controlDataset:
      string;

    dataDataset:
      string;

  };


  controlPlane: {

    ready:
      boolean;

    existingTables:
      number;

    requiredTables:
      number;

    tables:
      TableCheck[];

  };


  dataPlane: {

    ready:
      boolean;

    existingTables:
      number;

    requiredTables:
      number;

    tables:
      TableCheck[];

  };

};


type AdminSystemResponse = {

  ok:
    boolean;

  scope?:
    string;

  system?:
    AdminSystemSnapshot;

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


// ============================================================
// MAIN
// ============================================================

export default function AdminSystem() {


  const [
    data,
    setData,
  ] =
    useState<
      AdminSystemResponse |
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
  // LOAD
  // ==========================================================

  async function loadSystem() {

    setLoading(
      true
    );


    setError(
      null
    );


    try {

      const response =
        await fetch(
          '/api/admin/system',
          {

            cache:
              'no-store',

            credentials:
              'same-origin',

          }
        );


      const json:
        AdminSystemResponse =
          await response.json();


      if (
        !response.ok
        ||
        !json.ok
      ) {

        throw new Error(
          json.error
          ||
          'Unable to load Admin System'
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
        'ADMIN_SYSTEM_UI_ERROR',
        error
      );


      setData(
        null
      );


      setError(
        String(
          error?.message
          ||
          'Unable to load Admin System'
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

      loadSystem();

    },
    []
  );


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
          Loading System...
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
                Unable to load System
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
              loadSystem
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


  const system =
    data?.system;


  if (!system) {

    return null;

  }


  const allReady =
    system.controlPlane.ready
    &&
    system.dataPlane.ready;


  // ==========================================================
  // UI
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

          md:flex-row
          md:items-center
          md:justify-between
        "
      >

        <div
          className="
            flex
            items-start
            gap-2.5
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

            <Server
              size={16}
            />

          </div>


          <div>

            <h2
              className="
                text-[14px]
                font-semibold
                tracking-[-0.025em]
                text-slate-950
              "
            >
              Growth OS System
            </h2>


            <p
              className="
                mt-0.5
                text-[10px]
                text-slate-500
              "
            >
              Runtime, BigQuery configuration and infrastructure readiness.
            </p>

          </div>

        </div>


        <button

          type="button"

          onClick={
            loadSystem
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
          TOP STATUS
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
          label="Environment"
          value={
            formatLabel(
              system.runtime.environment
            )
          }
        />


        <SummaryCard
          label="BQ Region"
          value={
            system.bigquery.location
          }
          tone="violet"
        />


        <SummaryCard
          label="Control Plane"
          value={
            `${system.controlPlane.existingTables}/${system.controlPlane.requiredTables}`
          }
          tone={
            system.controlPlane.ready
              ? 'green'
              : 'red'
          }
        />


        <SummaryCard
          label="Data Plane"
          value={
            `${system.dataPlane.existingTables}/${system.dataPlane.requiredTables}`
          }
          tone={
            system.dataPlane.ready
              ? 'green'
              : 'red'
          }
        />


        <SummaryCard
          label="Project"
          value={
            system.bigquery.projectId
          }
        />


        <SummaryCard
          label="System"
          value={
            allReady
              ? 'Ready'
              : 'Attention'
          }
          tone={
            allReady
              ? 'green'
              : 'red'
          }
        />

      </section>


      {/* =====================================================
          OVERALL READINESS
      ===================================================== */}

      <section
        className={`
          rounded-[10px]
          border
          p-3

          ${
            allReady

              ? `
                border-emerald-200
                bg-emerald-50
              `

              : `
                border-red-200
                bg-red-50
              `
          }
        `}
      >

        <div
          className="
            flex
            items-start
            gap-2.5
          "
        >

          {allReady

            ? (
              <CheckCircle2
                size={16}
                className="
                  mt-0.5
                  shrink-0
                  text-emerald-600
                "
              />
            )

            : (
              <XCircle
                size={16}
                className="
                  mt-0.5
                  shrink-0
                  text-red-600
                "
              />
            )
          }


          <div>

            <p
              className={`
                text-[10px]
                font-semibold

                ${
                  allReady
                    ? 'text-emerald-800'
                    : 'text-red-800'
                }
              `}
            >
              {allReady
                ? 'Core infrastructure ready'
                : 'Infrastructure requires attention'}
            </p>


            <p
              className={`
                mt-0.5
                text-[8px]
                leading-4

                ${
                  allReady
                    ? 'text-emerald-700'
                    : 'text-red-700'
                }
              `}
            >
              Growth OS verifies its required control-plane and data-plane tables directly from BigQuery INFORMATION_SCHEMA.
            </p>

          </div>

        </div>

      </section>


      {/* =====================================================
          RUNTIME + BIGQUERY
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
            RUNTIME
        =================================================== */}

        <section className="gos-panel !p-3.5">

          <SectionHeading
            icon={
              Server
            }
            title="Runtime"
            description="Current application execution environment."
          />


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Environment"
              value={
                formatLabel(
                  system.runtime.environment
                )
              }
            />


            <ValueRow
              label="Node Environment"
              value={
                system.runtime.nodeEnvironment
                  ? formatLabel(
                      system.runtime.nodeEnvironment
                    )
                  : '—'
              }
            />


            <ValueRow
              label="Vercel Environment"
              value={
                system.runtime.vercelEnvironment
                  ? formatLabel(
                      system.runtime.vercelEnvironment
                    )
                  : '—'
              }
            />


            <ValueRow
              label="Deployment Region"
              value={
                system.runtime.deploymentRegion
                ||
                '—'
              }
            />


            <ValueRow
              label="Commit"
              value={
                system.runtime.commitSha
                ||
                '—'
              }
              mono
            />

          </div>

        </section>


        {/* ===================================================
            BIGQUERY
        =================================================== */}

        <section className="gos-panel !p-3.5">

          <SectionHeading
            icon={
              Database
            }
            title="BigQuery"
            description="Canonical Growth OS warehouse configuration."
          />


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Project ID"
              value={
                system.bigquery.projectId
              }
              mono
            />


            <ValueRow
              label="Location"
              value={
                system.bigquery.location
              }
              mono
            />


            <ValueRow
              label="Control Dataset"
              value={
                system.bigquery.controlDataset
              }
              mono
            />


            <ValueRow
              label="Data Dataset"
              value={
                system.bigquery.dataDataset
              }
              mono
            />

          </div>

        </section>

      </section>


      {/* =====================================================
          CONTROL PLANE
      ===================================================== */}

      <InfrastructureSection

        title="Control Plane"

        description="Core tenancy, entitlement, authentication and integration-control tables."

        icon={
          ShieldCheck
        }

        ready={
          system.controlPlane.ready
        }

        existingTables={
          system.controlPlane.existingTables
        }

        requiredTables={
          system.controlPlane.requiredTables
        }

        tables={
          system.controlPlane.tables
        }

      />


      {/* =====================================================
          DATA PLANE
      ===================================================== */}

      <InfrastructureSection

        title="Data Plane"

        description="Canonical operational warehouse tables required for Shopify commerce ingestion."

        icon={
          Database
        }

        ready={
          system.dataPlane.ready
        }

        existingTables={
          system.dataPlane.existingTables
        }

        requiredTables={
          system.dataPlane.requiredTables
        }

        tables={
          system.dataPlane.tables
        }

      />


      {/* =====================================================
          ARCHITECTURE
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

        <div
          className="
            flex
            items-start
            gap-2.5
          "
        >

          <CloudCog
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
                text-[9px]
                font-semibold
                text-violet-800
              "
            >
              Infrastructure ownership
            </p>


            <p
              className="
                mt-1
                text-[8px]
                leading-4
                text-violet-700
              "
            >
              System is intentionally read-only. Runtime configuration is supplied through deployment environment variables and infrastructure configuration, not mutable browser state.
            </p>

          </div>

        </div>

      </section>


      {/* =====================================================
          SOURCE
      ===================================================== */}

      <section
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
            text-[8px]
            leading-4
            text-slate-500
          "
        >
          Source: runtime configuration and BigQuery INFORMATION_SCHEMA. No credentials, tokens or secret values are exposed.
        </p>


        {data?.meta?.durationMs !==
          undefined && (

          <p
            className="
              mt-1
              text-[8px]
              text-slate-400
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
// INFRASTRUCTURE SECTION
// ============================================================

function InfrastructureSection({

  title,

  description,

  icon:
    Icon,

  ready,

  existingTables,

  requiredTables,

  tables,

}: {

  title:
    string;

  description:
    string;

  icon:
    any;

  ready:
    boolean;

  existingTables:
    number;

  requiredTables:
    number;

  tables:
    TableCheck[];

}) {

  return (

    <section className="gos-panel !p-0">

      <div
        className="
          flex
          flex-col
          gap-3
          border-b
          border-slate-200
          px-3
          py-3

          md:flex-row
          md:items-center
          md:justify-between
        "
      >

        <SectionHeading
          icon={
            Icon
          }
          title={
            title
          }
          description={
            description
          }
        />


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
              text-slate-700
            "
          >
            {existingTables}
            {' / '}
            {requiredTables}
          </span>


          <ReadinessBadge
            ready={
              ready
            }
          />

        </div>

      </div>


      <div
        className="
          grid
          grid-cols-1
          gap-2
          p-3

          sm:grid-cols-2
          lg:grid-cols-3
          xl:grid-cols-4
        "
      >

        {tables.map(
          table => (

            <div

              key={
                table.tableId
              }

              className="
                flex
                min-h-[42px]
                items-center
                justify-between
                gap-2
                rounded-[8px]
                border
                border-slate-200
                bg-slate-50
                px-3
              "
            >

              <span
                title={
                  table.tableId
                }
                className="
                  min-w-0
                  truncate
                  font-mono
                  text-[8px]
                  text-slate-600
                "
              >
                {table.tableId}
              </span>


              {table.exists

                ? (
                  <CheckCircle2
                    size={13}
                    className="
                      shrink-0
                      text-emerald-600
                    "
                  />
                )

                : (
                  <XCircle
                    size={13}
                    className="
                      shrink-0
                      text-red-600
                    "
                  />
                )
              }

            </div>

          )
        )}

      </div>

    </section>

  );

}


// ============================================================
// SECTION HEADING
// ============================================================

function SectionHeading({

  icon:
    Icon,

  title,

  description,

}: {

  icon:
    any;

  title:
    string;

  description:
    string;

}) {

  return (

    <div
      className="
        flex
        items-start
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

        <Icon
          size={14}
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
            text-[9px]
            leading-4
            text-slate-500
          "
        >
          {description}
        </p>

      </div>

    </div>

  );

}


// ============================================================
// READINESS BADGE
// ============================================================

function ReadinessBadge({

  ready,

}: {

  ready:
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
          ready

            ? `
              border-emerald-200
              bg-emerald-50
              text-emerald-700
            `

            : `
              border-red-200
              bg-red-50
              text-red-700
            `
        }
      `}
    >
      {ready
        ? 'Ready'
        : 'Attention'}
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
    | 'red'
    | 'violet';

}) {

  const cls =
    tone ===
      'green'

      ? 'text-emerald-700'

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
        title={
          String(
            value
          )
        }
        className={`
          mt-1.5
          truncate
          text-[16px]
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
// HELPERS
// ============================================================

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