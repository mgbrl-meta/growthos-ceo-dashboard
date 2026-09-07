'use client';


import { GosDecisionRow, GosLoadingCard, GosMiniStat, GosPanel, GosStatusBadge } from '../ui/GrowthUI';
import {
  useEffect,
  useState,
} from 'react';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';


// ============================================================
// TYPES
// ============================================================

type Row =
  any;


type MetaParams = {

  targetRoas:
    number;

  targetCpa:
    number;

  scalePct:
    number;

  killPct:
    number;

  minSpend:
    number;

  minPurchases:
    number;

  maxCpa:
    number;

  minRoas:
    number;

  minCtr:
    number;

  maxFrequency:
    number;

  cpmIncreasePct:
    number;

};


// ============================================================
// CAMPAIGN ANALYSIS
// ============================================================

export default function MetaCampaignAnalysis({

  start,

  end,

  params,

}: any) {


  const [
    rows,
    setRows,
  ] =
    useState<any[]>(
      []
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );


  const [
    weeklyRows,
    setWeeklyRows,
  ] =
    useState<any[]>(
      []
    );


  const [
    selectedCampaign,
    setSelectedCampaign,
  ] =
    useState(
      ''
    );


  const [
    dailyChartRows,
    setDailyChartRows,
  ] =
    useState<any[]>(
      []
    );


  const [
    selectedChartMetric,
    setSelectedChartMetric,
  ] =
    useState(
      'spend'
    );


  const [
    selectedChartCampaign,
    setSelectedChartCampaign,
  ] =
    useState(
      ''
    );


  // ==========================================================
  // LOAD CAMPAIGNS + WEEKLY DATA
  // ==========================================================

  useEffect(
    () => {

      async function load() {

        setLoading(
          true
        );


        try {

          // ==================================================
          // CAMPAIGN LIST
          // ==================================================

          const res =
            await fetch(
              `/api/meta-os?tab=campaign&start=${start}&end=${end}`
            );


          const json =
            await res.json();


          const campaignRows =
            Array.isArray(
              json
            )
              ? json
              : [];


          setRows(
            campaignRows
          );


          // ==================================================
          // AUTO SELECT FIRST CAMPAIGN
          // ==================================================

          const activeCampaign =
            selectedCampaign ||
            campaignRows?.[0]?.campaign_name ||
            '';


          if (
            !selectedCampaign &&
            activeCampaign
          ) {

            setSelectedCampaign(
              activeCampaign
            );

          }


          // ==================================================
          // WEEKLY DATA
          // ==================================================

          const weeklyRes =
            await fetch(
              `/api/meta-os?tab=campaign-weekly&start=${start}&end=${end}&campaign=${encodeURIComponent(
                activeCampaign
              )}`
            );


          const weeklyJson =
            await weeklyRes.json();


          setWeeklyRows(
            Array.isArray(
              weeklyJson
            )
              ? weeklyJson
              : []
          );


        } catch (
          error
        ) {

          console.error(
            'Campaign analysis error',
            error
          );


          setRows(
            []
          );


          setWeeklyRows(
            []
          );


        } finally {

          setLoading(
            false
          );

        }

      }


      load();

    },
    [
      start,
      end,
      selectedCampaign,
    ]
  );


  // ==========================================================
  // DAILY CHART
  // ==========================================================

  useEffect(
    () => {

      if (
        !selectedChartCampaign
      ) {

        return;

      }


      async function loadDailyChart() {

        const res =
          await fetch(
            `/api/meta-os?tab=campaign-daily-chart&start=${start}&end=${end}&campaign=${encodeURIComponent(
              selectedChartCampaign
            )}`
          );


        const json =
          await res.json();


        setDailyChartRows(
          Array.isArray(
            json
          )
            ? json
            : []
        );

      }


      loadDailyChart();

    },
    [
      selectedChartCampaign,
      start,
      end,
    ]
  );


  // ==========================================================
  // LOADING
  // ==========================================================

  if (
    loading
  ) {

    return (

      <LoadingCard
        text="Loading campaigns..."
      />

    );

  }


  // ==========================================================
  // BENCHMARK + DECISION BUCKETS
  // ==========================================================

  const accountBenchmark =
    buildBenchmark(
      rows
    );


  const enriched =
    rows
      .map(
        campaign => {

          const decisionData =
            getDecisionBucket(
              campaign,
              accountBenchmark,
              params
            );


          return {

            ...campaign,

            decision:
              decisionData.decision,

            reason:
              decisionData.reason,

            spendShare:
              safeDivide(
                campaign.spend,
                accountBenchmark.spend
              )
              *
              100,

          };

        }
      )
      .sort(
        (
          a,
          b
        ) =>
          Number(
            b.spend || 0
          )
          -
          Number(
            a.spend || 0
          )
      );


  const scale =
    enriched.filter(
      x =>
        x.decision ===
        'SCALE'
    );


  const test =
    enriched.filter(
      x =>
        x.decision ===
        'TEST'
    );


  const kill =
    enriched.filter(
      x =>
        x.decision ===
        'KILL'
    );


  const ignore =
    enriched.filter(
      x =>
        x.decision ===
        'IGNORE'
    );


  // ==========================================================
  // WEEKLY BREAKDOWN
  // ==========================================================

  const campaignOptions = [

    ...new Set(
      weeklyRows
        .map(
          x =>
            x.campaign_name
        )
        .filter(
          Boolean
        )
    ),

  ];


  const filteredWeekly =
    selectedCampaign

      ? weeklyRows.filter(
          x =>
            x.campaign_name ===
            selectedCampaign
        )

      : [];


  const months = [

    ...new Set(
      filteredWeekly.map(
        x =>
          x.month
      )
    ),

  ];


  const getMetric = (

    month:
      string,

    week:
      string,

    metric:
      string

  ) => {

    const row =
      filteredWeekly.find(
        x =>
          x.month ===
            month
          &&
          x.week ===
            week
      );


    return Number(
      row?.[metric] ||
      0
    );

  };


  // ==========================================================
  // DAILY CHART
  // ==========================================================

  const chartMetrics = [

    {
      key:
        'cpm',
      label:
        'CPM',
    },

    {
      key:
        'ctr',
      label:
        'CTR',
    },

    {
      key:
        'cpa',
      label:
        'CPA',
    },

    {
      key:
        'spend',
      label:
        'Spend',
    },

    {
      key:
        'revenue',
      label:
        'Purchase Value',
    },

  ];


  const dailyChartData =
    dailyChartRows.map(
      x => ({

        date:
          x.date?.value ||
          x.date,

        cpm:
          Number(
            x.cpm || 0
          ),

        ctr:
          Number(
            x.ctr || 0
          ),

        cpa:
          Number(
            x.cpa || 0
          ),

        spend:
          Number(
            x.spend || 0
          ),

        revenue:
          Number(
            x.revenue || 0
          ),

      })
    );


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="space-y-3">


      {/* =====================================================
          DECISION BUCKETS
      ===================================================== */}

      <Panel
        title="Campaign Decision Buckets"
      >

        <p
          className="
            mb-3

            text-[10px]
            font-medium
            leading-4

            text-slate-500
          "
        >
          Campaigns are benchmarked against overall Meta account
          performance for the selected date range.
        </p>


        <div
          className="
            grid
            grid-cols-1
            gap-2.5

            md:grid-cols-2
            xl:grid-cols-4
          "
        >

          <DecisionBucket
            title="🟢 Scale"
            items={
              scale
            }
          />


          <DecisionBucket
            title="🟡 Test"
            items={
              test
            }
          />


          <DecisionBucket
            title="🔴 Kill / Fix"
            items={
              kill
            }
          />


          <DecisionBucket
            title="⚪ Ignore"
            items={
              ignore
            }
          />

        </div>

      </Panel>


      {/* =====================================================
          CONCENTRATION
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-2.5

          md:grid-cols-3
        "
      >

        <ConcentrationCard

          title="Top Campaign Share"

          value={
            `${formatNumber(
              enriched[0]?.spendShare ||
              0
            )}%`
          }

          danger={
            (
              enriched[0]?.spendShare ||
              0
            )
            >
            50
          }

        />


        <ConcentrationCard

          title="Top 3 Campaign Share"

          value={
            `${formatNumber(
              enriched
                .slice(
                  0,
                  3
                )
                .reduce(
                  (
                    acc,
                    row
                  ) =>
                    acc
                    +
                    Number(
                      row.spendShare ||
                      0
                    ),
                  0
                )
            )}%`
          }

          danger={
            enriched
              .slice(
                0,
                3
              )
              .reduce(
                (
                  acc,
                  row
                ) =>
                  acc
                  +
                  Number(
                    row.spendShare ||
                    0
                  ),
                0
              )
            >
            80
          }

        />


        <ConcentrationCard

          title="Campaigns Evaluated"

          value={
            formatNumber(
              enriched.length,
              0
            )
          }

          danger={
            false
          }

        />

      </section>


      {/* =====================================================
          WEEKLY CAMPAIGN BREAKDOWN
      ===================================================== */}

      <Panel
        title="Weekly Campaign Breakdown"
      >

        <div className="space-y-3">


          <div
            className="
              flex
              flex-col
              gap-2.5

              lg:flex-row
              lg:items-center
              lg:justify-between
            "
          >

            <p
              className="
                text-[10px]
                font-medium

                text-slate-500
              "
            >
              Month-wise W1/W2/W3/W4 performance by selected campaign
            </p>


            <select

              value={
                selectedCampaign
              }

              onChange={
                e =>
                  setSelectedCampaign(
                    e.target.value
                  )
              }

              className="
                h-8
                w-full

                rounded-[8px]

                border
                border-slate-300

                bg-white

                px-2.5

                text-[11px]
                font-medium
                text-slate-700

                outline-none

                transition

                focus:border-violet-400
                focus:ring-2
                focus:ring-violet-100

                lg:w-72
              "
            >

              <option value="">
                Select Campaign
              </option>


              {campaignOptions.map(
                c => (

                  <option
                    key={
                      c
                    }
                    value={
                      c
                    }
                  >
                    {c}
                  </option>

                )
              )}

            </select>

          </div>


          {!selectedCampaign ? (

            <EmptyState>
              Select a campaign to view weekly Spend, CPA, AOV and ROAS.
            </EmptyState>

          ) : (

            <div
              className="
                overflow-x-auto

                rounded-[10px]

                border
                border-slate-200
              "
            >

              <table
                className="
                  min-w-full

                  border-collapse

                  text-[10px]
                "
              >

                <thead>


                  <tr className="bg-slate-100">

                    <th
                      className="
                        sticky
                        left-0
                        z-10

                        h-8

                        border-b
                        border-r
                        border-slate-200

                        bg-slate-100

                        px-2.5

                        text-left
                        text-[9px]
                        font-semibold
                        uppercase
                        tracking-[0.05em]

                        text-slate-600
                      "
                    >
                      Metric
                    </th>


                    {months.map(
                      month => (

                        <th

                          key={
                            month
                          }

                          colSpan={
                            4
                          }

                          className="
                            h-8

                            border-b
                            border-r
                            border-slate-200

                            px-2.5

                            text-center
                            text-[10px]
                            font-semibold

                            text-slate-800
                          "
                        >
                          {month}
                        </th>

                      )
                    )}

                  </tr>


                  <tr className="bg-white">

                    <th
                      className="
                        sticky
                        left-0
                        z-10

                        h-7

                        border-b
                        border-r
                        border-slate-200

                        bg-white
                      "
                    />


                    {months.map(
                      month =>
                        [
                          'W1',
                          'W2',
                          'W3',
                          'W4',
                        ].map(
                          week => (

                            <th

                              key={
                                `${month}-${week}`
                              }

                              className="
                                h-7

                                border-b
                                border-r
                                border-slate-200

                                px-2

                                text-center
                                text-[9px]
                                font-semibold

                                text-slate-500
                              "
                            >
                              {week}
                            </th>

                          )
                        )
                    )}

                  </tr>

                </thead>


                <tbody>

                  {[
                    {
                      key:
                        'spend',
                      label:
                        'Spend',
                      type:
                        'currency',
                    },
                    {
                      key:
                        'cpa',
                      label:
                        'CPA',
                      type:
                        'currency',
                    },
                    {
                      key:
                        'aov',
                      label:
                        'AOV',
                      type:
                        'currency',
                    },
                    {
                      key:
                        'roas',
                      label:
                        'ROAS',
                      type:
                        'number',
                    },
                  ].map(
                    metric => (

                      <tr
                        key={
                          metric.key
                        }
                        className="hover:bg-slate-50"
                      >

                        <td
                          className="
                            sticky
                            left-0
                            z-10

                            h-8

                            border-r
                            border-slate-200

                            bg-white

                            px-2.5

                            text-[10px]
                            font-semibold

                            text-slate-700
                          "
                        >
                          {metric.label}
                        </td>


                        {months.map(
                          month =>
                            [
                              'W1',
                              'W2',
                              'W3',
                              'W4',
                            ].map(
                              week => {

                                const value =
                                  getMetric(
                                    month,
                                    week,
                                    metric.key
                                  );


                                return (

                                  <td

                                    key={
                                      `${month}-${week}-${metric.key}`
                                    }

                                    className="
                                      h-8

                                      border-r
                                      border-t
                                      border-slate-100

                                      px-2

                                      text-center
                                      text-[10px]
                                      font-medium

                                      text-slate-600
                                    "
                                  >

                                    {metric.type ===
                                    'currency'

                                      ? formatCurrency(
                                          value
                                        )

                                      : value.toFixed(
                                          2
                                        )}

                                  </td>

                                );

                              }
                            )
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


      {/* =====================================================
          DAILY TREND
      ===================================================== */}

      <Panel
        title="Campaign Daily Trend"
      >

        <div className="space-y-3">


          <div
            className="
              flex
              flex-col
              gap-2.5

              lg:flex-row
              lg:items-center
              lg:justify-between
            "
          >

            <p
              className="
                text-[10px]
                font-medium

                text-slate-500
              "
            >
              Daily performance trend by campaign
            </p>


            <div
              className="
                flex
                flex-col
                gap-2

                sm:flex-row
                sm:items-center
              "
            >

              <div
                className="
                  inline-flex
                  h-7
                  items-center

                  rounded-full

                  bg-slate-100

                  px-2.5

                  text-[9px]
                  font-semibold

                  text-slate-600
                "
              >
                Daily
              </div>


              <select

                value={
                  selectedChartCampaign
                }

                onChange={
                  e =>
                    setSelectedChartCampaign(
                      e.target.value
                    )
                }

                className="
                  h-8
                  w-full

                  rounded-[8px]

                  border
                  border-slate-300

                  bg-white

                  px-2.5

                  text-[11px]
                  font-medium
                  text-slate-700

                  outline-none

                  transition

                  focus:border-violet-400
                  focus:ring-2
                  focus:ring-violet-100

                  sm:w-72
                "
              >

                <option value="">
                  Select Campaign
                </option>


                {campaignOptions.map(
                  c => (

                    <option
                      key={
                        c
                      }
                      value={
                        c
                      }
                    >
                      {c}
                    </option>

                  )
                )}

              </select>

            </div>

          </div>


          {!selectedChartCampaign ? (

            <EmptyState>
              Select a campaign to view trend chart.
            </EmptyState>

          ) : (

            <>

              <div
                className="
                  h-[200px]

                  rounded-[10px]

                  border
                  border-slate-200

                  bg-white

                  p-2
                "
              >

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >

                  <LineChart
                    data={
                      dailyChartData
                    }
                  >

                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#eef2f7"
                      vertical={false}
                    />


                    <XAxis

                      dataKey="date"

                      tick={{
                        fontSize:
                          9,
                      }}

                      tickLine={
                        false
                      }

                      axisLine={
                        false
                      }

                      stroke="#94a3b8"

                      minTickGap={
                        24
                      }

                    />


                    <YAxis

                      tick={{
                        fontSize:
                          9,
                      }}

                      tickLine={
                        false
                      }

                      axisLine={
                        false
                      }

                      stroke="#94a3b8"

                      width={
                        42
                      }

                    />


                    <Tooltip

                      contentStyle={{
                        borderRadius:
                          9,

                        border:
                          '1px solid #e2e8f0',

                        boxShadow:
                          '0 4px 12px rgba(15,23,42,0.07)',

                        fontSize:
                          10,

                        padding:
                          '8px 10px',
                      }}

                    />


                    <Line

                      type="monotone"

                      dataKey={
                        selectedChartMetric
                      }

                      stroke="#0f172a"

                      strokeWidth={
                        1.75
                      }

                      dot={
                        false
                      }

                      activeDot={{
                        r:
                          3,
                      }}

                    />

                  </LineChart>

                </ResponsiveContainer>

              </div>


              <div
                className="
                  flex
                  flex-wrap
                  gap-1.5
                "
              >

                {chartMetrics.map(
                  metric => (

                    <button

                      key={
                        metric.key
                      }

                      type="button"

                      onClick={
                        () =>
                          setSelectedChartMetric(
                            metric.key
                          )
                      }

                      className={`
                        h-7

                        rounded-full

                        border

                        px-2.5

                        text-[9px]
                        font-semibold

                        transition

                        ${
                          selectedChartMetric ===
                          metric.key

                            ? `
                              border-slate-900
                              bg-slate-900
                              text-white
                            `

                            : `
                              border-slate-200
                              bg-white
                              text-slate-500

                              hover:border-slate-300
                              hover:text-slate-800
                            `
                        }
                      `}
                    >
                      {metric.label}
                    </button>

                  )
                )}

              </div>

            </>

          )}

        </div>

      </Panel>


      {/* =====================================================
          CAMPAIGN LEADERBOARD
      ===================================================== */}

      <Panel
        title="Campaign Leaderboard"
      >

        <div className="space-y-2">

          {enriched.map(
            (
              campaign,
              i
            ) => (

              <DecisionRow

                key={
                  i
                }

                title={
                  campaign.campaign_name ||
                  'Unnamed campaign'
                }

                status={
                  campaign.decision
                }

                subtitle={
                  `${formatNumber(
                    campaign.spendShare
                  )}% spend share · ${campaign.reason}`
                }
              >

                <MiniStat
                  label="Spend"
                  value={
                    formatCurrency(
                      campaign.spend
                    )
                  }
                />


                <MiniStat
                  label="Revenue"
                  value={
                    formatCurrency(
                      campaign.revenue
                    )
                  }
                />


                <MiniStat
                  label="ROAS"
                  value={
                    formatNumber(
                      campaign.roas
                    )
                  }
                />


                <MiniStat
                  label="CPA"
                  value={
                    formatCurrency(
                      campaign.cpa
                    )
                  }
                />


                <MiniStat
                  label="CTR"
                  value={
                    `${formatNumber(
                      campaign.ctr
                    )}%`
                  }
                />


                <MiniStat
                  label="Freq"
                  value={
                    formatNumber(
                      campaign.frequency
                    )
                  }
                />

              </DecisionRow>

            )
          )}

        </div>

      </Panel>

    </div>

  );

}


// ============================================================
// BENCHMARK
// ============================================================

function buildBenchmark(
  rows:
    any[]
) {

  const spend =
    sum(
      rows,
      'spend'
    );


  const revenue =
    sum(
      rows,
      'revenue'
    );


  const purchases =
    sum(
      rows,
      'purchases'
    );


  const impressions =
    sum(
      rows,
      'impressions'
    );


  const clicks =
    sum(
      rows,
      'clicks'
    );


  const reach =
    sum(
      rows,
      'reach'
    );


  return {

    spend,

    revenue,

    purchases,

    impressions,

    clicks,

    reach,

    roas:
      safeDivide(
        revenue,
        spend
      ),

    cpa:
      safeDivide(
        spend,
        purchases
      ),

    ctr:
      safeDivide(
        clicks,
        impressions
      )
      *
      100,

    frequency:
      safeDivide(
        impressions,
        reach
      ),

    avgSpend:
      safeDivide(
        spend,
        Math.max(
          rows.length,
          1
        )
      ),

  };

}


// ============================================================
// DECISION ENGINE
// ============================================================

function getDecisionBucket(

  row:
    any,

  benchmark:
    any,

  params:
    MetaParams

) {

  const spend =
    Number(
      row.spend || 0
    );


  const roas =
    Number(
      row.roas || 0
    );


  const cpa =
    Number(
      row.cpa || 0
    );


  const purchases =
    Number(
      row.purchases || 0
    );


  const hasEnoughData =
    spend >=
      params.minSpend
    &&
    purchases >=
      params.minPurchases;


  const roasIndex =
    safeDivide(
      roas,
      benchmark.roas
    );


  const cpaIndex =
    safeDivide(
      cpa,
      benchmark.cpa
    );


  const spendIndex =
    safeDivide(
      spend,
      benchmark.avgSpend ||
      benchmark.spend
    );


  if (
    !hasEnoughData
  ) {

    if (
      roasIndex >=
        1.1
      ||
      cpaIndex <=
        0.9
    ) {

      return {

        decision:
          'TEST',

        reason:
          'Low data, but early efficiency is better than benchmark',

      };

    }


    return {

      decision:
        'IGNORE',

      reason:
        'Low signal / not enough spend or purchases yet',

    };

  }


  if (
    roasIndex >=
      1.1
    &&
    cpaIndex <=
      0.9
  ) {

    return {

      decision:
        'SCALE',

      reason:
        'ROAS better than benchmark and CPA lower than benchmark',

    };

  }


  if (
    roasIndex <=
      0.85
    &&
    cpaIndex >=
      1.15
  ) {

    return {

      decision:
        'KILL',

      reason:
        'ROAS below benchmark and CPA above benchmark',

    };

  }


  if (
    spendIndex <
      0.7
    &&
    (
      roasIndex >=
        1
      ||
      cpaIndex <=
        1
    )
  ) {

    return {

      decision:
        'TEST',

      reason:
        'Under-spent but performance is near or better than benchmark',

    };

  }


  return {

    decision:
      'IGNORE',

    reason:
      'Average performance; no clear scale or kill signal',

  };

}


// ============================================================
// HELPERS
// ============================================================

function sum(
  rows:
    Row[],
  key:
    string
) {

  return rows.reduce(
    (
      acc,
      row
    ) =>
      acc
      +
      Number(
        row[key] || 0
      ),
    0
  );

}


function safeDivide(
  a:
    any,
  b:
    any
) {

  const numerator =
    Number(
      a || 0
    );


  const denominator =
    Number(
      b || 0
    );


  if (
    !denominator
  ) {

    return 0;

  }


  return (
    numerator /
    denominator
  );

}


function formatCurrency(
  value:
    number = 0
) {

  return new Intl.NumberFormat(
    'en-IN',
    {

      style:
        'currency',

      currency:
        'INR',

      maximumFractionDigits:
        0,

    }
  ).format(
    Number(
      value || 0
    )
  );

}


function formatNumber(
  value:
    number = 0,
  digits =
    2
) {

  return new Intl.NumberFormat(
    'en-IN',
    {

      maximumFractionDigits:
        digits,

    }
  ).format(
    Number(
      value || 0
    )
  );

}


// ============================================================
// LOADING
// ============================================================

function LoadingCard({ text }: any) { return <GosLoadingCard text={text} />; }


// ============================================================
// PANEL
// ============================================================

function Panel({ title, children }: any) { return <GosPanel title={title}>{children}</GosPanel>; }


// ============================================================
// MINI STAT
// ============================================================

function MiniStat({ label, value }: any) { return <GosMiniStat label={label} value={value} />; }


// ============================================================
// DECISION ROW
// ============================================================

function DecisionRow({ title, subtitle, status, children }: any) { return <GosDecisionRow title={title} subtitle={subtitle} status={status}>{children}</GosDecisionRow>; }


// ============================================================
// STATUS BADGE
// ============================================================

function StatusBadge({ status }: any) { return <GosStatusBadge status={status} />; }


// ============================================================
// DECISION BUCKET
// ============================================================

function DecisionBucket({

  title,

  items,

}: any) {

  return (

    <div
      className="
        rounded-[10px]

        border
        border-slate-200

        bg-slate-50

        p-2.5
      "
    >

      <div
        className="
          mb-2

          flex
          items-center
          justify-between
          gap-2
        "
      >

        <h3
          className="
            text-[11px]
            font-semibold

            text-slate-800
          "
        >
          {title}
        </h3>


        <span
          className="
            inline-flex
            min-w-5
            items-center
            justify-center

            rounded-full

            bg-white

            px-1.5
            py-0.5

            text-[8px]
            font-semibold

            text-slate-500
          "
        >
          {items.length}
        </span>

      </div>


      {items.length ===
      0 ? (

        <p
          className="
            py-1

            text-[9px]
            font-medium

            text-slate-400
          "
        >
          No items
        </p>

      ) : (

        <div className="space-y-1.5">

          {items
            .slice(
              0,
              8
            )
            .map(
              (
                item:
                  any,
                i:
                  number
              ) => (

                <div

                  key={
                    i
                  }

                  className="
                    rounded-[8px]

                    border
                    border-slate-200

                    bg-white

                    p-2
                  "
                >

                  <p
                    className="
                      line-clamp-2

                      text-[10px]
                      font-semibold
                      leading-[14px]

                      text-slate-800
                    "
                  >
                    {item.campaign_name ||
                      item.adset_name ||
                      'Unnamed'}
                  </p>


                  <p
                    className="
                      mt-1

                      text-[8px]
                      font-medium
                      leading-[13px]

                      text-slate-500
                    "
                  >
                    Spend {formatCurrency(
                      item.spend
                    )}
                    {' · '}
                    ROAS {formatNumber(
                      item.roas
                    )}
                    {' · '}
                    CPA {formatCurrency(
                      item.cpa
                    )}
                  </p>


                  <p
                    className="
                      mt-1

                      text-[9px]
                      font-medium
                      leading-[14px]

                      text-slate-600
                    "
                  >
                    {item.reason}
                  </p>

                </div>

              )
            )}

        </div>

      )}

    </div>

  );

}


// ============================================================
// CONCENTRATION CARD
// ============================================================

function ConcentrationCard({

  title,

  value,

  danger,

}: any) {

  return (

    <div
      className="
        gos-card

        min-h-[72px]

        px-3
        py-2.5
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

        <div>

          <p
            className="
              text-[9px]
              font-semibold
              uppercase
              tracking-[0.05em]

              text-slate-500
            "
          >
            {title}
          </p>


          <p
            className="
              mt-1.5

              text-[20px]
              font-bold
              leading-none
              tracking-[-0.03em]

              text-slate-950
            "
          >
            {value}
          </p>

        </div>


        <span
          className={`
            shrink-0

            rounded-full

            px-2
            py-0.5

            text-[8px]
            font-semibold

            ${
              danger

                ? `
                  bg-red-50
                  text-red-600
                `

                : `
                  bg-emerald-50
                  text-emerald-600
                `
            }
          `}
        >
          {danger
            ? 'High Risk'
            : 'Healthy'
          }
        </span>

      </div>

    </div>

  );

}


// ============================================================
// EMPTY STATE
// ============================================================

function EmptyState({

  children,

}: any) {

  return (

    <div
      className="
        rounded-[10px]

        border
        border-dashed
        border-slate-300

        bg-slate-50

        px-3
        py-2

        text-center
        text-[10px]
        font-medium

        text-slate-500
      "
    >
      {children}
    </div>

  );

}
