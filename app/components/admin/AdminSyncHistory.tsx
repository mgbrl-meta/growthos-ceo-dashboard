'use client';

import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';


// ============================================================
// TYPES
// ============================================================

type SyncRunStatus =
  | 'success'
  | 'running'
  | 'failed'
  | 'partial'
  | 'queued';


type SyncRun = {

  runId:
    string;

  workspaceId:
    string;

  workspaceName:
    string | null;

  brandId:
    string;

  brandName:
    string | null;

  connectionId:
    string;

  provider:
    string;

  entity:
    string;

  syncType:
    string;

  status:
    SyncRunStatus;

  attempt:
    number;

  startedAt:
    string | null;

  completedAt:
    string | null;

  durationMs:
    number | null;

  sourceStartAt:
    string | null;

  sourceEndAt:
    string | null;

  recordsFetched:
    number;

  recordsLoaded:
    number;

  recordsRejected:
    number;

  bytesProcessed:
    number;

  cursorBefore:
    string | null;

  cursorAfter:
    string | null;

  errorCode:
    string | null;

  errorMessage:
    string | null;

};


type SyncHistoryResponse = {

  ok:
    boolean;

  scope?:
    string;

  summary?: {

    total:
      number;

    running:
      number;

    success:
      number;

    partial:
      number;

    failed:
      number;

    clients:
      number;

    providers:
      number;

  };

  runs?:
    SyncRun[];

  meta?: {

    durationMs?:
      number;

    source?:
      string;

    limit?:
      number;

    readOnly?:
      boolean;

  };

  error?:
    string;

};


type StatusFilter =
  | 'all'
  | SyncRunStatus;


// ============================================================
// MAIN
// ============================================================

