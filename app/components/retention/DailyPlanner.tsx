'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

type DailyPlannerProps = {
  selectedDate?: string;
};

type PlannerMode =
  | 'ALL_WEEK'
  | 'SELECTED_DATE';

type ExecutionGroup = {
  execution_group_id: string;
  execution_group_rank: number;

  run_date: string;

  week_start_date: string;
  week_end_date: string;

  scheduled_execution_date: string;

  campaign_slot_for_day: number;

  campaign_family: string;
  lifecycle_band: string;
  communication_treatment: string;

  execution_template_key: string;
  execution_group_name: string;

  audience_size: number;

  customers_with_phone: number;
  customers_with_email: number;

  replenishment_customers: number;
  next_product_customers: number;
  next_basket_customers: number;
  reactivation_customers: number;
  repeat_basket_customers: number;

  sku_target_customers: number;
  basket_target_customers: number;

  unique_dynamic_targets: number;

  avg_target_probability_90d: number;
  avg_repeat_probability_90d: number;

  avg_predicted_order_value: number;
  avg_expected_value_90d: number;
  total_expected_value_90d: number;

  avg_reliability_score: number;

  avg_priority_score: number;
  total_priority_score: number;

  capacity_status: string;

  suggested_campaign_name: string;
  suggested_template_key: string;

  campaign_status: string;
  template_status: string;

  tracker_execution_id?: string | null;
  tracker_status?: string | null;
  tracker_prepared_at?: string | null;
};

type PlannerResponse = {
  ok: boolean;

  mode:
    | 'ALL_WEEK'
    | 'SELECTED_DATE';

  selectedDate:
    | string
    | null;

  campaigns: ExecutionGroup[];

  error?: string;
};

const money = (value: number) =>
  `INR ${Math.round(
    Number(value || 0)
  ).toLocaleString('en-IN')}`;

const pct = (value: number) =>
  `${(
    Number(value || 0) * 100
  ).toFixed(2)}%`;

const humanize = (
  value:
    | string
    | null
    | undefined
) =>
  String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(
      /\b\w/g,
      (char) => char.toUpperCase()
    );

