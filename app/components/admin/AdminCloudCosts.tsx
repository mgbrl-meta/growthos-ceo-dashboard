"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  AlertTriangle,
  BarChart3,
  Cloud,
  Coins,
  Gauge,
  History,
  Receipt,
  RefreshCcw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";


type Summary = {
  infrastructureGrossCost: number;
  infrastructureCredits: number;
  infrastructureNetCost: number;
  billingAdjustmentsNetCost: number;
  totalBilledNetCost: number;
  previousInfrastructureNetCost: number;
  projectCount: number;
  serviceCount: number;
  locationCount: number;
  allocatedInfrastructureNetCost: number;
  changePct: number | null;
  dailyAverageInfrastructure: number;
  allocationCoveragePct: number | null;
};

type Coverage = {
  sourceStartDate: string | null;
  sourceEndDate: string | null;
  coveredStartDate: string | null;
  coveredEndDate: string | null;
  requestedDays: number;
  coveredDays: number;
  coveragePct: number | null;
  backfillInProgress: boolean;
  complete: boolean;
  previousPeriodComplete: boolean;
};

type DailyRow = {
  date: string;
  grossCost: number;
  credits: number;
  netCost: number;
};

type CostRow = {
  netCost: number;
  [key: string]: any;
};

type CloudCostsPayload = {
  startDate: string;
  endDate: string;
  previousStart: string;
  previousEnd: string;
  timezone: string;
  billingLocation: string;
  billingDataset: string;
  sourceTable: string;
  currency: string | null;
  allocationRuleCount: number;
  coverage: Coverage;
  summary: Summary;
  daily: DailyRow[];
  services: CostRow[];
  adjustments: CostRow[];
  projects: CostRow[];
  locations: CostRow[];
  modules: CostRow[];
  lifecycles: CostRow[];
  allocations: CostRow[];
  resources: CostRow[];
  bigqueryJobs: CostRow[];
  bigqueryDatasets: CostRow[];
  anomalies: Array<{
    date: string;
    netCost: number;
    baselineAverage: number;
    deltaPct: number;
    severity:
      "critical"
      |
      "warning"
      |
      "watch";
  }>;
};

type ApiResponse = {
  ok: boolean;
  configured?: boolean;
  state?: string;
  version?: string;
  message?: string;
  error?: string;
  billingDataset?: string;
  billingLocation?: string;
  data?: CloudCostsPayload;
};


const RANGE_OPTIONS = [
  {
    label: "7D",
    days: 7,
  },
  {
    label: "30D",
    days: 30,
  },
  {
    label: "90D",
    days: 90,
  },
];


