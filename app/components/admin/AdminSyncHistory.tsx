'use client';

import {
  type ReactNode,
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
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';

import {
  useAdminStore,
} from './AdminStore';


// ============================================================
// TYPES
// ============================================================

type SyncRunStatus =
  | 'success'
  | 'running'
  | 'failed'
  | 'queued';


type SyncRun = {

  id:
    string;

  clientId:
    string;

  providerId:
    string;

  startedAt:
    string | null;

  completedAt:
    string | null;

  status:
    SyncRunStatus;

  records:
    number;

  durationSeconds:
    number | null;

  error:
    string | null;

  attempt:
    number;

};


// ============================================================
// MAIN
// ============================================================

export default function AdminSyncHistory() {


  const {

    integrations,

    clients,

    integrationProviders,

    getClient,

    getIntegrationProvider,

  } =
    useAdminStore();


  // ==========================================================
  // LOCAL RUN HISTORY
  //
  // Later replace with actual sync-run/control tables.
  // ==========================================================

  const [
    runs,
    setRuns,
  ] =
    useState<SyncRun[]>(
      () =>
        buildInitialRuns(
          integrations
        )
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
    useState<
      'all'
      |
      SyncRunStatus
    >(
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

            if (
              clientFilter !==
                'all'
              &&
              run.clientId !==
                clientFilter
            ) {

              return false;

            }


            if (
              providerFilter !==
                'all'
              &&
              run.providerId !==
                providerFilter
            ) {

              return false;

            }


            if (
              statusFilter !==
                'all'
              &&
              run.status !==
                statusFilter
            ) {

              return false;

            }


            if (!query) {

              return true;

            }


            const client =
              getClient(
                run.clientId
              );


            const provider =
              getIntegrationProvider(
                run.providerId
              );


            return (

              run.id
                .toLowerCase()
                .includes(
                  query
                )

              ||

              (
                client?.name ||
                ''
              )
                .toLowerCase()
                .includes(
                  query
                )

              ||

              (
                provider?.name ||
                ''
              )
                .toLowerCase()
                .includes(
                  query
                )

              ||

              (
                run.error ||
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
        runs,
        search,
        clientFilter,
        providerFilter,
        statusFilter,
        clients,
        integrationProviders,
      ]
    );


  // ==========================================================
  // COUNTS
  // ==========================================================

  const successCount =
    runs.filter(
      run =>
        run.status ===
        'success'
    ).length;


  const failedCount =
    runs.filter(
      run =>
        run.status ===
        'failed'
    ).length;


  const runningCount =
    runs.filter(
      run =>
        run.status ===
        'running'
    ).length;


  const queuedCount =
    runs.filter(
      run =>
        run.status ===
        'queued'
    ).length;


  // ==========================================================
  // SELECTED
  // ==========================================================

  const selectedRun =
    runs.find(
      run =>
        run.id ===
        selectedRunId
    )
    ||
    null;


  // ==========================================================
  // RETRY
  // ==========================================================

  function retryRun(
    run:
      SyncRun
  ) {

    const retry:
      SyncRun = {

      id:
        `run-${Date.now()}`,

      clientId:
        run.clientId,

      providerId:
        run.providerId,

      startedAt:
        null,

      completedAt:
        null,

      status:
        'queued',

      records:
        0,

      durationSeconds:
        null,

      error:
        null,

      attempt:
        run.attempt
        +
        1,

    };


    setRuns(
      previous => [
        retry,
        ...previous,
      ]
    );


    setSelectedRunId(
      retry.id
    );

  }


  // ==========================================================
  // SIMULATE START
  // ==========================================================

  function startQueuedRun(
    runId:
      string
  ) {

    setRuns(
      previous =>
        previous.map(
          run =>

            run.id ===
              runId

              ? {
                  ...run,

                  status:
                    'running',

                  startedAt:
                    formatNow(),

                }

              : run
        )
    );

  }


  // ==========================================================
  // SIMULATE COMPLETE
  // ==========================================================

  function completeRun(
    runId:
      string
  ) {

    setRuns(
      previous =>
        previous.map(
          run =>

            run.id ===
              runId

              ? {
                  ...run,

                  status:
                    'success',

                  completedAt:
                    formatNow(),

                  records:
                    Math.max(
                      run.records,
                      1250
                    ),

                  durationSeconds:
                    run.durationSeconds
                    ??
                    42,

                  error:
                    null,

                }

              : run
        )
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

        onRetry={() =>
          retryRun(
            selectedRun
          )
        }

        onStart={() =>
          startQueuedRun(
            selectedRun.id
          )
        }

        onComplete={() =>
          completeRun(
            selectedRun.id
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
            Review ingestion runs, failures, records processed and retry history.
          </p>

        </div>


        <div
          className="
            flex
            flex-col
            gap-2

            sm:flex-row
            sm:flex-wrap
          "
        >

          <div
            className="
              relative

              w-full

              sm:w-[220px]
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

              placeholder="Search sync runs"

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
                    client.id
                  }
                  value={
                    client.id
                  }
                >
                  {client.name}
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
              All Sources
            </option>


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


          <select

            value={
              statusFilter
            }

            onChange={
              event =>
                setStatusFilter(
                  event.target.value as
                    'all'
                    |
                    SyncRunStatus
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

            <option value="queued">
              Queued
            </option>

            <option value="success">
              Success
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

          xl:grid-cols-5
        "
      >

        <SummaryCard
          label="Runs"
          value={
            runs.length
          }
        />


        <SummaryCard
          label="Success"
          value={
            successCount
          }
          tone="green"
        />


        <SummaryCard
          label="Failed"
          value={
            failedCount
          }
          tone="red"
        />


        <SummaryCard
          label="Running"
          value={
            runningCount
          }
          tone="blue"
        />


        <SummaryCard
          label="Queued"
          value={
            queuedCount
          }
          tone="amber"
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
            failedCount
          }

          description="Runs that require investigation or retry."

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
            runningCount
          }

          description="Jobs currently processing."

          tone="blue"

          onClick={() =>
            setStatusFilter(
              'running'
            )
          }

        />


        <StatusCard

          label="Queued"

          count={
            queuedCount
          }

          description="Jobs waiting to start."

          tone="amber"

          onClick={() =>
            setStatusFilter(
              'queued'
            )
          }

        />


        <StatusCard

          label="Success"

          count={
            successCount
          }

          description="Runs completed successfully."

          tone="green"

          onClick={() =>
            setStatusFilter(
              'success'
            )
          }

        />

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
              {filteredRuns.length} run{filteredRuns.length === 1 ? '' : 's'}
            </p>

          </div>


          {statusFilter !==
            'all' && (

            <button

              type="button"

              onClick={() =>
                setStatusFilter(
                  'all'
                )
              }

              className="
                text-[9px]
                font-semibold

                text-violet-600
              "
            >
              Clear filter
            </button>

          )}

        </div>


        <div className="overflow-x-auto">

          <table
            className="
              min-w-[1200px]
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
                  Run
                </TableHeader>

                <TableHeader>
                  Client
                </TableHeader>

                <TableHeader>
                  Source
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
                  Records
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
                run => {

                  const client =
                    getClient(
                      run.clientId
                    );


                  const provider =
                    getIntegrationProvider(
                      run.providerId
                    );


                  return (

                    <tr
                      key={
                        run.id
                      }

                      className="
                        border-b
                        border-slate-100

                        last:border-0

                        hover:bg-slate-50/70
                      "
                    >

                      <td
                        className="
                          px-3
                          py-2

                          font-mono
                          text-[8px]

                          text-slate-500
                        "
                      >
                        {run.id}
                      </td>


                      <td
                        className="
                          px-3
                          py-2

                          text-[10px]
                          font-semibold

                          text-slate-900
                        "
                      >
                        {client?.name ||
                          run.clientId}
                      </td>


                      <td
                        className="
                          px-3
                          py-2

                          text-[10px]

                          text-slate-700
                        "
                      >
                        {provider?.name ||
                          run.providerId}
                      </td>


                      <td className="px-3 py-2">

                        <RunStatusBadge
                          status={
                            run.status
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
                        {run.startedAt ||
                          'Not started'}
                      </td>


                      <td
                        className="
                          px-3
                          py-2

                          text-[9px]
                          font-medium

                          text-slate-600
                        "
                      >
                        {formatDuration(
                          run.durationSeconds
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
                        {formatNumber(
                          run.records
                        )}
                      </td>


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


                      <td
                        className="
                          max-w-[260px]

                          truncate

                          px-3
                          py-2

                          text-[9px]

                          text-red-600
                        "
                      >
                        {run.error ||
                          '—'}
                      </td>


                      <td className="px-3 py-2 text-right">

                        <button

                          type="button"

                          onClick={() =>
                            setSelectedRunId(
                              run.id
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
                          "
                        >

                          Inspect

                          <ChevronRight
                            size={12}
                          />

                        </button>

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
// RUN DETAIL
// ============================================================

function SyncRunDetail({

  run,

  onBack,

  onRetry,

  onStart,

  onComplete,

}: {

  run:
    SyncRun;

  onBack:
    () => void;

  onRetry:
    () => void;

  onStart:
    () => void;

  onComplete:
    () => void;

}) {


  const {
    getClient,
    getIntegrationProvider,
  } =
    useAdminStore();


  const client =
    getClient(
      run.clientId
    );


  const provider =
    getIntegrationProvider(
      run.providerId
    );


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

                  font-mono
                  text-[8px]

                  text-slate-500
                "
              >
                {run.id}
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

            {run.status ===
              'failed' && (

              <button

                type="button"

                onClick={
                  onRetry
                }

                className="
                  inline-flex
                  h-8
                  items-center
                  gap-1.5

                  rounded-[8px]

                  bg-slate-950

                  px-3

                  text-[9px]
                  font-semibold

                  text-white
                "
              >

                <RotateCcw
                  size={13}
                />

                Retry

              </button>

            )}


            {run.status ===
              'queued' && (

              <button

                type="button"

                onClick={
                  onStart
                }

                className="
                  h-8

                  rounded-[8px]

                  bg-blue-600

                  px-3

                  text-[9px]
                  font-semibold

                  text-white
                "
              >
                Start Run
              </button>

            )}


            {run.status ===
              'running' && (

              <button

                type="button"

                onClick={
                  onComplete
                }

                className="
                  h-8

                  rounded-[8px]

                  bg-emerald-600

                  px-3

                  text-[9px]
                  font-semibold

                  text-white
                "
              >
                Complete Run
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
          label="Status"
          value={
            formatStatus(
              run.status
            )
          }
        />


        <SummaryCard
          label="Records"
          value={
            formatNumber(
              run.records
            )
          }
        />


        <SummaryCard
          label="Duration"
          value={
            formatDuration(
              run.durationSeconds
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
          RUN DETAILS
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
            Source
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Client"
              value={
                client?.name ||
                run.clientId
              }
            />


            <ValueRow
              label="Provider"
              value={
                provider?.name ||
                run.providerId
              }
            />


            <ValueRow
              label="Run ID"
              value={
                run.id
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


        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Timing
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Started"
              value={
                run.startedAt ||
                'Not started'
              }
            />


            <ValueRow
              label="Completed"
              value={
                run.completedAt ||
                'Not completed'
              }
            />


            <ValueRow
              label="Duration"
              value={
                formatDuration(
                  run.durationSeconds
                )
              }
            />


            <ValueRow
              label="Records"
              value={
                formatNumber(
                  run.records
                )
              }
            />

          </div>

        </section>

      </section>


      {/* =====================================================
          ERROR
      ===================================================== */}

      {run.error && (

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


            <div>

              <p
                className="
                  text-[10px]
                  font-semibold

                  text-red-800
                "
              >
                Sync Error
              </p>


              <p
                className="
                  mt-1

                  font-mono
                  text-[9px]
                  leading-4

                  text-red-700
                "
              >
                {run.error}
              </p>

            </div>

          </div>

        </section>

      )}


      {/* =====================================================
          BACKEND MAPPING
      ===================================================== */}

      <section
        className="
          rounded-[10px]

          border
          border-slate-200

          bg-slate-50

          p-3
        "
      >

        <p
          className="
            text-[10px]
            font-semibold

            text-slate-800
          "
        >
          Backend mapping
        </p>


        <p
          className="
            mt-1

            text-[9px]
            leading-4

            text-slate-500
          "
        >
          This screen is intentionally shaped to later consume the actual sync run ID, status, start/end timestamps, records processed, errors and retry attempts from your Growth OS sync-control tables.
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
    'green'
    |
    'red'
    |
    'blue'
    |
    'amber';

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
          {count}
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


  return (

    <Badge
      icon={
        Clock3
      }
      label="Queued"
      className="border-amber-200 bg-amber-50 text-amber-700"
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
    'default'
    |
    'green'
    |
    'red'
    |
    'blue'
    |
    'amber';

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
          max-w-[65%]

          truncate

          text-right
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
// INITIAL MOCK RUNS
//
// Generated from the existing client integration registry.
// ============================================================

function buildInitialRuns(
  integrations:
    Array<{
      clientId:
        string;

      providerId:
        string;

      connectionStatus:
        string;

      dataStatus:
        string;
    }>
) {

  const runs:
    SyncRun[] =
    [];


  integrations.forEach(
    (
      integration,
      index
    ) => {


      runs.push({

        id:
          `run-${integration.clientId}-${integration.providerId}-001`,

        clientId:
          integration.clientId,

        providerId:
          integration.providerId,

        startedAt:
          `08 Sep 2026 ${String(
            9 + index
          ).padStart(
            2,
            '0'
          )}:00`,

        completedAt:
          `08 Sep 2026 ${String(
            9 + index
          ).padStart(
            2,
            '0'
          )}:01`,

        status:
          'success',

        records:
          1250
          +
          (
            index
            *
            720
          ),

        durationSeconds:
          31
          +
          (
            index
            *
            8
          ),

        error:
          null,

        attempt:
          1,

      });


      // ------------------------------------------------------
      // Add one failure example for operational testing.
      // ------------------------------------------------------

      if (
        index ===
        integrations.length
        -
        1
      ) {

        runs.push({

          id:
            `run-${integration.clientId}-${integration.providerId}-failed`,

          clientId:
            integration.clientId,

          providerId:
            integration.providerId,

          startedAt:
            '08 Sep 2026 08:00',

          completedAt:
            '08 Sep 2026 08:01',

          status:
            'failed',

          records:
            0,

          durationSeconds:
            18,

          error:
            'Source request failed before data processing completed.',

          attempt:
            1,

        });

      }

    }
  );


  return runs;

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
    value
  );

}


function formatDuration(
  seconds:
    number |
    null
) {

  if (
    seconds ===
    null
  ) {

    return '—';

  }


  if (
    seconds <
    60
  ) {

    return `${seconds}s`;

  }


  const minutes =
    Math.floor(
      seconds /
      60
    );


  const remainder =
    seconds %
    60;


  return `${minutes}m ${remainder}s`;

}


function formatStatus(
  status:
    SyncRunStatus
) {

  if (
    status ===
    'success'
  ) {

    return 'Success';

  }


  if (
    status ===
    'failed'
  ) {

    return 'Failed';

  }


  if (
    status ===
    'running'
  ) {

    return 'Running';

  }


  return 'Queued';

}


function formatNow() {

  return new Date()
    .toLocaleString(
      'en-IN'
    );

}