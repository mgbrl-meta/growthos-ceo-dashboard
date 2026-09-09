'use client';

import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  ServerCog,
  XCircle,
} from 'lucide-react';


// ============================================================
// TYPES
// ============================================================

type HealthStatus =
  | 'healthy'
  | 'attention'
  | 'critical'
  | 'not_monitored';


type DataHealthRow = {

  workspaceId:
    string;

  workspaceName:
    string | null;

  brandId:
    string | null;

  brandName:
    string | null;

  connectionId:
    string;

  provider:
    string;

  connectionStatus:
    string | null;

  connectionMode:
    string | null;

  ingestionAdapter:
    string | null;

  providerAccountId:
    string | null;

  providerAccountName:
    string | null;

  entity:
    string | null;

  backfillStatus:
    string | null;

  incrementalStatus:
    string | null;

  consecutiveFailures:
    number;

  lastError:
    string | null;

  lastSourceTimestamp:
    string | null;

  lastSyncedAt:
    string | null;

  nextSyncAt:
    string | null;

  freshnessMinutes:
    number | null;

  nextSyncOverdueMinutes:
    number | null;

  health:
    HealthStatus;

};


type DataHealthResponse = {

  ok:
    boolean;

  scope?:
    string;

  summary?: {

    total:
      number;

    healthy:
      number;

    attention:
      number;

    critical:
      number;

    notMonitored:
      number;

    clients:
      number;

    providers:
      number;

  };

  rows?:
    DataHealthRow[];

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
// FILTER TYPES
// ============================================================

type HealthFilter =
  | 'all'
  | HealthStatus;


// ============================================================
// MAIN
// ============================================================

export default function AdminDataHealth() {


  const [
    data,
    setData,
  ] =
    useState<DataHealthResponse | null>(
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


  const [
    search,
    setSearch,
  ] =
    useState(
      ''
    );


  const [
    clientFilter,
    setClientFilter,
  ] =
    useState(
      'all'
    );


  const [
    providerFilter,
    setProviderFilter,
  ] =
    useState(
      'all'
    );


  const [
    healthFilter,
    setHealthFilter,
  ] =
    useState<HealthFilter>(
      'all'
    );


  // ==========================================================
  // LOAD
  // ==========================================================

  async function loadDataHealth() {

    setLoading(
      true
    );


    setError(
      null
    );


    try {

      const response =
        await fetch(
          '/api/admin/data-health',
          {
            cache:
              'no-store',

            credentials:
              'same-origin',
          }
        );


      const json:
        DataHealthResponse =
          await response.json();


      if (
        !response.ok
        ||
        !json.ok
      ) {

        throw new Error(
          json.error
          ||
          'Unable to load Data Health'
        );

      }


      setData(
        json
      );

    } catch (
      error: any
    ) {

      console.error(
        'ADMIN_DATA_HEALTH_UI_ERROR',
        error
      );


      setData(
        null
      );


      setError(
        String(
          error?.message
          ||
          'Unable to load Data Health'
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

      loadDataHealth();

    },
    []
  );


  // ==========================================================
  // ROWS
  // ==========================================================

  const rows =
    data?.rows
    ||
    [];


  // ==========================================================
  // FILTER OPTIONS
  // ==========================================================

  const clients =
    useMemo(
      () => {

        const map =
          new Map<
            string,
            string
          >();


        rows.forEach(
          row => {

            const key =
              [
                row.workspaceId,
                row.brandId
                ||
                '',
              ].join(
                ':'
              );


            const label =
              row.brandName
              ||
              row.workspaceName
              ||
              row.brandId
              ||
              row.workspaceId;


            map.set(
              key,
              label
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
        rows,
      ]
    );


  const providers =
    useMemo(
      () => {

        return Array
          .from(
            new Set(
              rows
                .map(
                  row =>
                    row.provider
                )
                .filter(
                  Boolean
                )
            )
          )
          .sort();

      },
      [
        rows,
      ]
    );


  // ==========================================================
  // FILTERED ROWS
  // ==========================================================

  const filteredRows =
    useMemo(
      () => {

        const query =
          search
            .trim()
            .toLowerCase();


        return rows.filter(
          row => {

            const rowClientKey =
              [
                row.workspaceId,
                row.brandId
                ||
                '',
              ].join(
                ':'
              );


            if (
              clientFilter !==
                'all'
              &&
              rowClientKey !==
                clientFilter
            ) {

              return false;

            }


            if (
              providerFilter !==
                'all'
              &&
              row.provider !==
                providerFilter
            ) {

              return false;

            }


            if (
              healthFilter !==
                'all'
              &&
              row.health !==
                healthFilter
            ) {

              return false;

            }


            if (!query) {

              return true;

            }


            const haystack =
              [

                row.workspaceName,
                row.brandName,
                row.workspaceId,
                row.brandId,
                row.provider,
                row.entity,
                row.providerAccountName,
                row.providerAccountId,
                row.connectionId,
                row.incrementalStatus,
                row.backfillStatus,
                row.lastError,

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
        rows,
        search,
        clientFilter,
        providerFilter,
        healthFilter,
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
        rows.length,

      healthy:
        rows.filter(
          row =>
            row.health ===
            'healthy'
        ).length,

      attention:
        rows.filter(
          row =>
            row.health ===
            'attention'
        ).length,

      critical:
        rows.filter(
          row =>
            row.health ===
            'critical'
        ).length,

      notMonitored:
        rows.filter(
          row =>
            row.health ===
            'not_monitored'
        ).length,

      clients:
        clients.length,

      providers:
        providers.length,

    };


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
          Loading Data Health...
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
              className="mt-0.5 text-red-600"
            />


            <div>

              <p
                className="
                  text-[10px]
                  font-semibold

                  text-red-800
                "
              >
                Unable to load Data Health
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
              loadDataHealth
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

            <Activity
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
              Data Health
            </h2>


            <p
              className="
                mt-0.5

                text-[9px]
                leading-4

                text-slate-500
              "
            >
              Cross-client view of source freshness, sync state, failure streaks and ingestion readiness.
            </p>

          </div>

        </div>


        <button

          type="button"

          onClick={
            loadDataHealth
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
          xl:grid-cols-7
        "
      >

        <SummaryCard
          label="Health Rows"
          value={summary.total}
        />


        <SummaryCard
          label="Healthy"
          value={summary.healthy}
          tone="green"
        />


        <SummaryCard
          label="Attention"
          value={summary.attention}
          tone="amber"
        />


        <SummaryCard
          label="Critical"
          value={summary.critical}
          tone="red"
        />


        <SummaryCard
          label="Not Monitored"
          value={summary.notMonitored}
          tone="slate"
        />


        <SummaryCard
          label="Clients"
          value={summary.clients}
          tone="violet"
        />


        <SummaryCard
          label="Providers"
          value={summary.providers}
        />

      </section>


      {/* =====================================================
          HEALTH SHORTCUTS
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-2

          md:grid-cols-2
          xl:grid-cols-4
        "
      >

        <HealthShortcut
          icon={XCircle}
          title="Critical"
          value={summary.critical}
          description="Failed connections, failed sync state or active failure streaks."
          tone="red"
          onClick={() =>
            setHealthFilter(
              'critical'
            )
          }
        />


        <HealthShortcut
          icon={AlertTriangle}
          title="Needs Attention"
          value={summary.attention}
          description="Pending work or materially overdue synchronization."
          tone="amber"
          onClick={() =>
            setHealthFilter(
              'attention'
            )
          }
        />


        <HealthShortcut
          icon={CheckCircle2}
          title="Healthy"
          value={summary.healthy}
          description="Successful operational state with no active failure signal."
          tone="green"
          onClick={() =>
            setHealthFilter(
              'healthy'
            )
          }
        />


        <HealthShortcut
          icon={ServerCog}
          title="Not Monitored"
          value={summary.notMonitored}
          description="Connection exists, but the provider is not yet publishing runtime sync telemetry."
          tone="slate"
          onClick={() =>
            setHealthFilter(
              'not_monitored'
            )
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

            placeholder="Search client, provider, entity, error..."

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
            clientFilter
          }

          onChange={
            event =>
              setClientFilter(
                event.target.value
              )
          }

          className="gos-input"

        >

          <option value="all">
            All Clients
          </option>


          {clients.map(
            client => (

              <option
                key={
                  client.value
                }
                value={
                  client.value
                }
              >
                {client.label}
              </option>

            )
          )}

        </select>


        <select

          value={
            providerFilter
          }

          onChange={
            event =>
              setProviderFilter(
                event.target.value
              )
          }

          className="gos-input"

        >

          <option value="all">
            All Providers
          </option>


          {providers.map(
            provider => (

              <option
                key={
                  provider
                }
                value={
                  provider
                }
              >
                {formatProvider(
                  provider
                )}
              </option>

            )
          )}

        </select>


        <select

          value={
            healthFilter
          }

          onChange={
            event =>
              setHealthFilter(
                event.target.value as HealthFilter
              )
          }

          className="gos-input"

        >

          <option value="all">
            All Health
          </option>

          <option value="critical">
            Critical
          </option>

          <option value="attention">
            Attention
          </option>

          <option value="healthy">
            Healthy
          </option>

          <option value="not_monitored">
            Not Monitored
          </option>

        </select>


        <div
          className="
            ml-auto

            text-[9px]

            text-slate-500
          "
        >
          {filteredRows.length}
          {' / '}
          {rows.length}
          {' rows'}
        </div>

      </section>


      {/* =====================================================
          TABLE
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
            Integration Health
          </h3>


          <p
            className="
              mt-0.5

              text-[9px]

              text-slate-500
            "
          >
            One operational row per connection/entity, including connected providers that are not yet publishing sync telemetry.
          </p>

        </div>


        <div className="overflow-x-auto">

          <table
            className="
              w-full
              min-w-[1400px]

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
                  Provider
                </TableHeader>

                <TableHeader>
                  Entity
                </TableHeader>

                <TableHeader>
                  Health
                </TableHeader>

                <TableHeader>
                  Connection
                </TableHeader>

                <TableHeader>
                  Incremental
                </TableHeader>

                <TableHeader>
                  Backfill
                </TableHeader>

                <TableHeader>
                  Freshness
                </TableHeader>

                <TableHeader>
                  Last Sync
                </TableHeader>

                <TableHeader>
                  Failures
                </TableHeader>

                <TableHeader>
                  Last Error
                </TableHeader>

              </tr>

            </thead>


            <tbody>

              {filteredRows.map(
                row => (

                  <tr

                    key={
                      [
                        row.workspaceId,
                        row.brandId,
                        row.connectionId,
                        row.provider,
                        row.entity,
                      ].join(
                        ':'
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
                          text-[10px]
                          font-semibold

                          text-slate-900
                        "
                      >
                        {row.brandName
                          ||
                          row.workspaceName
                          ||
                          row.brandId
                          ||
                          row.workspaceId}
                      </div>


                      <div
                        className="
                          mt-0.5

                          text-[8px]

                          text-slate-500
                        "
                      >
                        {row.workspaceId}

                        {row.brandId && (
                          <>
                            {' · '}
                            {row.brandId}
                          </>
                        )}
                      </div>

                    </td>


                    {/* PROVIDER */}

                    <td className="px-3 py-2.5">

                      <div
                        className="
                          flex
                          items-center
                          gap-2
                        "
                      >

                        <div
                          className="
                            flex
                            h-7
                            w-7
                            shrink-0
                            items-center
                            justify-center

                            rounded-[7px]

                            bg-violet-50

                            text-violet-600
                          "
                        >

                          <ServerCog
                            size={13}
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
                            {formatProvider(
                              row.provider
                            )}
                          </div>


                          <div
                            className="
                              mt-0.5
                              max-w-[170px]

                              truncate

                              text-[8px]

                              text-slate-500
                            "
                          >
                            {row.providerAccountName
                              ||
                              row.providerAccountId
                              ||
                              row.connectionMode
                              ||
                              '—'}
                          </div>

                        </div>

                      </div>

                    </td>


                    {/* ENTITY */}

                    <td className="px-3 py-2.5">

                      <span
                        className="
                          text-[10px]
                          font-semibold

                          text-slate-700
                        "
                      >
                        {formatEntity(
                          row.entity
                        )}
                      </span>

                    </td>


                    {/* HEALTH */}

                    <td className="px-3 py-2.5">

                      <HealthBadge
                        health={
                          row.health
                        }
                      />

                    </td>


                    {/* CONNECTION */}

                    <td className="px-3 py-2.5">

                      <StateBadge
                        value={
                          row.connectionStatus
                        }
                      />

                    </td>


                    {/* INCREMENTAL */}

                    <td className="px-3 py-2.5">

                      <StateBadge
                        value={
                          row.incrementalStatus
                        }
                      />

                    </td>


                    {/* BACKFILL */}

                    <td className="px-3 py-2.5">

                      <StateBadge
                        value={
                          row.backfillStatus
                        }
                      />

                    </td>


                    {/* FRESHNESS */}

                    <td
                      className="
                        px-3
                        py-2.5

                        text-[9px]

                        text-slate-600
                      "
                    >
                      {formatFreshness(
                        row.freshnessMinutes
                      )}
                    </td>


                    {/* LAST SYNC */}

                    <td
                      className="
                        px-3
                        py-2.5

                        text-[9px]

                        text-slate-600
                      "
                    >
                      {formatTimestamp(
                        row.lastSyncedAt
                      )
                      ||
                      'Never'}
                    </td>


                    {/* FAILURES */}

                    <td className="px-3 py-2.5">

                      <span
                        className={`
                          text-[10px]
                          font-semibold

                          ${
                            row.consecutiveFailures >
                              0

                              ? 'text-red-700'

                              : 'text-slate-700'
                          }
                        `}
                      >
                        {row.consecutiveFailures}
                      </span>

                    </td>


                    {/* ERROR */}

                    <td className="px-3 py-2.5">

                      <div
                        title={
                          row.lastError
                          ||
                          ''
                        }
                        className="
                          max-w-[260px]

                          truncate

                          text-[9px]

                          text-slate-500
                        "
                      >
                        {row.lastError
                          ||
                          '—'}
                      </div>

                    </td>

                  </tr>

                )
              )}


              {filteredRows.length ===
                0 && (

                <tr>

                  <td
                    colSpan={
                      11
                    }

                    className="
                      px-4
                      py-14

                      text-center

                      text-[10px]

                      text-slate-500
                    "
                  >
                    No Data Health rows match the selected filters.
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
          Source of truth: growthos_control.integration_sync_state and integration_connections. This screen is read-only and does not trigger synchronization or retry jobs.
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
    number;

  tone?:
    | 'default'
    | 'green'
    | 'amber'
    | 'red'
    | 'violet'
    | 'slate';

}) {


  const valueClass =

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

          text-[18px]
          font-semibold
          tracking-[-0.03em]

          ${valueClass}
        `}
      >
        {formatNumber(
          value
        )}
      </p>

    </div>

  );

}


// ============================================================
// HEALTH SHORTCUT
// ============================================================

function HealthShortcut({

  icon:
    Icon,

  title,

  value,

  description,

  tone,

  onClick,

}: {

  icon:
    any;

  title:
    string;

  value:
    number;

  description:
    string;

  tone:
    | 'green'
    | 'amber'
    | 'red'
    | 'slate';

  onClick:
    () => void;

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

          : 'border-slate-200 bg-slate-50 text-slate-600';


  return (

    <button

      type="button"

      onClick={
        onClick
      }

      className={`
        rounded-[10px]

        border

        p-3

        text-left

        transition

        hover:-translate-y-[1px]

        ${classes}
      `}
    >

      <div
        className="
          flex
          items-center
          justify-between
          gap-3
        "
      >

        <div
          className="
            flex
            items-center
            gap-2
          "
        >

          <Icon
            size={14}
          />


          <span
            className="
              text-[10px]
              font-semibold
            "
          >
            {title}
          </span>

        </div>


        <span
          className="
            text-[18px]
            font-semibold
            tracking-[-0.03em]

            text-slate-950
          "
        >
          {formatNumber(
            value
          )}
        </span>

      </div>


      <p
        className="
          mt-2

          text-[8px]
          leading-4

          text-slate-500
        "
      >
        {description}
      </p>

    </button>

  );

}


// ============================================================
// HEALTH BADGE
// ============================================================

function HealthBadge({

  health,

}: {

  health:
    HealthStatus;

}) {


  if (
    health ===
      'healthy'
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
        Healthy
      </span>

    );

  }


  if (
    health ===
      'critical'
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
        Critical
      </span>

    );

  }


  if (
    health ===
      'not_monitored'
  ) {

    return (

      <span
        className="
          inline-flex

          rounded-full

          border
          border-slate-200

          bg-slate-50

          px-2
          py-0.5

          text-[8px]
          font-semibold

          text-slate-600
        "
      >
        Not Monitored
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
      Attention
    </span>

  );

}


// ============================================================
// STATE BADGE
// ============================================================

function StateBadge({

  value,

}: {

  value:
    string |
    null;

}) {


  if (!value) {

    return (

      <span
        className="
          text-[9px]

          text-slate-400
        "
      >
        —
      </span>

    );

  }


  const normalized =
    value.toLowerCase();


  const good =
    [
      'connected',
      'ready',
      'success',
      'completed',
      'active',
    ].includes(
      normalized
    );


  const bad =
    [
      'failed',
      'error',
      'disconnected',
      'suspended',
    ].includes(
      normalized
    );


  const classes =
    good

      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'

      : bad

        ? 'border-red-200 bg-red-50 text-red-700'

        : 'border-amber-200 bg-amber-50 text-amber-700';


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
      {formatLabel(
        value
      )}
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
    ReactNode;

}) {

  return (

    <th
      className="
        h-8

        px-3

        text-left

        text-[8px]
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
// FORMATTERS
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
    value
  );

}


function formatProvider(
  value:
    string
) {

  const labels:
    Record<
      string,
      string
    > = {

    shopify:
      'Shopify',

    meta_ads:
      'Meta Ads',

    google_ads:
      'Google Ads',

    bigquery:
      'BigQuery',

  };


  return labels[
    value
  ]
  ||
  formatLabel(
    value
  );

}


function formatEntity(
  value:
    string |
    null
) {

  if (!value) {

    return 'Connection';

  }


  return formatLabel(
    value
  );

}


function formatLabel(
  value:
    string
) {

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


function formatFreshness(
  minutes:
    number |
    null
) {

  if (
    minutes ===
    null
  ) {

    return 'No telemetry';

  }


  if (
    minutes <
    60
  ) {

    return `${formatNumber(
      minutes
    )} min`;

  }


  if (
    minutes <
    1440
  ) {

    const hours =
      minutes /
      60;


    return `${hours.toFixed(
      hours >=
        10

        ? 0

        : 1
    )} hr`;

  }


  const days =
    minutes /
    1440;


  return `${days.toFixed(
    days >=
      10

      ? 0

      : 1
  )} d`;

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