export default function AdminCloudCosts() {

  const [
    days,
    setDays,
  ] =
    useState(
      30
    );

  const [
    response,
    setResponse,
  ] =
    useState<ApiResponse | null>(
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
    useState(
      ""
    );


  const load =
    useCallback(
      async () => {

        setLoading(
          true
        );

        setError(
          ""
        );


        try {

          const request =
            await fetch(
              `/api/admin/cloud-costs?days=${days}`,
              {
                cache:
                  "no-store",
              }
            );


          const json:
            ApiResponse =
              await request.json();


          if (
            !request.ok
            ||
            !json.ok
          ) {

            throw new Error(
              json.error
              ||
              "Unable to load cloud costs"
            );

          }


          setResponse(
            json
          );

        } catch (
          loadError: any
        ) {

          setError(
            String(
              loadError?.message
              ||
              "Unable to load cloud costs"
            )
          );

        } finally {

          setLoading(
            false
          );

        }

      },
      [
        days,
      ]
    );


  useEffect(
    () => {

      load();

    },
    [
      load,
    ]
  );


  const data =
    response?.data
    ||
    null;


  const currency =
    data?.currency
    ||
    "INR";


  const money =
    useMemo(
      () =>
        new Intl.NumberFormat(
          currency ===
          "INR"
            ? "en-IN"
            : "en-US",
          {
            style:
              "currency",
            currency,
            maximumFractionDigits:
              2,
          }
        ),
      [
        currency,
      ]
    );


  if (
    loading
    &&
    !response
  ) {

    return (
      <Panel>
        <div className="p-10 text-center">

          <RefreshCcw
            className="mx-auto animate-spin text-slate-400"
            size={22}
          />

          <p className="mt-3 text-[11px] font-semibold text-slate-500">
            Loading cloud cost telemetry…
          </p>

        </div>
      </Panel>
    );

  }


  if (error) {

    return (
      <Panel>
        <div className="p-6">

          <div className="flex items-start gap-3">

            <AlertTriangle
              className="mt-0.5 text-red-500"
              size={18}
            />

            <div>

              <h2 className="text-[14px] font-semibold text-slate-950">
                Cloud cost data could not be loaded
              </h2>

              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                {error}
              </p>

              <button
                type="button"
                onClick={load}
                className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-700"
              >
                Retry
              </button>

            </div>

          </div>

        </div>
      </Panel>
    );

  }


  if (
    response
    &&
    response.configured ===
      false
  ) {

    return (
      <Panel>
        <div className="p-5">

          <div className="flex items-start gap-3">

            <Cloud
              className="mt-0.5 text-violet-600"
              size={20}
            />

            <div className="max-w-3xl">

              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-violet-600">
                Cloud Costs V1.1
              </p>

              <h2 className="mt-1 text-[16px] font-semibold tracking-[-0.03em] text-slate-950">
                Waiting for Detailed Billing Export
              </h2>

              <p className="mt-1.5 text-[11px] leading-5 text-slate-500">
                Growth OS is ready. Enable Google Cloud Billing → Billing export → Detailed usage cost and point it to the dataset below.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">

                <SetupCell
                  label="Dataset"
                  value={
                    response.billingDataset
                    ||
                    "growthos_billing"
                  }
                />

                <SetupCell
                  label="Location"
                  value={
                    response.billingLocation
                    ||
                    "US"
                  }
                />

              </div>

            </div>

          </div>

        </div>
      </Panel>
    );

  }


  if (!data) {

    return null;

  }


  const summary =
    data.summary;

  const coverage =
    data.coverage;


  const changeLabel =
    summary.changePct ===
      null

      ?
        "Comparison waits for complete billing coverage"

      :
        `${summary.changePct >= 0 ? "+" : ""}${summary.changePct.toFixed(1)}% vs prior complete period`;


  const coverageLabel =
    `${Number(coverage.coveragePct || 0).toFixed(1)}%`;


  return (
    <div className="space-y-3">

      <div className="flex flex-wrap items-center justify-between gap-2">

        <div>

          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-violet-600">
            FinOps · V1.1
          </p>

          <p className="mt-0.5 text-[11px] text-slate-500">
            {data.startDate} → {data.endDate} · {data.timezone}
          </p>

        </div>


        <div className="flex items-center gap-1.5">

          {RANGE_OPTIONS.map(
            option => (

              <button
                key={option.days}
                type="button"
                onClick={() =>
                  setDays(
                    option.days
                  )
                }
                className={`rounded-lg px-3 py-2 text-[10px] font-semibold transition ${
                  days ===
                  option.days
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>

            )
          )}


          <button
            type="button"
            onClick={load}
            disabled={loading}
            title="Refresh"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-50"
          >
            <RefreshCcw
              size={14}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
          </button>

        </div>

      </div>


      <CoverageBanner
        coverage={coverage}
      />


      <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">

        <MetricCard
          icon={WalletCards}
          label="Infrastructure Cost"
          value={
            money.format(
              summary.infrastructureNetCost
            )
          }
          note={`${summary.serviceCount} services · ${summary.projectCount} project${summary.projectCount === 1 ? "" : "s"}`}
        />

        <MetricCard
          icon={Coins}
          label="Total Billed"
          value={
            money.format(
              summary.totalBilledNetCost
            )
          }
          note={`Infra gross ${money.format(summary.infrastructureGrossCost)} · credits ${money.format(summary.infrastructureCredits)}`}
        />

        <MetricCard
          icon={Receipt}
          label="Billing Adjustments"
          value={
            money.format(
              summary.billingAdjustmentsNetCost
            )
          }
          note="Invoice / tax kept separate from infrastructure"
        />

        <MetricCard
          icon={BarChart3}
          label="Daily Infra Avg"
          value={
            money.format(
              summary.dailyAverageInfrastructure
            )
          }
          note={`${coverage.coveredDays} covered day${coverage.coveredDays === 1 ? "" : "s"} · ${changeLabel}`}
        />

        <MetricCard
          icon={Gauge}
          label="Billing Coverage"
          value={
            coverageLabel
          }
          note={`${coverage.coveredDays}/${coverage.requestedDays} requested days`}
        />

      </div>


      <Panel>

        <SectionHeader
          eyebrow="Trend"
          title="Daily Infrastructure Cost"
          description="Operational cloud cost only. Invoice and tax adjustments are excluded."
        />

        <div className="h-[260px] px-3 pb-3">

          {data.daily.length ===
            0 ? (

            <EmptyState
              text="No infrastructure cost rows are available in the covered portion of this range."
            />

          ) : (

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <LineChart
                data={
                  data.daily
                }
                margin={{
                  top: 12,
                  right: 12,
                  bottom: 0,
                  left: 0,
                }}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />

                <XAxis
                  dataKey="date"
                  tick={{
                    fontSize: 9,
                    fill: "#64748b",
                  }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={26}
                />

                <YAxis
                  tick={{
                    fontSize: 9,
                    fill: "#64748b",
                  }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={
                    value =>
                      compactMoney(
                        Number(
                          value
                        ),
                        currency
                      )
                  }
                  width={72}
                />

                <Tooltip
                  formatter={
                    value =>
                      money.format(
                        Number(
                          value
                        )
                      )
                  }
                  labelStyle={{
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                  contentStyle={{
                    borderRadius: 10,
                    borderColor: "#e2e8f0",
                    fontSize: 11,
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="netCost"
                  name="Infrastructure Cost"
                  stroke="#0f172a"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                  }}
                />

              </LineChart>

            </ResponsiveContainer>

          )}

        </div>

      </Panel>


      <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">

        <CostTable
          title="Infrastructure Services"
          maxHeight={220}
          compact
          description="Operational cloud cost by Google Cloud service; invoice/tax rows are excluded."
          rows={
            data.services
          }
          columns={[
            {
              key:
                "service",
              label:
                "Service",
            },
            {
              key:
                "skuCount",
              label:
                "SKUs",
              numeric:
                true,
            },
            {
              key:
                "netCost",
              label:
                "Net Cost",
              money:
                true,
            },
          ]}
          money={money}
        />


        <CostTable
          title="Billing Adjustments"
          maxHeight={220}
          compact
          description="Invoice, tax and billing-only rows kept outside operational infrastructure cost."
          rows={
            data.adjustments
          }
          empty="No invoice/tax adjustment rows are present in this range."
          columns={[
            {
              key:
                "service",
              label:
                "Service",
            },
            {
              key:
                "sku",
              label:
                "SKU",
            },
            {
              key:
                "netCost",
              label:
                "Net Cost",
              money:
                true,
            },
          ]}
          money={money}
        />

      </div>


      <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">

        <CostTable
          title="Modules"
          maxHeight={220}
          compact
          description="Growth OS module attribution from explicit labels, allocation rules and resource-name inference."
          rows={
            data.modules
          }
          columns={[
            {
              key:
                "moduleId",
              label:
                "Module",
            },
            {
              key:
                "netCost",
              label:
                "Net Cost",
              money:
                true,
            },
          ]}
          money={money}
        />


        <CostTable
          title="Lifecycle"
          maxHeight={220}
          compact
          description="Current, legacy and unclassified infrastructure based on allocation rules and canonical region."
          rows={
            data.lifecycles
          }
          columns={[
            {
              key:
                "lifecycle",
              label:
                "Lifecycle",
            },
            {
              key:
                "netCost",
              label:
                "Net Cost",
              money:
                true,
            },
          ]}
          money={money}
        />

      </div>


      <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">

        <CostTable
          title="Projects"
          maxHeight={220}
          compact
          description="Infrastructure cost by Google Cloud project."
          rows={
            data.projects
          }
          columns={[
            {
              key:
                "projectId",
              label:
                "Project",
            },
            {
              key:
                "projectName",
              label:
                "Name",
            },
            {
              key:
                "netCost",
              label:
                "Net Cost",
              money:
                true,
            },
          ]}
          money={money}
        />


        <CostTable
          title="Locations"
          maxHeight={220}
          compact
          description="Infrastructure cost across regions and multi-regions."
          rows={
            data.locations
          }
          columns={[
            {
              key:
                "location",
              label:
                "Location",
            },
            {
              key:
                "netCost",
              label:
                "Net Cost",
              money:
                true,
            },
          ]}
          money={money}
        />

      </div>


      <CostTable
        title="Top Infrastructure Resources"
        maxHeight={360}
        compact
        showRowCount
        description="Highest-cost operational resources with corrected module, lifecycle and allocation classification."
        rows={
          data.resources
        }
        columns={[
          {
            key:
              "service",
            label:
              "Service",
          },
          {
            key:
              "sku",
            label:
              "SKU",
          },
          {
            key:
              "resourceName",
            label:
              "Resource",
          },
          {
            key:
              "moduleId",
            label:
              "Module",
          },
          {
            key:
              "lifecycle",
            label:
              "Lifecycle",
          },
          {
            key:
              "allocationScope",
            label:
              "Allocation",
          },
          {
            key:
              "netCost",
            label:
              "Net Cost",
            money:
              true,
          },
        ]}
        money={money}
      />


      <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">

        <CostTable
          title="BigQuery Jobs"
          maxHeight={320}
          compact
          showRowCount
          description="Analysis-cost rows where Google exposes a BigQuery job identifier."
          rows={
            data.bigqueryJobs
          }
          empty="No BigQuery analysis job IDs were present in this range."
          columns={[
            {
              key:
                "date",
              label:
                "Date",
            },
            {
              key:
                "jobId",
              label:
                "Job ID",
            },
            {
              key:
                "location",
              label:
                "Location",
            },
            {
              key:
                "moduleId",
              label:
                "Module",
            },
            {
              key:
                "lifecycle",
              label:
                "Lifecycle",
            },
            {
              key:
                "netCost",
              label:
                "Net Cost",
              money:
                true,
            },
          ]}
          money={money}
        />


        <CostTable
          title="BigQuery Datasets"
          maxHeight={280}
          compact
          showRowCount
          description="Storage-cost rows where Google exposes a dataset identifier."
          rows={
            data.bigqueryDatasets
          }
          empty="No BigQuery dataset identifiers were present in this range."
          columns={[
            {
              key:
                "datasetId",
              label:
                "Dataset",
            },
            {
              key:
                "projectId",
              label:
                "Project",
            },
            {
              key:
                "moduleId",
              label:
                "Module",
            },
            {
              key:
                "lifecycle",
              label:
                "Lifecycle",
            },
            {
              key:
                "netCost",
              label:
                "Net Cost",
              money:
                true,
            },
          ]}
          money={money}
        />

      </div>


      <Panel>

        <SectionHeader
          eyebrow="Control"
          title="Infrastructure Cost Anomalies"
          description="Operational cost only; billing adjustments are excluded from anomaly detection."
        />

        <div className="px-3 pb-3">

          {data.anomalies.length ===
            0 ? (

            <EmptyState
              text="No material infrastructure cost anomaly detected in this range."
            />

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full min-w-[720px] border-collapse">

                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <Th>Date</Th>
                    <Th>Severity</Th>
                    <Th numeric>Cost</Th>
                    <Th numeric>Baseline</Th>
                    <Th numeric>Delta</Th>
                  </tr>
                </thead>

                <tbody>

                  {data.anomalies.map(
                    row => (

                      <tr
                        key={row.date}
                        className="border-b border-slate-100 last:border-b-0"
                      >

                        <Td>
                          {row.date}
                        </Td>

                        <Td>
                          <SeverityBadge
                            severity={
                              row.severity
                            }
                          />
                        </Td>

                        <Td numeric>
                          {money.format(
                            row.netCost
                          )}
                        </Td>

                        <Td numeric>
                          {money.format(
                            row.baselineAverage
                          )}
                        </Td>

                        <Td numeric>
                          {Number(
                            row.deltaPct
                          ).toFixed(
                            1
                          )}
                          %
                        </Td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </Panel>


      <Panel>

        <SectionHeader
          eyebrow="Allocation"
          title="Platform / Workspace / Brand Cost"
          description={`Shared infrastructure remains platform/shared; exact brand attribution uses labels or ${data.allocationRuleCount} active allocation rule${data.allocationRuleCount === 1 ? "" : "s"}.`}
        />

        <div className="px-3 pb-3">

          <div className="mb-3 flex flex-wrap items-center gap-2 text-[9px] text-slate-500">

            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
              <ShieldCheck
                size={10}
              />
              Allocation coverage {
                summary.allocationCoveragePct ===
                  null
                  ? "—"
                  : `${summary.allocationCoveragePct.toFixed(1)}%`
              }
            </span>

          </div>


          <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">

            {data.allocations
              .slice(
                0,
                15
              )
              .map(
                row => (

                  <div
                    key={`${row.allocationScope}:${row.workspaceId}:${row.brandId}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >

                    <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      {row.allocationScope}
                    </p>

                    <p className="mt-1 truncate text-[10px] font-semibold text-slate-950">
                      {row.workspaceId}
                    </p>

                    <p className="mt-0.5 truncate text-[9px] text-slate-400">
                      {row.brandId}
                    </p>

                    <p className="mt-2 text-[14px] font-semibold text-slate-950">
                      {money.format(
                        Number(
                          row.netCost
                        )
                      )}
                    </p>

                  </div>

                )
              )}

          </div>

        </div>

      </Panel>


      <p className="px-1 pb-1 text-[9px] leading-4 text-slate-400">
        Source: {data.billingDataset}.{data.sourceTable} · export location {data.billingLocation}. Available billing coverage: {coverage.sourceStartDate || "—"} → {coverage.sourceEndDate || "—"}. Infrastructure excludes invoice/tax adjustments.
      </p>

    </div>
  );

}


function CoverageBanner({
  coverage,
}: {
  coverage:
    Coverage;
}) {

  const partial =
    coverage.complete !==
      true;


  return (
    <section
      className={`rounded-2xl border p-3 ${
        partial
          ? "border-amber-200 bg-amber-50/70"
          : "border-emerald-200 bg-emerald-50/60"
      }`}
    >

      <div className="flex flex-wrap items-start justify-between gap-3">

        <div className="flex items-start gap-2.5">

          {partial
            ? (
              <History
                size={16}
                className="mt-0.5 text-amber-600"
              />
            )
            : (
              <ShieldCheck
                size={16}
                className="mt-0.5 text-emerald-600"
              />
            )}


          <div>

            <p className={`text-[10px] font-semibold ${
              partial
                ? "text-amber-900"
                : "text-emerald-900"
            }`}>
              {coverage.backfillInProgress
                ? "Billing backfill in progress"
                : coverage.complete
                  ? "Billing coverage complete"
                  : "Partial billing coverage"}
            </p>

            <p className={`mt-0.5 text-[9px] leading-4 ${
              partial
                ? "text-amber-700"
                : "text-emerald-700"
            }`}>
              Source contains {coverage.sourceStartDate || "—"} → {coverage.sourceEndDate || "—"}. This selected range currently has {coverage.coveredDays} of {coverage.requestedDays} calendar days covered. Missing billing days are not treated as zero-cost days.
            </p>

          </div>

        </div>


        <div className={`rounded-lg border px-2.5 py-1.5 text-right ${
          partial
            ? "border-amber-200 bg-white/70"
            : "border-emerald-200 bg-white/70"
        }`}>

          <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Covered range
          </p>

          <p className="mt-0.5 text-[9px] font-semibold text-slate-700">
            {coverage.coveredStartDate || "—"} → {coverage.coveredEndDate || "—"}
          </p>

        </div>

      </div>

    </section>
  );

}


function Panel({
  children,
}: {
  children:
    ReactNode;
}) {

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {children}
    </section>
  );

}


function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow:
    string;
  title:
    string;
  description:
    string;
}) {

  return (
    <div className="flex items-start justify-between gap-3 px-3 py-3">

      <div>

        <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-violet-600">
          {eyebrow}
        </p>

        <h2 className="mt-0.5 text-[13px] font-semibold text-slate-950">
          {title}
        </h2>

        <p className="mt-0.5 text-[9px] text-slate-400">
          {description}
        </p>

      </div>

    </div>
  );

}