export default function AdminSyncHistory() {


  const [
    data,
    setData,
  ] =
    useState<SyncHistoryResponse | null>(
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
    statusFilter,
    setStatusFilter,
  ] =
    useState<StatusFilter>(
      'all'
    );


  const [
    syncTypeFilter,
    setSyncTypeFilter,
  ] =
    useState(
      'all'
    );


  const [
    selectedRunId,
    setSelectedRunId,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  // ==========================================================
  // LOAD REAL RUN HISTORY
  // ==========================================================

  async function loadSyncHistory() {

    setLoading(
      true
    );


    setError(
      null
    );


    try {

      const response =
        await fetch(
          '/api/admin/sync-history',
          {

            cache:
              'no-store',

            credentials:
              'same-origin',

          }
        );


      const json:
        SyncHistoryResponse =
          await response.json();


      if (
        !response.ok
        ||
        !json.ok
      ) {

        throw new Error(
          json.error
          ||
          'Unable to load Sync History'
        );

      }


      setData(
        json
      );

    } catch (
      error: any
    ) {

      console.error(
        'ADMIN_SYNC_HISTORY_UI_ERROR',
        error
      );


      setData(
        null
      );


      setError(
        String(
          error?.message
          ||
          'Unable to load Sync History'
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

      loadSyncHistory();

    },
    []
  );


  // ==========================================================
  // REAL RUNS
  // ==========================================================

  const runs =
    data?.runs
    ||
    [];


  // ==========================================================
  // CLIENT OPTIONS
  // ==========================================================

  const clients =
    useMemo(
      () => {

        const map =
          new Map<
            string,
            string
          >();


        runs.forEach(
          run => {

            const value =
              getClientKey(
                run
              );


            const label =
              run.brandName
              ||
              run.workspaceName
              ||
              run.brandId
              ||
              run.workspaceId;


            map.set(
              value,
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
        runs,
      ]
    );


  // ==========================================================
  // PROVIDER OPTIONS
  // ==========================================================

  const providers =
    useMemo(
      () => {

        return Array
          .from(
            new Set(
              runs
                .map(
                  run =>
                    run.provider
                )
                .filter(
                  Boolean
                )
            )
          )
          .sort();

      },
      [
        runs,
      ]
    );


  // ==========================================================
  // SYNC TYPE OPTIONS
  // ==========================================================

  const syncTypes =
    useMemo(
      () => {

        return Array
          .from(
            new Set(
              runs
                .map(
                  run =>
                    run.syncType
                )
                .filter(
                  Boolean
                )
            )
          )
          .sort();

      },
      [
        runs,
      ]
    );


  // ==========================================================
  // FILTERED RUNS
  // ==========================================================

  const filteredRuns =
    useMemo(
      () => {

        const query =
          search
            .trim()
            .toLowerCase();


        return runs.filter(
          run => {


            // --------------------------------------------------
            // CLIENT
            // --------------------------------------------------

            if (
              clientFilter !==
                'all'
              &&
              getClientKey(
                run
              ) !==
                clientFilter
            ) {

              return false;

            }


            // --------------------------------------------------
            // PROVIDER
            // --------------------------------------------------

            if (
              providerFilter !==
                'all'
              &&
              run.provider !==
                providerFilter
            ) {

              return false;

            }


            // --------------------------------------------------
            // STATUS
            // --------------------------------------------------

            if (
              statusFilter !==
                'all'
              &&
              run.status !==
                statusFilter
            ) {

              return false;

            }


            // --------------------------------------------------
            // SYNC TYPE
            // --------------------------------------------------

            if (
              syncTypeFilter !==
                'all'
              &&
              run.syncType !==
                syncTypeFilter
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

                run.runId,
                run.workspaceId,
                run.workspaceName,
                run.brandId,
                run.brandName,
                run.connectionId,
                run.provider,
                run.entity,
                run.syncType,
                run.status,
                run.errorCode,
                run.errorMessage,

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
        runs,
        search,
        clientFilter,
        providerFilter,
        statusFilter,
        syncTypeFilter,
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
        runs.length,

      running:
        runs.filter(
          run =>
            run.status ===
              'running'
        ).length,

      success:
        runs.filter(
          run =>
            run.status ===
              'success'
        ).length,

      partial:
        runs.filter(
          run =>
            run.status ===
              'partial'
        ).length,

      failed:
        runs.filter(
          run =>
            run.status ===
              'failed'
        ).length,

      clients:
        clients.length,

      providers:
        providers.length,

    };


  // ==========================================================
  // SELECTED RUN
  // ==========================================================

  const selectedRun =
    runs.find(
      run =>
        run.runId ===
        selectedRunId
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
          Loading Sync History...
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
                Unable to load Sync History
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
              loadSyncHistory
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
    selectedRun
  ) {

    return (

      <SyncRunDetail

        run={
          selectedRun
        }

        onBack={() =>
          setSelectedRunId(
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
          TOOLBAR
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
            Sync History
          </h2>


          <p
            className="
              mt-0.5

              text-[10px]

              text-slate-500
            "
          >
            Real cross-client ingestion history from Growth OS sync-control telemetry.
          </p>

        </div>


        <button

          type="button"

          onClick={
            loadSyncHistory
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
          label="Runs"
          value={
            summary.total
          }
        />


        <SummaryCard
          label="Success"
          value={
            summary.success
          }
          tone="green"
        />


        <SummaryCard
          label="Failed"
          value={
            summary.failed
          }
          tone="red"
        />


        <SummaryCard
          label="Running"
          value={
            summary.running
          }
          tone="blue"
        />


        <SummaryCard
          label="Partial"
          value={
            summary.partial
          }
          tone="amber"
        />


        <SummaryCard
          label="Clients"
          value={
            summary.clients
          }
          tone="violet"
        />


        <SummaryCard
          label="Providers"
          value={
            summary.providers
          }
        />

      </section>


      {/* =====================================================
          STATUS QUICK FILTERS
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-2
          gap-2

          lg:grid-cols-4
        "
      >

        <StatusCard

          label="Failed"

          count={
            summary.failed
          }

          description="Runs that terminated with an execution error."

          tone="red"

          onClick={() =>
            setStatusFilter(
              'failed'
            )
          }

        />


        <StatusCard

          label="Running"

          count={
            summary.running
          }

          description="Sync executions currently in progress."

          tone="blue"

          onClick={() =>
            setStatusFilter(
              'running'
            )
          }

        />


        <StatusCard

          label="Partial"

          count={
            summary.partial
          }

          description="Runs that completed with only partial processing."

          tone="amber"

          onClick={() =>
            setStatusFilter(
              'partial'
            )
          }

        />


        <StatusCard

          label="Success"

          count={
            summary.success
          }

          description="Runs that completed successfully."

          tone="green"

          onClick={() =>
            setStatusFilter(
              'success'
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

            xl:max-w-[310px]
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

            placeholder="Search run, client, entity, error..."

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
            syncTypeFilter
          }

          onChange={
            event =>
              setSyncTypeFilter(
                event.target.value
              )
          }

          className="gos-input"
        >

          <option value="all">
            All Sync Types
          </option>


          {syncTypes.map(
            syncType => (

              <option
                key={
                  syncType
                }
                value={
                  syncType
                }
              >
                {formatLabel(
                  syncType
                )}
              </option>

            )
          )}

        </select>


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

          <option value="failed">
            Failed
          </option>

          <option value="running">
            Running
          </option>

          <option value="partial">
            Partial
          </option>

          <option value="success">
            Success
          </option>

          <option value="queued">
            Queued
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
          {filteredRuns.length}
          {' / '}
          {runs.length}
          {' runs'}
        </div>

      </section>


      {/* =====================================================
          RUN TABLE
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
              Sync Runs
            </h3>


            <p
              className="
                mt-0.5

                text-[9px]

                text-slate-500
              "
            >
              Immutable execution history from integration_sync_runs.
            </p>

          </div>


          {(
            statusFilter !==
              'all'
            ||
            clientFilter !==
              'all'
            ||
            providerFilter !==
              'all'
            ||
            syncTypeFilter !==
              'all'
            ||
            search
          ) && (

            <button

              type="button"

              onClick={() => {

                setSearch(
                  ''
                );

                setClientFilter(
                  'all'
                );

                setProviderFilter(
                  'all'
                );

                setStatusFilter(
                  'all'
                );

                setSyncTypeFilter(
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
              min-w-[1650px]

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
                  Run
                </TableHeader>

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
                  Type
                </TableHeader>

                <TableHeader>
                  Status
                </TableHeader>

                <TableHeader>
                  Started
                </TableHeader>

                <TableHeader>
                  Duration
                </TableHeader>

                <TableHeader>
                  Fetched
                </TableHeader>

                <TableHeader>
                  Loaded
                </TableHeader>

                <TableHeader>
                  Rejected
                </TableHeader>

                <TableHeader>
                  Attempt
                </TableHeader>

                <TableHeader>
                  Error
                </TableHeader>

                <TableHeader align="right">
                  Action
                </TableHeader>

              </tr>

            </thead>


            <tbody>

              {filteredRuns.map(
                run => (

                  <tr

                    key={
                      run.runId
                    }

                    className="
                      border-b
                      border-slate-100

                      last:border-0

                      hover:bg-slate-50/70
                    "
                  >


                    {/* RUN */}

                    <td
                      className="
                        max-w-[170px]

                        truncate

                        px-3
                        py-2

                        font-mono
                        text-[8px]

                        text-slate-500
                      "
                      title={
                        run.runId
                      }
                    >
                      {run.runId}
                    </td>


                    {/* CLIENT */}

                    <td className="px-3 py-2">

                      <div
                        className="
                          text-[10px]
                          font-semibold

                          text-slate-900
                        "
                      >
                        {getClientName(
                          run
                        )}
                      </div>


                      <div
                        className="
                          mt-0.5

                          text-[8px]

                          text-slate-500
                        "
                      >
                        {run.workspaceId}
                        {' · '}
                        {run.brandId}
                      </div>

                    </td>


                    {/* PROVIDER */}

                    <td
                      className="
                        px-3
                        py-2

                        text-[10px]

                        text-slate-700
                      "
                    >
                      {formatProvider(
                        run.provider
                      )}
                    </td>


                    {/* ENTITY */}

                    <td
                      className="
                        px-3
                        py-2

                        text-[10px]
                        font-semibold

                        text-slate-700
                      "
                    >
                      {formatLabel(
                        run.entity
                      )}
                    </td>


                    {/* SYNC TYPE */}

                    <td className="px-3 py-2">

                      <SmallBadge>
                        {formatLabel(
                          run.syncType
                        )}
                      </SmallBadge>

                    </td>


                    {/* STATUS */}

                    <td className="px-3 py-2">

                      <RunStatusBadge
                        status={
                          run.status
                        }
                      />

                    </td>


                    {/* STARTED */}

                    <td
                      className="
                        px-3
                        py-2

                        text-[9px]

                        text-slate-500
                      "
                    >
                      {formatTimestamp(
                        run.startedAt
                      )
                      ||
                      'Not started'}
                    </td>


                    {/* DURATION */}

                    <td
                      className="
                        px-3
                        py-2

                        text-[9px]
                        font-medium

                        text-slate-600
                      "
                    >
                      {formatRunDuration(
                        run
                      )}
                    </td>


                    {/* FETCHED */}

                    <td
                      className="
                        px-3
                        py-2

                        text-[10px]
                        font-semibold

                        text-slate-800
                      "
                    >
                      {formatNumber(
                        run.recordsFetched
                      )}
                    </td>


                    {/* LOADED */}

                    <td
                      className="
                        px-3
                        py-2

                        text-[10px]
                        font-semibold

                        text-slate-800
                      "
                    >
                      {formatNumber(
                        run.recordsLoaded
                      )}
                    </td>


                    {/* REJECTED */}

                    <td
                      className="
                        px-3
                        py-2

                        text-[10px]
                        font-semibold

                        text-slate-800
                      "
                    >
                      {formatNumber(
                        run.recordsRejected
                      )}
                    </td>


                    {/* ATTEMPT */}

                    <td
                      className="
                        px-3
                        py-2

                        text-[10px]

                        text-slate-600
                      "
                    >
                      {run.attempt}
                    </td>


                    {/* ERROR */}

                    <td className="px-3 py-2">

                      <div
                        title={
                          formatRunError(
                            run
                          )
                        }
                        className={`
                          max-w-[260px]

                          truncate

                          text-[9px]

                          ${
                            run.errorCode
                            ||
                            run.errorMessage

                              ? 'text-red-600'

                              : 'text-slate-400'
                          }
                        `}
                      >
                        {formatRunError(
                          run
                        )
                        ||
                        '—'}
                      </div>

                    </td>


                    {/* ACTION */}

                    <td className="px-3 py-2 text-right">

                      <button

                        type="button"

                        onClick={() =>
                          setSelectedRunId(
                            run.runId
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


              {filteredRuns.length ===
                0 && (

                <tr>

                  <td

                    colSpan={
                      14
                    }

                    className="
                      px-4
                      py-14

                      text-center

                      text-[10px]

                      text-slate-500
                    "
                  >
                    No sync runs match the selected filters.
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
          Source of truth: growthos_control.integration_sync_runs. This view is read-only and does not create, retry, start or complete synchronization jobs.
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
            {' · '}
            API limit: {formatNumber(
              data.meta.limit
              ??
              runs.length
            )} runs
          </p>

        )}

      </section>

    </div>

  );

}


// ============================================================
// RUN DETAIL
// ============================================================

function SyncRunDetail({

  run,

  onBack,

}: {

  run:
    SyncRun;

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
                items-center
                justify-center

                rounded-[8px]

                border
                border-slate-200

                bg-white

                text-slate-700

                hover:bg-slate-50
              "
            >
              ←
            </button>


            <div
              className="
                flex
                h-9
                w-9
                items-center
                justify-center

                rounded-[9px]

                bg-violet-50

                text-violet-600
              "
            >

              <RefreshCw
                size={16}
              />

            </div>


            <div>

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
                    text-[14px]
                    font-semibold

                    text-slate-950
                  "
                >
                  Sync Run
                </h2>


                <RunStatusBadge
                  status={
                    run.status
                  }
                />

              </div>


              <p
                className="
                  mt-0.5

                  max-w-[620px]

                  truncate

                  font-mono
                  text-[8px]

                  text-slate-500
                "
                title={
                  run.runId
                }
              >
                {run.runId}
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

          md:grid-cols-5
        "
      >

        <SummaryCard
          label="Status"
          value={
            formatStatus(
              run.status
            )
          }
        />


        <SummaryCard
          label="Fetched"
          value={
            formatNumber(
              run.recordsFetched
            )
          }
        />


        <SummaryCard
          label="Loaded"
          value={
            formatNumber(
              run.recordsLoaded
            )
          }
        />


        <SummaryCard
          label="Duration"
          value={
            formatRunDuration(
              run
            )
          }
        />


        <SummaryCard
          label="Attempt"
          value={
            run.attempt
          }
        />

      </section>


      {/* =====================================================
          CORE DETAILS
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
            SOURCE
        =================================================== */}

        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Source
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Client"
              value={
                getClientName(
                  run
                )
              }
            />


            <ValueRow
              label="Workspace ID"
              value={
                run.workspaceId
              }
              mono
            />


            <ValueRow
              label="Brand ID"
              value={
                run.brandId
              }
              mono
            />


            <ValueRow
              label="Provider"
              value={
                formatProvider(
                  run.provider
                )
              }
            />


            <ValueRow
              label="Entity"
              value={
                formatLabel(
                  run.entity
                )
              }
            />


            <ValueRow
              label="Sync Type"
              value={
                formatLabel(
                  run.syncType
                )
              }
            />


            <ValueRow
              label="Connection ID"
              value={
                run.connectionId
              }
              mono
            />

          </div>

        </section>


        {/* ===================================================
            TIMING
        =================================================== */}

        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Timing
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Started"
              value={
                formatTimestamp(
                  run.startedAt
                )
                ||
                'Not started'
              }
            />


            <ValueRow
              label="Completed"
              value={
                formatTimestamp(
                  run.completedAt
                )
                ||
                'Not completed'
              }
            />


            <ValueRow
              label="Duration"
              value={
                formatRunDuration(
                  run
                )
              }
            />


            <ValueRow
              label="Source Start"
              value={
                formatTimestamp(
                  run.sourceStartAt
                )
                ||
                '—'
              }
            />


            <ValueRow
              label="Source End"
              value={
                formatTimestamp(
                  run.sourceEndAt
                )
                ||
                '—'
              }
            />


            <ValueRow
              label="Attempt"
              value={
                String(
                  run.attempt
                )
              }
            />

          </div>

        </section>


        {/* ===================================================
            PROCESSING
        =================================================== */}

        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Processing
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Records Fetched"
              value={
                formatNumber(
                  run.recordsFetched
                )
              }
            />


            <ValueRow
              label="Records Loaded"
              value={
                formatNumber(
                  run.recordsLoaded
                )
              }
            />


            <ValueRow
              label="Records Rejected"
              value={
                formatNumber(
                  run.recordsRejected
                )
              }
            />


            <ValueRow
              label="Bytes Processed"
              value={
                formatBytes(
                  run.bytesProcessed
                )
              }
            />

          </div>

        </section>


        {/* ===================================================
            CURSOR
        =================================================== */}

        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Cursor / Watermark
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Cursor Before"
              value={
                run.cursorBefore
                ||
                '—'
              }
              mono
            />


            <ValueRow
              label="Cursor After"
              value={
                run.cursorAfter
                ||
                '—'
              }
              mono
            />

          </div>


          <div
            className="
              mt-3

              rounded-[8px]

              border
              border-slate-200

              bg-slate-50

              p-2.5
            "
          >

            <p
              className="
                text-[8px]
                leading-4

                text-slate-500
              "
            >
              Cursor values are shown exactly as stored by the provider sync engine. A null cursor is valid where the integration uses source timestamps or another durable watermark instead.
            </p>

          </div>

        </section>

      </section>


      {/* =====================================================
          ERROR
      ===================================================== */}

      {(
        run.errorCode
        ||
        run.errorMessage
      ) && (

        <section
          className="
            rounded-[10px]

            border
            border-red-200

            bg-red-50

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

            <AlertCircle
              size={15}

              className="
                mt-0.5
                shrink-0

                text-red-600
              "
            />


            <div className="min-w-0">

              <p
                className="
                  text-[10px]
                  font-semibold

                  text-red-800
                "
              >
                Sync Error
              </p>


              {run.errorCode && (

                <p
                  className="
                    mt-1

                    font-mono
                    text-[8px]

                    text-red-600
                  "
                >
                  {run.errorCode}
                </p>

              )}


              {run.errorMessage && (

                <p
                  className="
                    mt-1

                    break-words

                    font-mono
                    text-[9px]
                    leading-4

                    text-red-700
                  "
                >
                  {run.errorMessage}
                </p>

              )}

            </div>

          </div>

        </section>

      )}


      {/* =====================================================
          SOURCE OF TRUTH
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
          Immutable execution history
        </p>


        <p
          className="
            mt-1

            text-[8px]
            leading-4

            text-violet-600
          "
        >
          This run is read directly from growthos_control.integration_sync_runs. Sync History does not simulate, create or mutate run state.
        </p>

      </section>

    </div>

  );

}


// ============================================================
// STATUS CARD
// ============================================================

function StatusCard({

  label,

  count,

  description,

  tone,

  onClick,

}: {

  label:
    string;

  count:
    number;

  description:
    string;

  tone:
    | 'green'
    | 'red'
    | 'blue'
    | 'amber';

  onClick:
    () => void;

}) {


  const cls =
    tone ===
      'green'

      ? 'border-emerald-200 bg-emerald-50'

      : tone ===
          'red'

        ? 'border-red-200 bg-red-50'

        : tone ===
            'blue'

          ? 'border-blue-200 bg-blue-50'

          : 'border-amber-200 bg-amber-50';


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

        ${cls}
      `}
    >

      <div
        className="
          flex
          items-center
          justify-between
        "
      >

        <span
          className="
            text-[10px]
            font-semibold

            text-slate-700
          "
        >
          {label}
        </span>


        <span
          className="
            text-[18px]
            font-semibold

            text-slate-950
          "
        >
          {formatNumber(
            count
          )}
        </span>

      </div>


      <p
        className="
          mt-1

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
// RUN STATUS
// ============================================================

function RunStatusBadge({

  status,

}: {

  status:
    SyncRunStatus;

}) {


  if (
    status ===
      'success'
  ) {

    return (

      <Badge
        icon={
          CheckCircle2
        }
        label="Success"
        className="border-emerald-200 bg-emerald-50 text-emerald-700"
      />

    );

  }


  if (
    status ===
      'failed'
  ) {

    return (

      <Badge
        icon={
          XCircle
        }
        label="Failed"
        className="border-red-200 bg-red-50 text-red-700"
      />

    );

  }


  if (
    status ===
      'running'
  ) {

    return (

      <Badge
        icon={
          LoaderCircle
        }
        label="Running"
        className="border-blue-200 bg-blue-50 text-blue-700"
      />

    );

  }


  if (
    status ===
      'partial'
  ) {

    return (

      <Badge
        icon={
          AlertCircle
        }
        label="Partial"
        className="border-amber-200 bg-amber-50 text-amber-700"
      />

    );

  }


  return (

    <Badge
      icon={
        Clock3
      }
      label="Queued"
      className="border-slate-200 bg-slate-50 text-slate-600"
    />

  );

}


// ============================================================
// BADGE
// ============================================================

function Badge({

  icon:
    Icon,

  label,

  className,

}: {

  icon:
    any;

  label:
    string;

  className:
    string;

}) {

  return (

    <span
      className={`
        inline-flex
        items-center
        gap-1

        rounded-full

        border

        px-2
        py-0.5

        text-[8px]
        font-semibold

        ${className}
      `}
    >

      <Icon
        size={10}
      />

      {label}

    </span>

  );

}


// ============================================================
// SMALL BADGE
// ============================================================

function SmallBadge({

  children,

}: {

  children:
    ReactNode;

}) {

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
      {children}
    </span>

  );

}


// ============================================================
// SUMMARY
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
    | 'blue'
    | 'amber'
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
            'blue'

          ? 'text-blue-700'

          : tone ===
              'amber'

            ? 'text-amber-700'

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

function getClientKey(
  run:
    SyncRun
) {

  return [
    run.workspaceId,
    run.brandId,
  ].join(
    ':'
  );

}


function getClientName(
  run:
    SyncRun
) {

  return (
    run.brandName
    ||
    run.workspaceName
    ||
    run.brandId
    ||
    run.workspaceId
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


function getEffectiveDurationMs(
  run:
    SyncRun
) {

  if (
    run.durationMs !==
      null
    &&
    Number.isFinite(
      run.durationMs
    )
  ) {

    return Math.max(
      0,
      run.durationMs
    );

  }


  if (
    run.startedAt
    &&
    run.completedAt
  ) {

    const start =
      new Date(
        run.startedAt
      ).getTime();


    const end =
      new Date(
        run.completedAt
      ).getTime();


    if (
      Number.isFinite(
        start
      )
      &&
      Number.isFinite(
        end
      )
      &&
      end >=
        start
    ) {

      return end
      -
      start;

    }

  }


  return null;

}


function formatRunDuration(
  run:
    SyncRun
) {

  const durationMs =
    getEffectiveDurationMs(
      run
    );


  if (
    durationMs ===
    null
  ) {

    return '—';

  }


  if (
    durationMs <
    1000
  ) {

    return `${Math.round(
      durationMs
    )} ms`;

  }


  const totalSeconds =
    Math.round(
      durationMs /
      1000
    );


  if (
    totalSeconds <
    60
  ) {

    return `${totalSeconds}s`;

  }


  const minutes =
    Math.floor(
      totalSeconds /
      60
    );


  const seconds =
    totalSeconds %
    60;


  if (
    minutes <
    60
  ) {

    return `${minutes}m ${seconds}s`;

  }


  const hours =
    Math.floor(
      minutes /
      60
    );


  const remainingMinutes =
    minutes %
    60;


  return `${hours}h ${remainingMinutes}m`;

}


function formatStatus(
  status:
    SyncRunStatus
) {

  return formatLabel(
    status
  );

}


function formatRunError(
  run:
    SyncRun
) {

  if (
    run.errorCode
    &&
    run.errorMessage
  ) {

    return `${run.errorCode}: ${run.errorMessage}`;

  }


  return (
    run.errorMessage
    ||
    run.errorCode
    ||
    ''
  );

}


function formatBytes(
  value:
    number
) {

  if (
    !value
    ||
    value <
      0
  ) {

    return '0 B';

  }


  if (
    value <
    1024
  ) {

    return `${formatNumber(
      value
    )} B`;

  }


  if (
    value <
    1024 *
    1024
  ) {

    return `${(
      value /
      1024
    ).toFixed(
      1
    )} KB`;

  }


  if (
    value <
    1024 *
    1024 *
    1024
  ) {

    return `${(
      value /
      (
        1024 *
        1024
      )
    ).toFixed(
      1
    )} MB`;

  }


  return `${(
    value /
    (
      1024 *
      1024 *
      1024
    )
  ).toFixed(
    2
  )} GB`;

}