const prettyDate = (
  value:
    | string
    | null
    | undefined
) => {
  if (!value) return '—';

  const date =
    new Date(
      `${value}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
  );
};

export default function DailyPlanner({
  selectedDate,
}: DailyPlannerProps) {
  const [
    plannerMode,
    setPlannerMode,
  ] =
    useState<PlannerMode>(
      'ALL_WEEK'
    );

  const [
    rows,
    setRows,
  ] =
    useState<
      ExecutionGroup[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    search,
    setSearch,
  ] =
    useState('');

  const [
    familyFilter,
    setFamilyFilter,
  ] =
    useState('ALL');

  const [
    lifecycleFilter,
    setLifecycleFilter,
  ] =
    useState('ALL');

  const [
    treatmentFilter,
    setTreatmentFilter,
  ] =
    useState('ALL');

  const [
    preparingGroupId,
    setPreparingGroupId,
  ] =
    useState<
      string | null
    >(null);

  // ==========================================================
  // LOAD
  // ==========================================================

  useEffect(() => {
    async function loadPlanner() {
      setLoading(true);
      setError('');

      try {
        const plannerUrl =
          plannerMode ===
            'SELECTED_DATE' &&
          selectedDate
            ? `/api/retention-os/daily-planner?date=${encodeURIComponent(
                selectedDate
              )}`
            : '/api/retention-os/daily-planner';

        const response =
          await fetch(
            plannerUrl,
            {
              cache:
                'no-store',
            }
          );

        const text =
          await response.text();

        let json:
          PlannerResponse;

        try {
          json =
            JSON.parse(text);
        } catch {
          throw new Error(
            `Planner API returned invalid response: ${text.slice(
              0,
              120
            )}`
          );
        }

        if (
          !response.ok ||
          !json.ok
        ) {
          throw new Error(
            json.error ||
              'Failed to load weekly planner'
          );
        }

        setRows(
          Array.isArray(
            json.campaigns
          )
            ? json.campaigns
            : []
        );
      } catch (error) {
        console.error(
          'Retention execution planner error:',
          error
        );

        setRows([]);

        setError(
          error instanceof Error
            ? error.message
            : 'Failed to load weekly planner'
        );
      } finally {
        setLoading(false);
      }
    }

    loadPlanner();
  }, [
    plannerMode,
    selectedDate,
  ]);

  // ==========================================================
  // PREPARE
  // ==========================================================

  const prepareCampaign =
    async (
      row: ExecutionGroup
    ) => {
      if (
        row.tracker_status
      ) {
        return;
      }

      setPreparingGroupId(
        row.execution_group_id
      );

      try {
        const response =
          await fetch(
            '/api/retention-os/action-tracker/prepare',
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  executionGroupId:
                    row.execution_group_id,
                }),
            }
          );

        const text =
          await response.text();

        let json: any;

        try {
          json =
            JSON.parse(text);
        } catch {
          throw new Error(
            `Prepare API returned invalid response: ${text.slice(
              0,
              120
            )}`
          );
        }

        if (
          !response.ok ||
          !json.ok
        ) {
          throw new Error(
            json?.error ||
              'Failed to prepare campaign'
          );
        }

        setRows(
          previous =>
            previous.map(
              item =>
                item.execution_group_id ===
                row.execution_group_id
                  ? {
                      ...item,

                      tracker_execution_id:
                        json.execution
                          .executionId,

                      tracker_status:
                        json.execution
                          .status,

                      tracker_prepared_at:
                        new Date()
                          .toISOString(),
                    }
                  : item
            )
        );
      } catch (error) {
        console.error(
          'Prepare campaign error:',
          error
        );

        alert(
          error instanceof Error
            ? error.message
            : 'Failed to prepare campaign'
        );
      } finally {
        setPreparingGroupId(
          null
        );
      }
    };

  // ==========================================================
  // OPTIONS
  // ==========================================================

  const familyOptions =
    useMemo(
      () =>
        Array.from(
          new Set(
            rows
              .map(
                row =>
                  row.campaign_family
              )
              .filter(Boolean)
          )
        ).sort(),
      [rows]
    );

  const lifecycleOptions =
    useMemo(
      () =>
        Array.from(
          new Set(
            rows
              .map(
                row =>
                  row.lifecycle_band
              )
              .filter(Boolean)
          )
        ).sort(),
      [rows]
    );

  const treatmentOptions =
    useMemo(
      () =>
        Array.from(
          new Set(
            rows
              .map(
                row =>
                  row.communication_treatment
              )
              .filter(Boolean)
          )
        ).sort(),
      [rows]
    );

  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredRows =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return rows.filter(
        row => {
          if (
            familyFilter !==
              'ALL' &&
            row.campaign_family !==
              familyFilter
          ) {
            return false;
          }

          if (
            lifecycleFilter !==
              'ALL' &&
            row.lifecycle_band !==
              lifecycleFilter
          ) {
            return false;
          }

          if (
            treatmentFilter !==
              'ALL' &&
            row.communication_treatment !==
              treatmentFilter
          ) {
            return false;
          }

          if (query) {
            const haystack = [
              row.campaign_family,
              row.lifecycle_band,
              row.communication_treatment,
              row.execution_group_name,
              row.suggested_campaign_name,
              row.suggested_template_key,
              row.scheduled_execution_date,
              row.tracker_status,
            ]
              .join(' ')
              .toLowerCase();

            if (
              !haystack.includes(
                query
              )
            ) {
              return false;
            }
          }

          return true;
        }
      );
    }, [
      rows,
      search,
      familyFilter,
      lifecycleFilter,
      treatmentFilter,
    ]);

  // ==========================================================
  // SUMMARY
  // ==========================================================

  const summary =
    useMemo(() => {
      const customers =
        rows.reduce(
          (
            total,
            row
          ) =>
            total +
            Number(
              row.audience_size ||
                0
            ),
          0
        );

      const expectedValue =
        rows.reduce(
          (
            total,
            row
          ) =>
            total +
            Number(
              row.total_expected_value_90d ||
                0
            ),
          0
        );

      const executionDates =
        new Set(
          rows.map(
            row =>
              row.scheduled_execution_date
          )
        );

      const maxCampaignsPerDay =
        Array.from(
          executionDates
        ).reduce(
          (
            max,
            date
          ) => {
            const count =
              rows.filter(
                row =>
                  row.scheduled_execution_date ===
                  date
              ).length;

            return Math.max(
              max,
              count
            );
          },
          0
        );

      const weightedProbability =
        customers > 0
          ? rows.reduce(
              (
                total,
                row
              ) =>
                total +
                Number(
                  row.avg_target_probability_90d ||
                    0
                ) *
                  Number(
                    row.audience_size ||
                      0
                  ),
              0
            ) /
            customers
          : 0;

      const prepared =
        rows.filter(
          row =>
            Boolean(
              row.tracker_status
            )
        ).length;

      return {
        campaigns:
          rows.length,

        prepared,

        customers,

        executionDays:
          executionDates.size,

        maxCampaignsPerDay,

        weightedProbability,

        expectedValue,
      };
    }, [rows]);

  // ==========================================================
  // GROUP BY DATE
  // ==========================================================

  const rowsByDate =
    useMemo(() => {
      const groups:
        Record<
          string,
          ExecutionGroup[]
        > = {};

      filteredRows.forEach(
        row => {
          const date =
            row.scheduled_execution_date;

          if (!groups[date]) {
            groups[date] = [];
          }

          groups[date].push(
            row
          );
        }
      );

      return groups;
    }, [filteredRows]);

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl">

      {/* HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">
            Retention Planner
          </p>

          <h2 className="mt-1 text-[26px] font-black tracking-[-0.04em] text-slate-950">
            Weekly Execution Planner
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            One next-best action per customer, consolidated into executable campaign groups.
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">

          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">

            <button
              type="button"
              onClick={() =>
                setPlannerMode(
                  'SELECTED_DATE'
                )
              }
              className={`rounded-lg px-4 py-2 text-[10px] font-black transition ${
                plannerMode ===
                'SELECTED_DATE'
                  ? 'bg-slate-950 text-white'
                  : 'text-slate-500'
              }`}
            >
              Selected Date
            </button>

            <button
              type="button"
              onClick={() =>
                setPlannerMode(
                  'ALL_WEEK'
                )
              }
              className={`rounded-lg px-4 py-2 text-[10px] font-black transition ${
                plannerMode ===
                'ALL_WEEK'
                  ? 'bg-slate-950 text-white'
                  : 'text-slate-500'
              }`}
            >
              All Week
            </button>

          </div>

          <p className="pr-1 text-[9px] font-bold text-slate-400">

            {plannerMode ===
              'SELECTED_DATE'
              ? `Selected: ${prettyDate(
                  selectedDate
                )}`
              : rows.length > 0
                ? `${prettyDate(
                    rows[0]
                      .week_start_date
                  )} – ${prettyDate(
                    rows[0]
                      .week_end_date
                  )}`
                : 'Full Weekly Plan'}

          </p>

        </div>

      </div>

      {loading && (
        <p className="mt-3 text-xs font-bold text-blue-600">
          Loading weekly execution plan...
        </p>
      )}

      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
          {error}
        </div>
      )}

      {/* KPI */}

      <div className="mt-5 grid gap-3 md:grid-cols-4 xl:grid-cols-7">

        <Card
          label="Campaigns"
          value={
            summary.campaigns.toLocaleString(
              'en-IN'
            )
          }
        />

        <Card
          label="Prepared"
          value={
            summary.prepared.toLocaleString(
              'en-IN'
            )
          }
        />

        <Card
          label="Customers"
          value={
            summary.customers.toLocaleString(
              'en-IN'
            )
          }
        />

        <Card
          label="Execution Days"
          value={
            summary.executionDays.toString()
          }
        />

        <Card
          label="Max / Day"
          value={
            summary.maxCampaignsPerDay.toString()
          }
        />

        <Card
          label="Target Probability"
          value={
            pct(
              summary.weightedProbability
            )
          }
        />

        <Card
          label="Expected Value"
          value={
            money(
              summary.expectedValue
            )
          }
        />

      </div>

      {/* FILTERS */}

      <div className="mt-5 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 xl:flex-row">

        <input
          value={search}
          onChange={
            event =>
              setSearch(
                event.target.value
              )
          }
          placeholder="Search campaign, treatment, template or status..."
          className="h-9 min-w-[260px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none"
        />

        <select
          value={
            familyFilter
          }
          onChange={
            event =>
              setFamilyFilter(
                event.target.value
              )
          }
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold"
        >
          <option value="ALL">
            All Campaign Families
          </option>

          {familyOptions.map(
            option => (
              <option
                key={option}
                value={option}
              >
                {humanize(
                  option
                )}
              </option>
            )
          )}
        </select>

        <select
          value={
            lifecycleFilter
          }
          onChange={
            event =>
              setLifecycleFilter(
                event.target.value
              )
          }
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold"
        >
          <option value="ALL">
            All Lifecycle
          </option>

          {lifecycleOptions.map(
            option => (
              <option
                key={option}
                value={option}
              >
                {humanize(
                  option
                )}
              </option>
            )
          )}
        </select>

        <select
          value={
            treatmentFilter
          }
          onChange={
            event =>
              setTreatmentFilter(
                event.target.value
              )
          }
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold"
        >
          <option value="ALL">
            All Treatments
          </option>

          {treatmentOptions.map(
            option => (
              <option
                key={option}
                value={option}
              >
                {humanize(
                  option
                )}
              </option>
            )
          )}
        </select>

      </div>

      {/* DAYS */}

      <div className="mt-4 space-y-5">

        {Object.entries(
          rowsByDate
        ).map(
          ([
            date,
            dayRows,
          ]) => {
            const dayCustomers =
              dayRows.reduce(
                (
                  total,
                  row
                ) =>
                  total +
                  Number(
                    row.audience_size ||
                      0
                  ),
                0
              );

            return (
              <div
                key={date}
                className="overflow-hidden rounded-2xl border border-slate-200"
              >

                <div className="flex items-center justify-between bg-slate-100 px-4 py-3">

                  <div>
                    <p className="text-sm font-black text-slate-950">
                      {prettyDate(
                        date
                      )}
                    </p>

                    <p className="mt-0.5 text-[9px] font-bold text-slate-400">
                      {dayRows.length}{' '}
                      campaigns
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-black text-slate-950">
                      {dayCustomers.toLocaleString(
                        'en-IN'
                      )}
                    </p>

                    <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                      Customers
                    </p>
                  </div>

                </div>

                <div className="overflow-x-auto">

                  <table className="w-full min-w-[1390px] table-fixed text-left">

                    <thead className="bg-white text-[8px] font-black uppercase tracking-widest text-slate-400">

                      <tr>
                        <th className="w-[50px] p-3">
                          Slot
                        </th>

                        <th className="w-[145px] p-3">
                          Campaign
                        </th>

                        <th className="w-[110px] p-3">
                          Lifecycle
                        </th>

                        <th className="w-[100px] p-3">
                          Treatment
                        </th>

                        <th className="w-[90px] p-3">
                          Customers
                        </th>

                        <th className="w-[80px] p-3">
                          Targets
                        </th>

                        <th className="w-[90px] p-3">
                          Target Prob.
                        </th>

                        <th className="w-[80px] p-3">
                          Avg EV
                        </th>

                        <th className="w-[100px] p-3">
                          Total EV
                        </th>

                        <th className="w-[85px] p-3">
                          Reliability
                        </th>

                        <th className="w-[155px] p-3">
                          Template
                        </th>

                        <th className="w-[80px] p-3">
                          Capacity
                        </th>

                        <th className="w-[125px] p-3">
                          Action
                        </th>
                      </tr>

                    </thead>

                    <tbody>

                      {dayRows.map(
                        row => (
                          <tr
                            key={
                              row.execution_group_id
                            }
                            className={`border-t border-slate-100 align-top transition hover:bg-slate-50 ${
                              row.tracker_status
                                ? 'bg-blue-50/20'
                                : ''
                            }`}
                          >

                            <td className="p-3">
                              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-950 text-[9px] font-black text-white">
                                {
                                  row.campaign_slot_for_day
                                }
                              </span>
                            </td>

                            <td className="p-3">

                              <p className="text-xs font-black text-slate-950">
                                {
                                  humanize(
                                    row.campaign_family
                                  )
                                }
                              </p>

                              <p className="mt-1 break-all text-[8px] text-slate-400">
                                {
                                  row.suggested_campaign_name
                                }
                              </p>

                            </td>

                            <td className="p-3 text-[10px] font-bold text-slate-700">
                              {
                                humanize(
                                  row.lifecycle_band
                                )
                              }
                            </td>

                            <td className="p-3">
                              <TreatmentBadge
                                treatment={
                                  row.communication_treatment
                                }
                              />
                            </td>

                            <td className="p-3">
                              <p className="text-sm font-black text-slate-950">
                                {Number(
                                  row.audience_size ||
                                    0
                                ).toLocaleString(
                                  'en-IN'
                                )}
                              </p>
                            </td>

                            <td className="p-3">
                              <p className="text-xs font-black text-slate-950">
                                {Number(
                                  row.unique_dynamic_targets ||
                                    0
                                ).toLocaleString(
                                  'en-IN'
                                )}
                              </p>

                              <p className="mt-1 text-[8px] text-slate-400">
                                dynamic
                              </p>
                            </td>

                            <td className="p-3 text-[10px] font-black">
                              {
                                pct(
                                  row.avg_target_probability_90d
                                )
                              }
                            </td>

                            <td className="p-3 text-[9px] font-bold">
                              {
                                money(
                                  row.avg_expected_value_90d
                                )
                              }
                            </td>

                            <td className="p-3 text-[9px] font-black text-blue-700">
                              {
                                money(
                                  row.total_expected_value_90d
                                )
                              }
                            </td>

                            <td className="p-3 text-[9px] font-bold">
                              {
                                pct(
                                  row.avg_reliability_score
                                )
                              }
                            </td>

                            <td className="p-3">
                              <p className="break-words text-[8px] font-black text-slate-700">
                                {
                                  row.suggested_template_key
                                }
                              </p>
                            </td>

                            <td className="p-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-[7px] font-black uppercase ${
                                  row.capacity_status ===
                                  'WITHIN_CAPACITY'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-red-50 text-red-700'
                                }`}
                              >
                                {row.capacity_status ===
                                'WITHIN_CAPACITY'
                                  ? 'Ready'
                                  : 'Overflow'}
                              </span>
                            </td>

                            <td className="p-3">

                              {row.tracker_status ? (
                                <div className="flex flex-col items-start gap-1">

                                  <span className="rounded-full bg-blue-50 px-2 py-1 text-[7px] font-black uppercase text-blue-700">
                                    {
                                      humanize(
                                        row.tracker_status
                                      )
                                    }
                                  </span>

                                  <span className="text-[8px] font-bold text-slate-400">
                                    In Action Tracker
                                  </span>

                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={
                                    preparingGroupId ===
                                    row.execution_group_id
                                  }
                                  onClick={() =>
                                    prepareCampaign(
                                      row
                                    )
                                  }
                                  className="rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-black text-white disabled:opacity-50"
                                >
                                  {preparingGroupId ===
                                  row.execution_group_id
                                    ? 'Preparing...'
                                    : 'Prepare'}
                                </button>
                              )}

                            </td>

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                </div>

              </div>
            );
          }
        )}

        {filteredRows.length ===
          0 &&
          !loading && (
          <div className="rounded-2xl border border-slate-200 p-10 text-center text-xs font-bold text-slate-500">
            No execution campaigns found.
          </div>
        )}

      </div>

    </section>
  );
}

function Card({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-h-[82px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-lg font-black text-slate-950">
        {value}
      </p>
    </div>
  );
}

function TreatmentBadge({
  treatment,
}: {
  treatment: string;
}) {
  const value =
    String(
      treatment || ''
    );

  if (
    value ===
    'RECOVERY'
  ) {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-1 text-[8px] font-black uppercase text-amber-700">
        Recovery
      </span>
    );
  }

  if (
    value ===
    'TIMELY_ACTION'
  ) {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black uppercase text-emerald-700">
        Timely
      </span>
    );
  }

  if (
    value ===
    'EDUCATION'
  ) {
    return (
      <span className="rounded-full bg-blue-50 px-2 py-1 text-[8px] font-black uppercase text-blue-700">
        Education
      </span>
    );
  }

  return (
    <span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-black uppercase text-slate-600">
      {humanize(
        value
      )}
    </span>
  );
}