function MetricCard({
  icon:
    Icon,
  label,
  value,
  note,
}: {
  icon:
    any;
  label:
    string;
  value:
    string;
  note:
    string;
}) {

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">

      <div className="flex items-center justify-between gap-2">

        <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>

        <Icon
          size={14}
          className="text-slate-400"
        />

      </div>

      <p className="mt-2 truncate text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
        {value}
      </p>

      <p
        className="mt-1 min-h-[14px] text-[9px] leading-3.5 text-slate-400"
        title={note}
      >
        {note}
      </p>

    </div>
  );

}


function SetupCell({
  label,
  value,
}: {
  label:
    string;
  value:
    string;
}) {

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">

      <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-all font-mono text-[11px] font-semibold text-slate-800">
        {value}
      </p>

    </div>
  );

}


function CostTable({
  title,
  description,
  rows,
  columns,
  money,
  empty =
    "No cost rows in this range.",
  maxHeight =
    220,
  compact =
    false,
  showRowCount =
    false,
}: {
  title:
    string;
  description:
    string;
  rows:
    CostRow[];
  columns:
    Array<{
      key:
        string;
      label:
        string;
      money?:
        boolean;
      numeric?:
        boolean;
    }>;
  money:
    Intl.NumberFormat;
  empty?:
    string;
  maxHeight?:
    number;
  compact?:
    boolean;
  showRowCount?:
    boolean;
}) {

  return (
    <Panel>

      <div className="flex items-start justify-between gap-3 px-3 py-2.5">

        <div className="min-w-0">

          <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-violet-600">
            Breakdown
          </p>

          <h2 className="mt-0.5 text-[12px] font-semibold text-slate-950">
            {title}
          </h2>

          <p className="mt-0.5 text-[9px] leading-4 text-slate-400">
            {description}
          </p>

        </div>

        {showRowCount ? (
          <div className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-right">

            <p className="text-[8px] font-semibold uppercase tracking-[0.10em] text-slate-400">
              Rows
            </p>

            <p className="text-[9px] font-semibold text-slate-700">
              {rows.length}
            </p>

          </div>
        ) : null}

      </div>

      <div className="px-3 pb-3">

        {rows.length ===
          0 ? (

          <EmptyState
            text={empty}
          />

        ) : (

          <div
            className="overflow-auto rounded-lg border border-slate-100"
            style={{
              maxHeight,
            }}
          >

            <table className="w-full min-w-[640px] table-fixed border-collapse">

              <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#e2e8f0]">

                <tr className="text-left">

                  {columns.map(
                    column => (

                      <Th
                        key={column.key}
                        numeric={
                          column.numeric
                          ||
                          column.money
                        }
                        compact={compact}
                      >
                        {column.label}
                      </Th>

                    )
                  )}

                </tr>

              </thead>

              <tbody>

                {rows.map(
                  (
                    row,
                    index
                  ) => (

                    <tr
                      key={index}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                    >

                      {columns.map(
                        column => {

                          const value =
                            row[
                              column.key
                            ];

                          const displayValue =
                            column.money
                              ? money.format(
                                  Number(
                                    value
                                    ||
                                    0
                                  )
                                )
                              : value ===
                                  null
                                ||
                                value ===
                                  undefined
                                ? "—"
                                : String(
                                    value
                                  );

                          return (
                            <Td
                              key={column.key}
                              numeric={
                                column.numeric
                                ||
                                column.money
                              }
                              compact={compact}
                              title={displayValue}
                            >
                              {displayValue}
                            </Td>
                          );

                        }
                      )}

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        )}

      </div>

    </Panel>
  );

}


function Th({
  children,
  numeric =
    false,
  compact =
    false,
}: {
  children:
    ReactNode;
  numeric?:
    boolean;
  compact?:
    boolean;
}) {

  return (
    <th
      className={`${compact ? "px-2 py-1.5" : "px-2 py-2"} text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-400 ${
        numeric
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );

}


function Td({
  children,
  numeric =
    false,
  compact =
    false,
  title,
}: {
  children:
    ReactNode;
  numeric?:
    boolean;
  compact?:
    boolean;
  title?:
    string;
}) {

  return (
    <td
      className={`max-w-[320px] truncate px-2 ${compact ? "py-1.5" : "py-2.5"} text-[9px] text-slate-600 ${
        numeric
          ? "text-right font-medium tabular-nums text-slate-800"
          : "text-left"
      }`}
      title={title}
    >
      {children}
    </td>
  );

}


function EmptyState({
  text,
}: {
  text:
    string;
}) {

  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-[10px] text-slate-400">
      {text}
    </div>
  );

}


function SeverityBadge({
  severity,
}: {
  severity:
    "critical"
    |
    "warning"
    |
    "watch";
}) {

  const classes = {

    critical:
      "bg-red-50 text-red-700",

    warning:
      "bg-amber-50 text-amber-700",

    watch:
      "bg-blue-50 text-blue-700",

  };


  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[8px] font-semibold uppercase ${classes[severity]}`}
    >
      {severity}
    </span>
  );

}


function compactMoney(
  value:
    number,
  currency:
    string
) {

  return new Intl.NumberFormat(
    currency ===
    "INR"
      ? "en-IN"
      : "en-US",
    {
      style:
        "currency",
      currency,
      notation:
        "compact",
      maximumFractionDigits:
        1,
    }
  ).format(
    value
  );

}
