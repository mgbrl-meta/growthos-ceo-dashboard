'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  CheckCircle2,
  Database,
  HardDrive,
  RefreshCw,
  Search,
  ShieldAlert,
  Table2,
} from 'lucide-react';


type AuditTable = {

  projectId: string;

  datasetId: string;

  tableId: string;

  tableType: string;

  rows: number;

  bytes: number;

  sizeMB: number;

  sizeGB: number;

  partitioned: boolean;

  partitionField: string | null;

  partitionType: string | null;

  clusteringFields: string[];

  createdAt: string | null;

  modifiedAt: string | null;

  issues: string[];

  health:
    | 'healthy'
    | 'review'
    | 'critical';

};


type DatasetAudit = {

  datasetId: string;

  exists: boolean;

  tables: AuditTable[];

};


type AuditResponse = {

  projectId: string;

  datasets: DatasetAudit[];

  summary: {

    datasets: number;

    tables: number;

    totalRows: number;

    totalSizeGB: number;

    partitionedTables: number;

    unpartitionedTables: number;

    clusteredTables: number;

    criticalTables: number;

    reviewTables: number;

    versionedTables: number;

    possibleLegacyTables: number;

  };

};


export default function WarehouseAudit() {

  const [
    audit,
    setAudit,
  ] = useState<AuditResponse | null>(
    null
  );


  const [
    loading,
    setLoading,
  ] = useState(
    true
  );


  const [
    error,
    setError,
  ] = useState(
    ''
  );


  const [
    search,
    setSearch,
  ] = useState(
    ''
  );


  const [
    datasetFilter,
    setDatasetFilter,
  ] = useState(
    'all'
  );


  const [
    healthFilter,
    setHealthFilter,
  ] = useState(
    'all'
  );


  const [
    partitionFilter,
    setPartitionFilter,
  ] = useState(
    'all'
  );


  async function load() {

    try {

      setLoading(
        true
      );

      setError(
        ''
      );


      const response =
        await fetch(
          '/api/system/warehouse-audit',
          {
            cache:
              'no-store',
          }
        );


      const raw =
        await response.text();


      let json: any;


      try {

        json =
          JSON.parse(
            raw
          );

      } catch {

        throw new Error(
          `Warehouse Audit API returned ${response.status} instead of JSON`
        );

      }


      if (
        !response.ok ||
        !json?.ok
      ) {

        throw new Error(
          json?.error
          ||
          'Warehouse audit failed'
        );

      }


      setAudit(
        json?.data?.audit
        ||
        null
      );


    } catch (
      error: any
    ) {

      console.error(
        'WAREHOUSE_AUDIT_UI_ERROR',
        error
      );


      setError(
        error?.message
        ||
        'Unable to audit warehouse'
      );


    } finally {

      setLoading(
        false
      );

    }

  }


  useEffect(
    () => {

      load();

    },
    []
  );


  const allTables =
    useMemo(
      () => {

        if (!audit) {

          return [];

        }


        return audit.datasets.flatMap(
          dataset =>
            dataset.tables
        );

      },
      [
        audit,
      ]
    );


  const filteredTables =
    useMemo(
      () => {

        const query =
          search
            .trim()
            .toLowerCase();


        return allTables

          .filter(
            table => {

              if (
                datasetFilter !==
                  'all'
                &&
                table.datasetId !==
                  datasetFilter
              ) {

                return false;

              }


              if (
                healthFilter !==
                  'all'
                &&
                table.health !==
                  healthFilter
              ) {

                return false;

              }


              if (
                partitionFilter ===
                  'partitioned'
                &&
                !table.partitioned
              ) {

                return false;

              }


              if (
                partitionFilter ===
                  'unpartitioned'
                &&
                table.partitioned
              ) {

                return false;

              }


              if (!query) {

                return true;

              }


              return [

                table.datasetId,

                table.tableId,

                table.tableType,

                table.partitionField,

                ...table.clusteringFields,

                ...table.issues,

              ]
                .filter(
                  Boolean
                )
                .some(
                  value =>
                    String(
                      value
                    )
                      .toLowerCase()
                      .includes(
                        query
                      )
                );

            }
          )

          .sort(
            (
              a,
              b
            ) => {

              const healthRank:
                Record<string, number> = {

                  critical:
                    0,

                  review:
                    1,

                  healthy:
                    2,

                };


              const healthDiff =
                healthRank[
                  a.health
                ]
                -
                healthRank[
                  b.health
                ];


              if (
                healthDiff !==
                0
              ) {

                return healthDiff;

              }


              return (
                b.bytes -
                a.bytes
              );

            }
          );

      },
      [
        allTables,
        search,
        datasetFilter,
        healthFilter,
        partitionFilter,
      ]
    );


  if (loading) {

    return (

      <div className="flex min-h-[520px] items-center justify-center">

        <div className="text-center">

          <RefreshCw
            size={25}
            className="mx-auto animate-spin text-slate-400"
          />

          <p className="mt-3 text-[11px] font-semibold text-slate-400">
            Auditing BigQuery warehouse...
          </p>

        </div>

      </div>

    );

  }


  if (error) {

    return (

      <section className="rounded-lg border border-red-200 bg-red-50 p-3.5">

        <h3 className="font-semibold text-red-900">
          Warehouse audit failed
        </h3>

        <p className="mt-2 text-[11px] text-red-700">
          {error}
        </p>

        <button
          type="button"
          onClick={
            load
          }
          className="mt-2.5 rounded-xl bg-red-900 px-3 py-2 text-[10px] font-semibold text-white"
        >
          Retry
        </button>

      </section>

    );

  }


  if (!audit) {

    return null;

  }


  const summary =
    audit.summary;


  return (

    <div className="space-y-3">


      {/* =====================================================
          HEADER
      ===================================================== */}

      <section className="flex flex-wrap items-end justify-between gap-2.5">

        <div>

          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-600">
            Growth OS System
          </p>


          <h1 className="mt-1 text-[14px] font-semibold tracking-[-0.04em] text-slate-950">
            Warehouse Audit
          </h1>


          <p className="mt-1 max-w-3xl text-[11px] leading-6 text-slate-500">

            Read-only audit of BigQuery tables,
            storage architecture, partitioning and
            probable migration risks.

          </p>

        </div>


        <button
          type="button"
          onClick={
            load
          }
          className="flex h-8 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-700 shadow-sm hover:bg-slate-50"
        >

          <RefreshCw
            size={14}
          />

          Refresh Audit

        </button>

      </section>


      {/* =====================================================
          WAREHOUSE
      ===================================================== */}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">

        <div className="flex flex-wrap items-center gap-3">

          <div className="flex h-8 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">

            <Database
              size={18}
            />

          </div>


          <div>

            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Current Warehouse
            </p>

            <p className="mt-1 text-[11px] font-semibold text-slate-950">
              {audit.projectId}
            </p>

          </div>


          <div className="ml-auto rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700">
            READ ONLY
          </div>

        </div>

      </section>


      {/* =====================================================
          SUMMARY KPIs
      ===================================================== */}

      <section className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid-cols-4">

        <Metric
          icon={
            <Table2 size={15} />
          }
          label="Tables"
          value={
            integer(
              summary.tables
            )
          }
        />

        <Metric
          icon={
            <HardDrive size={15} />
          }
          label="Storage"
          value={
            `${summary.totalSizeGB.toFixed(2)} GB`
          }
        />

        <Metric
          icon={
            <ShieldAlert size={15} />
          }
          label="Critical"
          value={
            integer(
              summary.criticalTables
            )
          }
          danger={
            summary.criticalTables >
            0
          }
        />

        <Metric
          icon={
            <AlertTriangle size={15} />
          }
          label="Review"
          value={
            integer(
              summary.reviewTables
            )
          }
          last
        />

      </section>


      {/* =====================================================
          ARCHITECTURE STATUS
      ===================================================== */}

      <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">

        <StatusCard
          label="Datasets"
          value={
            summary.datasets
          }
        />

        <StatusCard
          label="Partitioned"
          value={
            summary.partitionedTables
          }
        />

        <StatusCard
          label="Unpartitioned"
          value={
            summary.unpartitionedTables
          }
          warning={
            summary.unpartitionedTables >
            0
          }
        />

        <StatusCard
          label="Clustered"
          value={
            summary.clusteredTables
          }
        />

        <StatusCard
          label="Versioned"
          value={
            summary.versionedTables
          }
          warning={
            summary.versionedTables >
            0
          }
        />

        <StatusCard
          label="Possible Legacy"
          value={
            summary.possibleLegacyTables
          }
          warning={
            summary.possibleLegacyTables >
            0
          }
        />

      </section>


      {/* =====================================================
          FILTERS
      ===================================================== */}

      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">


        <div className="flex h-8 min-w-[280px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">

          <Search
            size={15}
            className="text-slate-400"
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
            placeholder="Search table, issue, partition..."
            className="min-w-0 flex-1 bg-transparent text-[10px] font-medium text-slate-800 outline-none"
          />

        </div>


        <select
          value={
            datasetFilter
          }
          onChange={
            event =>
              setDatasetFilter(
                event.target.value
              )
          }
          className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-700 outline-none"
        >

          <option value="all">
            All datasets
          </option>

          {audit.datasets.map(
            dataset => (

              <option
                key={
                  dataset.datasetId
                }
                value={
                  dataset.datasetId
                }
              >
                {dataset.datasetId}
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
                event.target.value
              )
          }
          className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-700 outline-none"
        >

          <option value="all">
            All health
          </option>

          <option value="critical">
            Critical
          </option>

          <option value="review">
            Review
          </option>

          <option value="healthy">
            Healthy
          </option>

        </select>


        <select
          value={
            partitionFilter
          }
          onChange={
            event =>
              setPartitionFilter(
                event.target.value
              )
          }
          className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-700 outline-none"
        >

          <option value="all">
            All partitions
          </option>

          <option value="partitioned">
            Partitioned
          </option>

          <option value="unpartitioned">
            Unpartitioned
          </option>

        </select>


        <div className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-semibold text-slate-500">

          {
            integer(
              filteredTables.length
            )
          } tables

        </div>

      </section>


      {/* =====================================================
          TABLE INVENTORY
      ===================================================== */}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">


        <div className="border-b border-slate-100 px-3 py-2.5">

          <h2 className="text-[11px] font-semibold text-slate-950">
            Table Inventory
          </h2>

          <p className="mt-1 text-[10px] text-slate-400">
            Largest and highest-risk tables appear first.
          </p>

        </div>


        <div className="overflow-x-auto">

          <table className="w-full min-w-[1450px]">


            <thead>

              <tr className="border-b border-slate-200">

                <Th>
                  Health
                </Th>

                <Th>
                  Dataset
                </Th>

                <Th>
                  Table
                </Th>

                <Th>
                  Type
                </Th>

                <Th right>
                  Rows
                </Th>

                <Th right>
                  Size
                </Th>

                <Th>
                  Partition
                </Th>

                <Th>
                  Clustering
                </Th>

                <Th>
                  Issues
                </Th>

                <Th>
                  Modified
                </Th>

              </tr>

            </thead>


            <tbody>

              {filteredTables.map(
                table => (

                  <tr
                    key={
                      `${table.datasetId}.${table.tableId}`
                    }
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >

                    <Td>

                      <HealthBadge
                        health={
                          table.health
                        }
                      />

                    </Td>


                    <Td>

                      <span className="font-semibold text-slate-500">
                        {table.datasetId}
                      </span>

                    </Td>


                    <Td>

                      <span className="font-bold text-slate-950">
                        {table.tableId}
                      </span>

                    </Td>


                    <Td>
                      {table.tableType}
                    </Td>


                    <Td right>

                      {
                        integer(
                          table.rows
                        )
                      }

                    </Td>


                    <Td right>

                      <strong className="text-slate-900">

                        {
                          formatSize(
                            table
                          )
                        }

                      </strong>

                    </Td>


                    <Td>

                      {table.partitioned ? (

                        <div>

                          <span className="font-bold text-emerald-700">
                            Yes
                          </span>

                          <p className="mt-0.5 text-[10px] text-slate-400">

                            {
                              table.partitionField
                              ||
                              table.partitionType
                              ||
                              'partitioned'
                            }

                          </p>

                        </div>

                      ) : (

                        <span className="font-semibold text-slate-400">
                          No
                        </span>

                      )}

                    </Td>


                    <Td>

                      {table.clusteringFields.length >
                      0 ? (

                        <div className="flex flex-wrap gap-1">

                          {table.clusteringFields.map(
                            field => (

                              <span
                                key={
                                  field
                                }
                                className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600"
                              >
                                {field}
                              </span>

                            )
                          )}

                        </div>

                      ) : (

                        <span className="text-slate-300">
                          —
                        </span>

                      )}

                    </Td>


                    <Td>

                      <div className="flex max-w-[330px] flex-wrap gap-1">

                        {table.issues.length >
                        0 ? (

                          table.issues.map(
                            issue => (

                              <IssueBadge
                                key={
                                  issue
                                }
                                issue={
                                  issue
                                }
                              />

                            )
                          )

                        ) : (

                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">

                            <CheckCircle2
                              size={11}
                            />

                            No flags

                          </span>

                        )}

                      </div>

                    </Td>


                    <Td>
                      {
                        formatDate(
                          table.modifiedAt
                        )
                      }
                    </Td>

                  </tr>

                )
              )}


              {filteredTables.length ===
                0 && (

                <tr>

                  <td
                    colSpan={10}
                    className="px-3 py-14 text-center text-[11px] text-slate-400"
                  >
                    No tables match the current filters.
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </section>

    </div>

  );

}


/* ============================================================
   COMPONENTS
============================================================ */

function Metric({
  icon,
  label,
  value,
  danger = false,
  last = false,
}: any) {

  return (

    <div
      className={
        last
          ? 'p-4'
          : 'border-b border-r border-slate-200 p-4'
      }
    >

      <div className="flex items-center gap-2 text-slate-400">

        {icon}

        <p className="text-[10px] font-bold uppercase tracking-wide">
          {label}
        </p>

      </div>


      <p
        className={
          danger
            ? 'mt-2 text-[15px] font-semibold text-red-600'
            : 'mt-2 text-[15px] font-semibold text-slate-950'
        }
      >
        {value}
      </p>

    </div>

  );

}


function StatusCard({
  label,
  value,
  warning = false,
}: any) {

  return (

    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">

      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={
          warning
            ? 'mt-2 text-[15px] font-semibold text-amber-600'
            : 'mt-2 text-[15px] font-semibold text-slate-950'
        }
      >
        {
          integer(
            value
          )
        }
      </p>

    </div>

  );

}


function HealthBadge({
  health,
}: {
  health: AuditTable['health'];
}) {

  if (
    health ===
    'critical'
  ) {

    return (

      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[9px] font-semibold text-red-700">

        <ShieldAlert
          size={10}
        />

        Critical

      </span>

    );

  }


  if (
    health ===
    'review'
  ) {

    return (

      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-semibold text-amber-700">

        <AlertTriangle
          size={10}
        />

        Review

      </span>

    );

  }


  return (

    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-semibold text-emerald-700">

      <CheckCircle2
        size={10}
      />

      Healthy

    </span>

  );

}


function IssueBadge({
  issue,
}: {
  issue: string;
}) {

  const text =
    issue
      .replaceAll(
        '_',
        ' '
      )
      .toLowerCase()
      .replace(
        /\b\w/g,
        letter =>
          letter.toUpperCase()
      );


  return (

    <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600">
      {text}
    </span>

  );

}


function Th({
  children,
  right = false,
}: any) {

  return (

    <th
      className={
        right
          ? 'px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400'
          : 'px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400'
      }
    >
      {children}
    </th>

  );

}


function Td({
  children,
  right = false,
}: any) {

  return (

    <td
      className={
        right
          ? 'px-3 py-2 text-right text-[10px] text-slate-600'
          : 'px-3 py-2 text-left text-[10px] text-slate-600'
      }
    >
      {children}
    </td>

  );

}


/* ============================================================
   FORMATTERS
============================================================ */

function integer(
  value: any
) {

  const number =
    Number(
      value
    );


  return new Intl.NumberFormat(
    'en-IN',
    {
      maximumFractionDigits:
        0,
    }
  ).format(
    Number.isFinite(
      number
    )
      ? number
      : 0
  );

}


function formatSize(
  table: AuditTable
) {

  if (
    table.sizeGB >=
    1
  ) {

    return `${table.sizeGB.toFixed(2)} GB`;

  }


  return `${table.sizeMB.toFixed(2)} MB`;

}


function formatDate(
  value: string | null
) {

  if (!value) {

    return '—';

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

    return '—';

  }


  return new Intl.DateTimeFormat(
    'en-IN',
    {
      day:
        '2-digit',

      month:
        'short',

      year:
        'numeric',
    }
  ).format(
    date
  );

}
