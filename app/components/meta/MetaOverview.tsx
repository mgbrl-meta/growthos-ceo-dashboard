'use client';


import { GosChartPanel, GosDataTile, GosDriverRow, GosLoadingCard, GosMetricCard, GosPanel } from '../ui/GrowthUI';
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
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts';


// ============================================================
// META OVERVIEW
// ============================================================

export default function MetaOverview({

  start,
  end,
  compareStart,
  compareEnd,
  params,

}: any) {


  const [
    payload,
    setPayload,
  ] =
    useState<any>(
      null
    );


  const [
    trend,
    setTrend,
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


  // ==========================================================
  // LOAD
  // ==========================================================

  useEffect(
    () => {

      async function load() {

        setLoading(
          true
        );


        try {

          const [
            overviewRes,
            trendRes,
          ] =
            await Promise.all([

              fetch(
                `/api/meta-os?tab=overview&start=${start}&end=${end}&compareStart=${compareStart}&compareEnd=${compareEnd}`
              ),

              fetch(
                `/api/meta-os?tab=trend&start=${start}&end=${end}`
              ),

            ]);


          setPayload(
            await overviewRes.json()
          );


          const trendJson =
            await trendRes.json();


          setTrend(
            Array.isArray(
              trendJson
            )
              ? trendJson
              : []
          );


        } catch (
          error
        ) {

          console.error(
            'Meta overview error',
            error
          );


          setPayload(
            null
          );


          setTrend(
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
      compareStart,
      compareEnd,
    ]
  );


  // ==========================================================
  // LOADING
  // ==========================================================

  if (
    loading ||
    !payload
  ) {

    return (

      <LoadingCard
        text="Loading Meta overview..."
      />

    );

  }


  // ==========================================================
  // CURRENT + COMPARISON
  // ==========================================================

  const current =
    payload.current ||
    {};


  const compare =
    payload.compare ||
    {};


  // ==========================================================
  // CORE METRICS
  // ==========================================================

  const spend =
    Number(
      current.spend || 0
    );


  const revenue =
    Number(
      current.revenue || 0
    );


  const purchases =
    Number(
      current.purchases || 0
    );


  const impressions =
    Number(
      current.impressions || 0
    );


  const reach =
    Number(
      current.reach || 0
    );


  const clicks =
    Number(
      current.clicks || 0
    );


  const roas =
    safeDivide(
      revenue,
      spend
    );


  const cpa =
    safeDivide(
      spend,
      purchases
    );


  const ctr =
    safeDivide(
      clicks,
      impressions
    )
    *
    100;


  const cpm =
    safeDivide(
      spend,
      impressions
    )
    *
    1000;


  const frequency =
    safeDivide(
      impressions,
      reach
    );


  // ==========================================================
  // COMPARISON
  // ==========================================================

  const compareRoas =
    safeDivide(
      compare.revenue,
      compare.spend
    );


  const compareCpa =
    safeDivide(
      compare.spend,
      compare.purchases
    );


  // ==========================================================
  // FUNNEL
  // ==========================================================

  const funnelData = [

    {
      name:
        'Clicks',

      value:
        Number(
          current.clicks || 0
        ),
    },

    {
      name:
        'LPV',

      value:
        Number(
          current.lpv || 0
        ),
    },

    {
      name:
        'ATC',

      value:
        Number(
          current.atc || 0
        ),
    },

    {
      name:
        'Checkout',

      value:
        Number(
          current.checkout || 0
        ),
    },

    {
      name:
        'Purchase',

      value:
        Number(
          current.purchases || 0
        ),
    },

  ];


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="space-y-3">


      {/* =====================================================
          PRIMARY KPIs
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-2.5

          sm:grid-cols-2
          xl:grid-cols-5
        "
      >

        <MetricCard

          title="Revenue"

          value={
            formatCurrency(
              revenue
            )
          }

          delta={
            pctChange(
              revenue,
              compare.revenue
            )
          }

          goodUp

        />


        <MetricCard

          title="Spend"

          value={
            formatCurrency(
              spend
            )
          }

          delta={
            pctChange(
              spend,
              compare.spend
            )
          }

        />


        <MetricCard

          title="ROAS"

          value={
            formatNumber(
              roas
            )
          }

          delta={
            pctChange(
              roas,
              compareRoas
            )
          }

          goodUp

          status={
            roas >=
            params.targetRoas
              ? 'Above target'
              : 'Below target'
          }

        />


        <MetricCard

          title="CPA"

          value={
            formatCurrency(
              cpa
            )
          }

          delta={
            pctChange(
              cpa,
              compareCpa
            )
          }

          status={
            cpa <=
            params.targetCpa
              ? 'Within target'
              : 'Above target'
          }

        />


        <MetricCard

          title="Purchases"

          value={
            formatNumber(
              purchases,
              0
            )
          }

          delta={
            pctChange(
              purchases,
              compare.purchases
            )
          }

          goodUp

        />

      </section>


      {/* =====================================================
          SECONDARY KPIs
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-2

          sm:grid-cols-3
        "
      >

        <DataTile

          label="Reach"

          value={
            formatNumber(
              reach,
              0
            )
          }

        />


        <DataTile

          label="CPM"

          value={
            formatCurrency(
              cpm
            )
          }

        />


        <DataTile

          label="Frequency"

          value={
            formatNumber(
              frequency
            )
          }

        />

      </section>


      {/* =====================================================
          CHARTS
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-3

          xl:grid-cols-2
        "
      >


        {/* ===================================================
            REVENUE VS SPEND
        =================================================== */}

        <ChartPanel
          title="Revenue vs Spend"
        >

          <div className="h-[190px] w-full">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <AreaChart
                data={
                  trend
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

                  tickLine={false}

                  axisLine={false}

                  stroke="#94a3b8"

                  minTickGap={24}

                />


                <YAxis

                  tick={{
                    fontSize:
                      9,
                  }}

                  tickLine={false}

                  axisLine={false}

                  stroke="#94a3b8"

                  width={42}

                />


                <Tooltip

                  formatter={(
                    value:
                      any
                  ) =>
                    formatCurrency(
                      Number(
                        value || 0
                      )
                    )
                  }

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


                <Area

                  type="monotone"

                  dataKey="revenue"

                  stroke="#0f172a"

                  fill="#0f172a"

                  fillOpacity={
                    0.06
                  }

                  strokeWidth={
                    1.75
                  }

                />


                <Area

                  type="monotone"

                  dataKey="spend"

                  stroke="#7c3aed"

                  fill="#7c3aed"

                  fillOpacity={
                    0.05
                  }

                  strokeWidth={
                    1.75
                  }

                />

              </AreaChart>

            </ResponsiveContainer>

          </div>

        </ChartPanel>


        {/* ===================================================
            ROAS TREND
        =================================================== */}

        <ChartPanel
          title="ROAS Trend"
        >

          <div className="h-[190px] w-full">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <LineChart
                data={
                  trend
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

                  tickLine={false}

                  axisLine={false}

                  stroke="#94a3b8"

                  minTickGap={24}

                />


                <YAxis

                  tick={{
                    fontSize:
                      9,
                  }}

                  tickLine={false}

                  axisLine={false}

                  stroke="#94a3b8"

                  width={36}

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

                  dataKey="roas"

                  stroke="#0f172a"

                  strokeWidth={
                    1.75
                  }

                  dot={false}

                  activeDot={{
                    r:
                      3,
                  }}

                />

              </LineChart>

            </ResponsiveContainer>

          </div>

        </ChartPanel>


        {/* ===================================================
            CPA TREND
        =================================================== */}

        <ChartPanel
          title="CPA Trend"
        >

          <div className="h-[190px] w-full">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <LineChart
                data={
                  trend
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

                  tickLine={false}

                  axisLine={false}

                  stroke="#94a3b8"

                  minTickGap={24}

                />


                <YAxis

                  tick={{
                    fontSize:
                      9,
                  }}

                  tickLine={false}

                  axisLine={false}

                  stroke="#94a3b8"

                  width={42}

                />


                <Tooltip

                  formatter={(
                    value:
                      any
                  ) =>
                    formatCurrency(
                      Number(
                        value || 0
                      )
                    )
                  }

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

                  dataKey="cpa"

                  stroke="#dc2626"

                  strokeWidth={
                    1.75
                  }

                  dot={false}

                  activeDot={{
                    r:
                      3,
                  }}

                />

              </LineChart>

            </ResponsiveContainer>

          </div>

        </ChartPanel>


        {/* ===================================================
            FUNNEL
        =================================================== */}

        <ChartPanel
          title="Funnel Drop-off"
        >

          <div className="h-[190px] w-full">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <BarChart
                data={
                  funnelData
                }
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#eef2f7"
                  vertical={false}
                />


                <XAxis

                  dataKey="name"

                  tick={{
                    fontSize:
                      9,
                  }}

                  tickLine={false}

                  axisLine={false}

                  stroke="#94a3b8"

                />


                <YAxis

                  tick={{
                    fontSize:
                      9,
                  }}

                  tickLine={false}

                  axisLine={false}

                  stroke="#94a3b8"

                  width={42}

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


                <Bar

                  dataKey="value"

                  fill="#0f172a"

                  radius={[
                    5,
                    5,
                    0,
                    0,
                  ]}

                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        </ChartPanel>

      </section>


      {/* =====================================================
          DRIVERS
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-3

          xl:grid-cols-2
        "
      >

        <Panel
          title="Cost Drivers"
        >

          <DriverRow

            label="CPM"

            value={
              formatCurrency(
                cpm
              )
            }

            note="Auction cost pressure"

          />


          <DriverRow

            label="Frequency"

            value={
              formatNumber(
                frequency
              )
            }

            note={
              frequency >
              params.maxFrequency

                ? 'Fatigue risk'

                : 'Below fatigue threshold'
            }

          />


          <DriverRow

            label="Reach"

            value={
              formatNumber(
                reach,
                0
              )
            }

            note="Audience coverage"

          />

        </Panel>


        <Panel
          title="Conversion Drivers"
        >

          <DriverRow

            label="CTR"

            value={
              `${formatNumber(
                ctr
              )}%`
            }

            note={
              ctr <
              params.minCtr

                ? 'Creative signal weak'

                : 'Creative signal acceptable'
            }

          />


          <DriverRow

            label="CPA"

            value={
              formatCurrency(
                cpa
              )
            }

            note={
              cpa >
              params.maxCpa

                ? 'Above hard limit'

                : 'Within limit'
            }

          />


          <DriverRow

            label="ROAS"

            value={
              formatNumber(
                roas
              )
            }

            note={
              roas <
              params.minRoas

                ? 'Below floor'

                : 'Above floor'
            }

          />

        </Panel>

      </section>

    </div>

  );

}


// ============================================================
// FORMATTERS
// ============================================================

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


function pctChange(
  current:
    number,
  previous:
    number
) {

  if (
    !previous ||
    previous === 0
  ) {

    return 0;

  }


  return (
    (
      Number(
        current || 0
      )
      -
      Number(
        previous || 0
      )
    )
    /
    Number(
      previous || 0
    )
  )
  *
  100;

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


  if (!denominator) {

    return 0;

  }


  return (
    numerator /
    denominator
  );

}


// ============================================================
// LOADING CARD
// ============================================================

function LoadingCard({ text }: any) { return <GosLoadingCard text={text} />; }


// ============================================================
// PANEL
// ============================================================

function Panel({ title, children }: any) { return <GosPanel title={title}>{children}</GosPanel>; }


// ============================================================
// CHART PANEL
// ============================================================

function ChartPanel({ title, children }: any) { return <GosChartPanel title={title}>{children}</GosChartPanel>; }


// ============================================================
// METRIC CARD
// ============================================================

function MetricCard(props: any) { return <GosMetricCard {...props} />; }


// ============================================================
// DATA TILE
// ============================================================

function DataTile({ label, value }: any) { return <GosDataTile label={label} value={value} />; }


// ============================================================
// DRIVER ROW
// ============================================================

function DriverRow({ label, value, note }: any) { return <GosDriverRow label={label} value={value} note={note} />; }
