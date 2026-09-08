'use client';

import {
  type ReactNode,
  useState,
} from 'react';

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CloudCog,
  Database,
  Gauge,
  LockKeyhole,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
} from 'lucide-react';

import {
  useAdminStore,
} from './AdminStore';


// ============================================================
// TYPES
// ============================================================

type PlatformEnvironment =
  | 'production'
  | 'staging'
  | 'development';


type DefaultSyncMode =
  | 'automatic'
  | 'manual';


type OrderLimitBehavior =
  | 'warn'
  | 'soft_limit'
  | 'hard_limit';


type PlatformStatus =
  | 'operational'
  | 'maintenance'
  | 'degraded';


// ============================================================
// MAIN
// ============================================================

export default function AdminSystem() {


  const {
    clients,
    modules,
    users,
    integrations,
  } =
    useAdminStore();


  // ==========================================================
  // PLATFORM CONFIG
  //
  // UI STATE ONLY FOR NOW.
  //
  // Later this should come from persistent platform settings.
  // ==========================================================

  const [
    environment,
    setEnvironment,
  ] =
    useState<PlatformEnvironment>(
      'production'
    );


  const [
    platformStatus,
    setPlatformStatus,
  ] =
    useState<PlatformStatus>(
      'operational'
    );


  const [
    region,
    setRegion,
  ] =
    useState(
      'asia-south1'
    );


  // ==========================================================
  // DATA INFRASTRUCTURE
  // ==========================================================

  const [
    projectId,
    setProjectId,
  ] =
    useState(
      ''
    );


  const [
    controlDataset,
    setControlDataset,
  ] =
    useState(
      'growthos_control'
    );


  const [
    dataDataset,
    setDataDataset,
  ] =
    useState(
      'growthos_data'
    );


  const [
    freshnessWarningMinutes,
    setFreshnessWarningMinutes,
  ] =
    useState(
      60
    );


  const [
    freshnessCriticalMinutes,
    setFreshnessCriticalMinutes,
  ] =
    useState(
      180
    );


  // ==========================================================
  // SYNC DEFAULTS
  // ==========================================================

  const [
    syncMode,
    setSyncMode,
  ] =
    useState<DefaultSyncMode>(
      'automatic'
    );


  const [
    autoRetry,
    setAutoRetry,
  ] =
    useState(
      true
    );


  const [
    maxRetries,
    setMaxRetries,
  ] =
    useState(
      3
    );


  const [
    retryDelayMinutes,
    setRetryDelayMinutes,
  ] =
    useState(
      15
    );


  // ==========================================================
  // USAGE
  // ==========================================================

  const [
    orderWarningPct,
    setOrderWarningPct,
  ] =
    useState(
      80
    );


  const [
    orderLimitBehavior,
    setOrderLimitBehavior,
  ] =
    useState<OrderLimitBehavior>(
      'warn'
    );


  const [
    defaultUserLimit,
    setDefaultUserLimit,
  ] =
    useState(
      5
    );


  // ==========================================================
  // SECURITY
  // ==========================================================

  const [
    inviteExpiryHours,
    setInviteExpiryHours,
  ] =
    useState(
      72
    );


  const [
    sessionDurationHours,
    setSessionDurationHours,
  ] =
    useState(
      24
    );


  const [
    requireAdminApproval,
    setRequireAdminApproval,
  ] =
    useState(
      true
    );


  const [
    restrictPlatformAdmin,
    setRestrictPlatformAdmin,
  ] =
    useState(
      true
    );


  // ==========================================================
  // SAVE STATE
  // ==========================================================

  const [
    saved,
    setSaved,
  ] =
    useState(
      false
    );


  function saveConfiguration() {

    // --------------------------------------------------------
    // Frontend simulation only.
    //
    // Later:
    // PUT /api/admin/system-settings
    // --------------------------------------------------------

    setSaved(
      true
    );


    window.setTimeout(
      () =>
        setSaved(
          false
        ),
      1800
    );

  }


  // ==========================================================
  // PLATFORM METRICS
  // ==========================================================

  const activeModules =
    modules.filter(
      module =>
        module.status ===
        'active'
    ).length;


  const healthyConnections =
    integrations.filter(
      integration =>

        integration.connectionStatus ===
          'connected'

        &&

        integration.dataStatus ===
          'ready'

        &&

        integration.syncEnabled

    ).length;


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="space-y-3">


      {/* =====================================================
          TOP STATUS
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-2
          gap-2

          lg:grid-cols-3
          xl:grid-cols-6
        "
      >

        <SummaryCard
          label="Environment"
          value={
            formatEnvironment(
              environment
            )
          }
        />


        <SummaryCard
          label="Region"
          value="Mumbai"
        />


        <SummaryCard
          label="Clients"
          value={
            clients.length
          }
        />


        <SummaryCard
          label="Modules"
          value={
            activeModules
          }
        />


        <SummaryCard
          label="Users"
          value={
            users.length
          }
        />


        <SummaryCard
          label="Healthy Sources"
          value={
            `${healthyConnections}/${integrations.length}`
          }
        />

      </section>


      {/* =====================================================
          PLATFORM
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <SectionHeading

          icon={
            Server
          }

          title="Platform Configuration"

          description="Core Growth OS environment and deployment configuration."

        />


        <div
          className="
            mt-4

            grid
            grid-cols-1
            gap-3

            md:grid-cols-2
            xl:grid-cols-3
          "
        >

          <FormField
            label="Environment"
          >

            <select

              value={
                environment
              }

              onChange={
                event =>
                  setEnvironment(
                    event.target.value as PlatformEnvironment
                  )
              }

              className="gos-input w-full"

            >

              <option value="production">
                Production
              </option>

              <option value="staging">
                Staging
              </option>

              <option value="development">
                Development
              </option>

            </select>

          </FormField>


          <FormField
            label="Platform Status"
          >

            <select

              value={
                platformStatus
              }

              onChange={
                event =>
                  setPlatformStatus(
                    event.target.value as PlatformStatus
                  )
              }

              className="gos-input w-full"

            >

              <option value="operational">
                Operational
              </option>

              <option value="degraded">
                Degraded
              </option>

              <option value="maintenance">
                Maintenance
              </option>

            </select>

          </FormField>


          <FormField
            label="Default Region"
          >

            <select

              value={
                region
              }

              onChange={
                event =>
                  setRegion(
                    event.target.value
                  )
              }

              className="gos-input w-full"

            >

              <option value="asia-south1">
                asia-south1 · Mumbai
              </option>

            </select>

          </FormField>

        </div>


        <div className="mt-3">

          <PlatformStatusBanner
            status={
              platformStatus
            }
          />

        </div>

      </section>


      {/* =====================================================
          DATA INFRASTRUCTURE
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <SectionHeading

          icon={
            Database
          }

          title="Data Infrastructure"

          description="Default BigQuery control-plane and client-data configuration."

        />


        <div
          className="
            mt-4

            grid
            grid-cols-1
            gap-3

            md:grid-cols-2
            xl:grid-cols-3
          "
        >

          <FormField
            label="GCP Project ID"
          >

            <input

              value={
                projectId
              }

              onChange={
                event =>
                  setProjectId(
                    event.target.value
                  )
              }

              placeholder="Loaded from environment"

              className="gos-input w-full"

            />

          </FormField>


          <FormField
            label="Control Dataset"
          >

            <input

              value={
                controlDataset
              }

              onChange={
                event =>
                  setControlDataset(
                    event.target.value
                  )
              }

              className="gos-input w-full"

            />

          </FormField>


          <FormField
            label="Data Dataset"
          >

            <input

              value={
                dataDataset
              }

              onChange={
                event =>
                  setDataDataset(
                    event.target.value
                  )
              }

              className="gos-input w-full"

            />

          </FormField>


          <FormField
            label="Freshness Warning"
            hint="minutes"
          >

            <NumberInput

              value={
                freshnessWarningMinutes
              }

              onChange={
                setFreshnessWarningMinutes
              }

              min={
                1
              }

            />

          </FormField>


          <FormField
            label="Freshness Critical"
            hint="minutes"
          >

            <NumberInput

              value={
                freshnessCriticalMinutes
              }

              onChange={
                setFreshnessCriticalMinutes
              }

              min={
                freshnessWarningMinutes
              }

            />

          </FormField>


          <ReadOnlyField
            label="Deployment Region"
            value="asia-south1"
          />

        </div>


        <InfoBox

          icon={
            CloudCog
          }

          title="Regional consistency"

          text="Growth OS control and client-data infrastructure should remain in the same canonical deployment region to avoid unnecessary cross-region complexity."

        />

      </section>


      {/* =====================================================
          SYNC DEFAULTS
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <SectionHeading

          icon={
            RefreshCw
          }

          title="Sync Defaults"

          description="Default behavior for newly configured client data sources."

        />


        <div
          className="
            mt-4

            grid
            grid-cols-1
            gap-3

            lg:grid-cols-2
          "
        >

          <SettingRow

            title="Automatic Synchronization"

            description="Enable synchronization automatically when a connection reaches data-ready state."

          >

            <select

              value={
                syncMode
              }

              onChange={
                event =>
                  setSyncMode(
                    event.target.value as DefaultSyncMode
                  )
              }

              className="gos-input"
            >

              <option value="automatic">
                Automatic
              </option>

              <option value="manual">
                Manual
              </option>

            </select>

          </SettingRow>


          <SettingRow

            title="Automatic Retry"

            description="Retry failed sync runs automatically before requiring administrator intervention."

          >

            <Toggle

              checked={
                autoRetry
              }

              onChange={
                setAutoRetry
              }

            />

          </SettingRow>


          <SettingRow

            title="Maximum Retry Attempts"

            description="Maximum automatic retry attempts for a failed sync run."

          >

            <NumberInput

              value={
                maxRetries
              }

              onChange={
                setMaxRetries
              }

              min={
                0
              }

              max={
                10
              }

              compact

            />

          </SettingRow>


          <SettingRow

            title="Retry Delay"

            description="Delay before Growth OS attempts the next automatic retry."

          >

            <div
              className="
                flex
                items-center
                gap-1.5
              "
            >

              <NumberInput

                value={
                  retryDelayMinutes
                }

                onChange={
                  setRetryDelayMinutes
                }

                min={
                  1
                }

                compact

              />


              <span
                className="
                  text-[9px]

                  text-slate-400
                "
              >
                min
              </span>

            </div>

          </SettingRow>

        </div>

      </section>


      {/* =====================================================
          USAGE CONTROL
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <SectionHeading

          icon={
            Gauge
          }

          title="Usage Controls"

          description="Default commercial-volume safeguards for client workspaces."

        />


        <div
          className="
            mt-4

            grid
            grid-cols-1
            gap-3

            lg:grid-cols-2
          "
        >

          <SettingRow

            title="Order Usage Warning"

            description="Warn administrators when a client reaches this percentage of its monthly allowance."

          >

            <div
              className="
                flex
                items-center
                gap-1
              "
            >

              <NumberInput

                value={
                  orderWarningPct
                }

                onChange={
                  setOrderWarningPct
                }

                min={
                  1
                }

                max={
                  100
                }

                compact

              />


              <span
                className="
                  text-[10px]

                  text-slate-400
                "
              >
                %
              </span>

            </div>

          </SettingRow>


          <SettingRow

            title="Limit Behavior"

            description="Platform behavior when a client exceeds its monthly order allowance."

          >

            <select

              value={
                orderLimitBehavior
              }

              onChange={
                event =>
                  setOrderLimitBehavior(
                    event.target.value as OrderLimitBehavior
                  )
              }

              className="gos-input"
            >

              <option value="warn">
                Warn Only
              </option>

              <option value="soft_limit">
                Soft Limit
              </option>

              <option value="hard_limit">
                Hard Limit
              </option>

            </select>

          </SettingRow>


          <SettingRow

            title="Default User Limit"

            description="Default user allowance for newly created custom plans."

          >

            <NumberInput

              value={
                defaultUserLimit
              }

              onChange={
                setDefaultUserLimit
              }

              min={
                1
              }

              compact

            />

          </SettingRow>


          <SettingRow

            title="Current Commercial Model"

            description="Growth OS commercial usage is currently designed around monthly business order volume."

          >

            <span
              className="
                rounded-full

                border
                border-violet-200

                bg-violet-50

                px-2.5
                py-1

                text-[8px]
                font-semibold

                text-violet-700
              "
            >
              Orders / Month
            </span>

          </SettingRow>

        </div>

      </section>


      {/* =====================================================
          SECURITY
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <SectionHeading

          icon={
            LockKeyhole
          }

          title="Security & Access Defaults"

          description="Platform defaults for user invitations and administrative access."

        />


        <div
          className="
            mt-4

            grid
            grid-cols-1
            gap-3

            lg:grid-cols-2
          "
        >

          <SettingRow

            title="Invite Expiry"

            description="How long a new client-user invitation remains valid."

          >

            <div
              className="
                flex
                items-center
                gap-1.5
              "
            >

              <NumberInput

                value={
                  inviteExpiryHours
                }

                onChange={
                  setInviteExpiryHours
                }

                min={
                  1
                }

                compact

              />


              <span
                className="
                  text-[9px]

                  text-slate-400
                "
              >
                hrs
              </span>

            </div>

          </SettingRow>


          <SettingRow

            title="Session Duration"

            description="Default authenticated session lifetime."

          >

            <div
              className="
                flex
                items-center
                gap-1.5
              "
            >

              <NumberInput

                value={
                  sessionDurationHours
                }

                onChange={
                  setSessionDurationHours
                }

                min={
                  1
                }

                compact

              />


              <span
                className="
                  text-[9px]

                  text-slate-400
                "
              >
                hrs
              </span>

            </div>

          </SettingRow>


          <SettingRow

            title="Admin Approval"

            description="Require platform administrator approval for sensitive workspace configuration."

          >

            <Toggle

              checked={
                requireAdminApproval
              }

              onChange={
                setRequireAdminApproval
              }

            />

          </SettingRow>


          <SettingRow

            title="Restrict Platform Administration"

            description="Platform administration remains available only to explicit platform-admin users."

          >

            <Toggle

              checked={
                restrictPlatformAdmin
              }

              onChange={
                setRestrictPlatformAdmin
              }

            />

          </SettingRow>

        </div>


        <InfoBox

          icon={
            ShieldCheck
          }

          title="Entitlement enforcement"

          text="Client plans, client overrides and user permissions remain independent layers. A user cannot elevate module access beyond the client's final entitlement."

        />

      </section>


      {/* =====================================================
          SAVE
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

          <p
            className="
              text-[10px]
              font-semibold

              text-slate-800
            "
          >
            Platform configuration
          </p>


          <p
            className="
              mt-0.5

              text-[9px]

              text-slate-500
            "
          >
            Settings are currently frontend-only until we connect persistent admin configuration.
          </p>

        </div>


        <button

          type="button"

          onClick={
            saveConfiguration
          }

          className={`
            inline-flex
            h-8
            shrink-0
            items-center
            justify-center
            gap-1.5

            rounded-[8px]

            px-3

            text-[10px]
            font-semibold

            transition

            ${
              saved

                ? `
                  bg-emerald-600
                  text-white
                `

                : `
                  bg-slate-950
                  text-white

                  hover:bg-slate-800
                `
            }
          `}
        >

          {saved ? (

            <>
              <CheckCircle2
                size={13}
              />

              Saved
            </>

          ) : (

            <>
              <Save
                size={13}
              />

              Save Configuration
            </>

          )}

        </button>

      </section>

    </div>

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
// SETTING ROW
// ============================================================

function SettingRow({

  title,

  description,

  children,

}: {

  title:
    string;

  description:
    string;

  children:
    ReactNode;

}) {

  return (

    <div
      className="
        flex
        min-h-[68px]
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

      <div className="min-w-0">

        <p
          className="
            text-[10px]
            font-semibold

            text-slate-800
          "
        >
          {title}
        </p>


        <p
          className="
            mt-0.5

            max-w-[520px]

            text-[8px]
            leading-4

            text-slate-500
          "
        >
          {description}
        </p>

      </div>


      <div className="shrink-0">

        {children}

      </div>

    </div>

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
// READ ONLY
// ============================================================

function ReadOnlyField({

  label,

  value,

}: {

  label:
    string;

  value:
    string;

}) {

  return (

    <div>

      <div
        className="
          mb-1.5

          text-[9px]
          font-semibold
          uppercase
          tracking-[0.05em]

          text-slate-500
        "
      >
        {label}
      </div>


      <div
        className="
          flex
          h-8
          items-center

          rounded-[8px]

          border
          border-slate-200

          bg-slate-100

          px-2.5

          text-[10px]
          font-medium

          text-slate-500
        "
      >
        {value}
      </div>

    </div>

  );

}


// ============================================================
// NUMBER INPUT
// ============================================================

function NumberInput({

  value,

  onChange,

  min,

  max,

  compact =
    false,

}: {

  value:
    number;

  onChange:
    (
      value:
        number
    ) => void;

  min:
    number;

  max?:
    number;

  compact?:
    boolean;

}) {

  return (

    <input

      type="number"

      value={
        value
      }

      min={
        min
      }

      max={
        max
      }

      onChange={
        event => {

          const parsed =
            Number(
              event.target.value
            );


          if (
            !Number.isFinite(
              parsed
            )
          ) {

            return;

          }


          let next =
            Math.max(
              min,
              parsed
            );


          if (
            max !==
            undefined
          ) {

            next =
              Math.min(
                max,
                next
              );

          }


          onChange(
            Math.floor(
              next
            )
          );

        }
      }

      className={`
        gos-input

        ${
          compact

            ? 'w-[76px]'

            : 'w-full'
        }
      `}

    />

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
// INFO BOX
// ============================================================

function InfoBox({

  icon:
    Icon,

  title,

  text,

}: {

  icon:
    any;

  title:
    string;

  text:
    string;

}) {

  return (

    <div
      className="
        mt-3

        rounded-[9px]

        border
        border-violet-200

        bg-violet-50

        px-3
        py-2.5
      "
    >

      <div
        className="
          flex
          items-start
          gap-2.5
        "
      >

        <Icon
          size={14}
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
            {title}
          </p>


          <p
            className="
              mt-0.5

              text-[8px]
              leading-4

              text-violet-700
            "
          >
            {text}
          </p>

        </div>

      </div>

    </div>

  );

}


// ============================================================
// PLATFORM STATUS
// ============================================================

function PlatformStatusBanner({

  status,

}: {

  status:
    PlatformStatus;

}) {


  if (
    status ===
    'operational'
  ) {

    return (

      <div
        className="
          flex
          items-center
          gap-2

          rounded-[9px]

          border
          border-emerald-200

          bg-emerald-50

          px-3
          py-2
        "
      >

        <CheckCircle2
          size={14}
          className="text-emerald-600"
        />


        <span
          className="
            text-[9px]
            font-semibold

            text-emerald-700
          "
        >
          Platform operational
        </span>

      </div>

    );

  }


  if (
    status ===
    'maintenance'
  ) {

    return (

      <div
        className="
          flex
          items-center
          gap-2

          rounded-[9px]

          border
          border-amber-200

          bg-amber-50

          px-3
          py-2
        "
      >

        <Activity
          size={14}
          className="text-amber-600"
        />


        <span
          className="
            text-[9px]
            font-semibold

            text-amber-700
          "
        >
          Platform maintenance mode
        </span>

      </div>

    );

  }


  return (

    <div
      className="
        flex
        items-center
        gap-2

        rounded-[9px]

        border
        border-red-200

        bg-red-50

        px-3
        py-2
      "
    >

      <AlertTriangle
        size={14}
        className="text-red-600"
      />


      <span
        className="
          text-[9px]
          font-semibold

          text-red-700
        "
      >
        Platform operating in degraded state
      </span>

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

          truncate

          text-[16px]
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
// HELPERS
// ============================================================

function formatEnvironment(
  value:
    PlatformEnvironment
) {

  if (
    value ===
    'production'
  ) {

    return 'Production';

  }


  if (
    value ===
    'staging'
  ) {

    return 'Staging';

  }


  return 'Development';

}