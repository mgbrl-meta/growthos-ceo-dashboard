'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';


type Props = {
  startDate: string;
  endDate: string;
  compareStartDate?: string;
  compareEndDate?: string;
};


type AttributionData = {
  summary?: any;
  newRepeat?: any[];
  journeyPaths?: any[];
  channelPerformance?: any[];
  channelRoles?: any[];
  creatives?: any[];
  health?: any;
};


const MODEL =
  'LAST_NON_DIRECT';


export default function AttributionOverview({
  startDate,
  endDate,
}: Props) {

  const [
    data,
    setData,
  ] = useState<AttributionData>(
    {}
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


  async function load() {

    try {

      setLoading(
        true
      );

      setError(
        ''
      );


      const url =
        `/api/attribution-os/overview?start=${startDate}&end=${endDate}&model=${MODEL}`;


      const response =
        await fetch(
          url,
          {
            cache:
              'no-store',
          }
        );


      const json =
        await response.json();


      if (
        !response.ok ||
        !json?.ok
      ) {

        throw new Error(
          json?.error ||
          'Unable to load attribution data'
        );

      }


      setData(
        json.data ||
        {}
      );


    } catch (
      loadError: any
    ) {

      console.error(
        'ATTRIBUTION_UI_ERROR',
        loadError
      );


      setError(
        loadError?.message ||
        'Unable to load attribution data'
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
    [
      startDate,
      endDate,
    ],
  );


  const summary =
    data.summary ||
    {};


  const health =
    data.health ||
    {};


  const paths =
    useMemo(
      () => {

        return (
          data.journeyPaths ||
          []
        )
          .slice(
            0,
            7
          )
          .map(
            row => ({

              path:
                cleanPath(
                  row.journey_path
                ),

              orders:
                number(
                  row.orders
                ),

              revenue:
                number(
                  row.revenue
                ),
            })
          );

      },
      [
        data.journeyPaths,
      ],
    );


  const channels =
    useMemo(
      () => {

        return (
          data.channelPerformance ||
          []
        )
          .slice(
            0,
            8
          )
          .map(
            row => ({

              channel:
                prettyChannel(
                  row.channel
                ),

              revenue:
                number(
                  row.attributed_revenue
                ),

              assisted:
                number(
                  row.assisted_orders
                ),

              credited:
                number(
                  row.credited_orders
                ),

              credits:
                number(
                  row.equivalent_order_credits
                ),
            })
          );

      },
      [
        data.channelPerformance,
      ],
    );


  const roles =
    useMemo(
      () => {

        return (
          data.channelRoles ||
          []
        )
          .map(
            row => ({

              channel:
                prettyChannel(
                  row.channel
                ),

              starter:
                number(
                  row.starter_orders
                ),

              assist:
                number(
                  row.assist_orders
                ),

              closer:
                number(
                  row.closer_orders
                ),
            })
          )
          .sort(
            (
              a,
              b,
            ) =>
              (
                b.starter +
                b.assist +
                b.closer
              )
              -
              (
                a.starter +
                a.assist +
                a.closer
              )
          )
          .slice(
            0,
            8
          );

      },
      [
        data.channelRoles,
      ],
    );


  const customerMix =
    useMemo(
      () => {

        const rows =
          data.newRepeat ||
          [];


        return rows.map(
          row => ({

            name:
              prettyCustomerType(
                row.tracked_customer_type
              ),

            value:
              number(
                row.orders
              ),
          })
        );

      },
      [
        data.newRepeat,
      ],
    );


  const creatives =
    (
      data.creatives ||
      []
    ).slice(
      0,
      8
    );


  if (
    loading
  ) {

    return (

      <div className="flex min-h-[420px] items-center justify-center">

        <div className="text-center">

          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />

          <p className="mt-4 text-sm font-semibold text-slate-500">
            Loading Attribution OS...
          </p>

        </div>

      </div>

    );

  }


  if (
    error
  ) {

    return (

      <div className="rounded-3xl border border-red-200 bg-red-50 p-6">

        <p className="font-black text-red-900">
          Attribution data failed to load
        </p>

        <p className="mt-1 text-sm text-red-700">
          {error}
        </p>

        <button
          type="button"
          onClick={
            load
          }
          className="mt-4 rounded-xl bg-red-900 px-4 py-2 text-xs font-black text-white"
        >
          Retry
        </button>

      </div>

    );

  }


  return (

    <div className="space-y-5">


      {/* ==================================================
          HEADER STRIP
      ================================================== */}

      <section className="flex flex-wrap items-center justify-between gap-3">

        <div>

          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-600">
            Attribution Intelligence
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Understand how channels, campaigns and customer journeys contribute to purchase.
          </p>

        </div>


        <div className="flex items-center gap-2">

          <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
            {startDate === endDate
              ? formatDate(
                  startDate
                )
              : `${formatDate(
                  startDate
                )} – ${formatDate(
                  endDate
                )}`}
          </span>


          <button
            type="button"
            onClick={
              load
            }
            className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white transition hover:bg-slate-800"
          >
            Refresh
          </button>

        </div>

      </section>


      {/* ==================================================
          KPI ROW
      ================================================== */}

      <section className="grid grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-5">

        <Metric
          label="Total Orders"
          value={
            integer(
              summary.total_orders
            )
          }
          sub="Shopify commerce truth"
        />


        <Metric
          label="Matched Orders"
          value={
            integer(
              summary.deterministic_orders
            )
          }
          sub={
            `${pct(
              summary.match_rate_pct
            )} match rate`
          }
        />


        <Metric
          label="Attributed Revenue"
          value={
            currency(
              summary.attributed_revenue
            )
          }
          sub="Last non-direct model"
        />


        <Metric
          label="Revenue Coverage"
          value={
            pct(
              summary.revenue_coverage_pct
            )
          }
          sub={
            currency(
              summary.deterministic_revenue
            )
          }
        />


        <Metric
          label="Multi-touch Orders"
          value={
            integer(
              summary.multi_touch_orders
            )
          }
          sub="Complex customer journeys"
          last
        />

      </section>


      {/* ==================================================
          JOURNEY + PATHS
      ================================================== */}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.8fr_1.2fr]">


        <Card
          title="Journey Efficiency"
          subtitle="What happens before customers purchase"
        >

          <div className="grid grid-cols-2 gap-x-8 gap-y-7">

            <MiniMetric
              label="Avg. Sessions"
              value={
                decimal(
                  summary.avg_sessions_to_purchase
                )
              }
            />

            <MiniMetric
              label="Avg. Marketing Touches"
              value={
                decimal(
                  summary.avg_marketing_touches_to_purchase
                )
              }
            />

            <MiniMetric
              label="Avg. Days to Purchase"
              value={
                `${decimal(
                  summary.avg_days_to_purchase
                )}d`
              }
            />

            <MiniMetric
              label="Multi-session Orders"
              value={
                integer(
                  summary.multi_session_orders
                )
              }
            />

          </div>

        </Card>


        <Card
          title="Top Journey Paths"
          subtitle="Most common routes to conversion"
        >

          <div className="h-[260px]">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <BarChart
                data={
                  paths
                }
                layout="vertical"
                margin={{
                  top: 4,
                  right: 20,
                  left: 10,
                  bottom: 4,
                }}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#e2e8f0"
                />

                <XAxis
                  type="number"
                  tick={{
                    fontSize: 11,
                    fill: '#64748b',
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  type="category"
                  dataKey="path"
                  width={185}
                  tick={{
                    fontSize: 11,
                    fill: '#334155',
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  cursor={{
                    fill:
                      '#f8fafc',
                  }}
                  formatter={
                    (
                      value: any
                    ) => [
                      integer(
                        value
                      ),
                      'Orders',
                    ]
                  }
                />

                <Bar
                  dataKey="orders"
                  fill="#7c3aed"
                  radius={[
                    0,
                    6,
                    6,
                    0,
                  ]}
                  maxBarSize={18}
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        </Card>

      </section>


      {/* ==================================================
          ROLES + CUSTOMER MIX
      ================================================== */}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_0.65fr]">


        <Card
          title="Channel Role Contribution"
          subtitle="Which channels start, assist and close journeys"
        >

          <div className="h-[290px]">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <BarChart
                data={
                  roles
                }
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />

                <XAxis
                  dataKey="channel"
                  tick={{
                    fontSize: 11,
                    fill: '#475569',
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  tick={{
                    fontSize: 11,
                    fill: '#64748b',
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip />

                <Legend />

                <Bar
                  dataKey="starter"
                  name="Starter"
                  stackId="roles"
                  fill="#8b5cf6"
                />

                <Bar
                  dataKey="assist"
                  name="Assist"
                  stackId="roles"
                  fill="#f59e0b"
                />

                <Bar
                  dataKey="closer"
                  name="Closer"
                  stackId="roles"
                  fill="#3b82f6"
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

        </Card>


        <Card
          title="Customer Mix"
          subtitle="New versus repeat tracked purchases"
        >

          <div className="h-[290px]">

            {customerMix.length > 0
              ? (

                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >

                    <PieChart>

                      <Pie
                        data={
                          customerMix
                        }
                        dataKey="value"
                        nameKey="name"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={3}
                      >

                        {customerMix.map(
                          (
                            entry,
                            index
                          ) => (

                            <Cell
                              key={
                                `${entry.name}-${index}`
                              }
                              fill={
                                index % 2 === 0
                                  ? '#7c3aed'
                                  : '#c4b5fd'
                              }
                            />

                          )
                        )}

                      </Pie>

                      <Tooltip
                        formatter={
                          (
                            value: any
                          ) =>
                            integer(
                              value
                            )
                        }
                      />

                      <Legend />

                    </PieChart>

                  </ResponsiveContainer>

                )
              : (

                  <Empty>
                    No customer mix available
                  </Empty>

                )}

          </div>

        </Card>

      </section>


      {/* ==================================================
          CHANNEL PERFORMANCE
      ================================================== */}

      <Card
        title="Channel Performance"
        subtitle="Attributed revenue contribution by channel"
      >

        <div className="h-[300px]">

          <ResponsiveContainer
            width="100%"
            height="100%"
          >

            <BarChart
              data={
                channels
              }
              margin={{
                left: 5,
                right: 10,
              }}
            >

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e2e8f0"
              />

              <XAxis
                dataKey="channel"
                tick={{
                  fontSize: 11,
                  fill: '#475569',
                }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                tickFormatter={
                  compactCurrency
                }
                tick={{
                  fontSize: 11,
                  fill: '#64748b',
                }}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip
                formatter={
                  (
                    value: any
                  ) => [
                    currency(
                      value
                    ),
                    'Attributed Revenue',
                  ]
                }
              />

              <Bar
                dataKey="revenue"
                fill="#0f172a"
                radius={[
                  6,
                  6,
                  0,
                  0,
                ]}
                maxBarSize={42}
              />

            </BarChart>

          </ResponsiveContainer>

        </div>

      </Card>


      {/* ==================================================
          CREATIVE INTELLIGENCE
      ================================================== */}

      <Card
        title="Creative Intelligence"
        subtitle="Top creative-level attributed performance"
        flush
      >

        <div className="overflow-x-auto">

          <table className="w-full min-w-[900px] border-collapse">

            <thead>

              <tr className="border-b border-slate-200 text-left">

                <Th>
                  Creative
                </Th>

                <Th>
                  Channel
                </Th>

                <Th>
                  Assisted
                </Th>

                <Th>
                  Visitors
                </Th>

                <Th>
                  Credits
                </Th>

                <Th align="right">
                  Revenue
                </Th>

              </tr>

            </thead>


            <tbody>

              {creatives.map(
                (
                  row,
                  index
                ) => (

                  <tr
                    key={
                      `${
                        row.creative_id
                      }-${index}`
                    }
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >

                    <Td>

                      <div className="font-bold text-slate-900">
                        {
                          creativeName(
                            row
                          )
                        }
                      </div>

                      <div className="mt-1 text-[11px] text-slate-400">
                        {
                          row.campaign_id ||
                          'No campaign ID'
                        }
                      </div>

                    </Td>


                    <Td>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                        {
                          prettyChannel(
                            row.channel
                          )
                        }
                      </span>

                    </Td>


                    <Td>
                      {
                        integer(
                          row.assisted_orders
                        )
                      }
                    </Td>


                    <Td>
                      {
                        integer(
                          row.converting_visitors
                        )
                      }
                    </Td>


                    <Td>
                      {
                        decimal(
                          row.equivalent_order_credits
                        )
                      }
                    </Td>


                    <Td align="right">

                      <strong>
                        {
                          currency(
                            row.attributed_revenue
                          )
                        }
                      </strong>

                    </Td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        </div>

      </Card>


      {/* ==================================================
          DATA QUALITY STRIP
      ================================================== */}

      <section className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-3 xl:grid-cols-6">

        <HealthMetric
          label="Pixel Collector"
          value={
            integer(
              health.raw_events
            )
          }
          status="Live"
          healthy
        />


        <HealthMetric
          label="Sessionization"
          value={
            pct(
              health.sessionization_coverage_pct
            )
          }
          status={
            number(
              health.sessionization_coverage_pct
            ) >= 95
              ? 'Healthy'
              : 'Review'
          }
          healthy={
            number(
              health.sessionization_coverage_pct
            ) >= 95
          }
        />


        <HealthMetric
          label="Cart Coverage"
          value={
            pct(
              health.all_history_cart_token_coverage_pct
            )
          }
          status="Coverage"
          healthy={
            number(
              health.all_history_cart_token_coverage_pct
            ) >= 90
          }
        />


        <HealthMetric
          label="Exact Match"
          value={
            pct(
              health.exact_match_when_cart_available_pct
            )
          }
          status="When cart exists"
          healthy={
            number(
              health.exact_match_when_cart_available_pct
            ) >= 80
          }
        />


        <HealthMetric
          label="Session Resolution"
          value={
            pct(
              health.canonical_session_resolution_pct
            )
          }
          status="Canonical"
          healthy={
            number(
              health.canonical_session_resolution_pct
            ) >= 90
          }
        />


        <HealthMetric
          label="Events Waiting"
          value={
            integer(
              health.raw_events_not_sessionized
            )
          }
          status={
            number(
              health.raw_events_not_sessionized
            ) === 0
              ? 'Clear'
              : 'Review'
          }
          healthy={
            number(
              health.raw_events_not_sessionized
            ) === 0
          }
          last
        />

      </section>

    </div>

  );

}


// ============================================================
// UI COMPONENTS
// ============================================================

function Metric({
  label,
  value,
  sub,
  last = false,
}: any) {

  return (

    <div
      className={
        `p-5 ${
          last
            ? ''
            : 'border-b border-slate-200 sm:border-r'
        }`
      }
    >

      <p className="text-[11px] font-semibold text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-[24px] font-black tracking-[-0.04em] text-slate-950">
        {value}
      </p>

      <p className="mt-2 text-[11px] text-slate-400">
        {sub}
      </p>

    </div>

  );

}


function MiniMetric({
  label,
  value,
}: any) {

  return (

    <div>

      <p className="text-xs font-semibold text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">
        {value}
      </p>

    </div>

  );

}


function Card({
  title,
  subtitle,
  children,
  flush = false,
}: any) {

  return (

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

      <div className="border-b border-slate-100 px-5 py-4">

        <h3 className="text-sm font-black text-slate-950">
          {title}
        </h3>

        <p className="mt-1 text-xs text-slate-400">
          {subtitle}
        </p>

      </div>


      <div
        className={
          flush
            ? ''
            : 'p-5'
        }
      >
        {children}
      </div>

    </section>

  );

}


function HealthMetric({
  label,
  value,
  status,
  healthy,
  last = false,
}: any) {

  return (

    <div
      className={
        `p-4 ${
          last
            ? ''
            : 'border-b border-r border-slate-200'
        }`
      }
    >

      <div className="flex items-center gap-2">

        <span
          className={
            `h-2 w-2 rounded-full ${
              healthy
                ? 'bg-emerald-500'
                : 'bg-amber-500'
            }`
          }
        />

        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
          {label}
        </p>

      </div>

      <p className="mt-2 text-lg font-black text-slate-950">
        {value}
      </p>

      <p
        className={
          `mt-1 text-[10px] font-semibold ${
            healthy
              ? 'text-emerald-600'
              : 'text-amber-600'
          }`
        }
      >
        {status}
      </p>

    </div>

  );

}


function Th({
  children,
  align = 'left',
}: any) {

  return (

    <th
      className={
        `px-5 py-3 text-${align} text-[10px] font-black uppercase tracking-wide text-slate-400`
      }
    >
      {children}
    </th>

  );

}


function Td({
  children,
  align = 'left',
}: any) {

  return (

    <td
      className={
        `px-5 py-4 text-${align} text-sm text-slate-600`
      }
    >
      {children}
    </td>

  );

}


function Empty({
  children,
}: any) {

  return (

    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      {children}
    </div>

  );

}


// ============================================================
// FORMATTERS
// ============================================================

function number(
  value: any
) {

  const parsed =
    Number(
      value
    );


  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;

}


function integer(
  value: any
) {

  return new Intl.NumberFormat(
    'en-IN',
    {
      maximumFractionDigits:
        0,
    }
  ).format(
    number(
      value
    )
  );

}


function decimal(
  value: any
) {

  return number(
    value
  ).toFixed(
    2
  );

}


function pct(
  value: any
) {

  return `${number(
    value
  ).toFixed(
    1
  )}%`;

}


function currency(
  value: any
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
    number(
      value
    )
  );

}


function compactCurrency(
  value: any
) {

  const n =
    number(
      value
    );


  if (
    n >= 10000000
  ) {

    return `₹${(
      n /
      10000000
    ).toFixed(
      1
    )}Cr`;

  }


  if (
    n >= 100000
  ) {

    return `₹${(
      n /
      100000
    ).toFixed(
      1
    )}L`;

  }


  if (
    n >= 1000
  ) {

    return `₹${(
      n /
      1000
    ).toFixed(
      0
    )}K`;

  }


  return `₹${n}`;

}


function prettyChannel(
  value: any
) {

  if (!value) {
    return 'Unknown';
  }


  return String(
    value
  )
    .replaceAll(
      '_',
      ' '
    )
    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase()
    );

}


function cleanPath(
  value: any
) {

  if (!value) {
    return 'Unknown → Purchase';
  }


  let path =
    String(
      value
    )
      .replaceAll(
        '>',
        '→'
      )
      .replaceAll(
        '|',
        '→'
      );


  if (
    !path
      .toLowerCase()
      .includes(
        'purchase'
      )
  ) {

    path +=
      ' → Purchase';

  }


  return path;

}


function prettyCustomerType(
  value: any
) {

  const normalized =
    String(
      value ||
      ''
    ).toUpperCase();


  if (
    normalized.includes(
      'FIRST'
    ) ||
    normalized.includes(
      'NEW'
    )
  ) {

    return 'New';

  }


  if (
    normalized.includes(
      'REPEAT'
    )
  ) {

    return 'Repeat';

  }


  return value ||
    'Unknown';

}


function creativeName(
  row: any
) {

  if (
    row.creative_id &&
    row.creative_id !==
      'UNMAPPED'
  ) {

    return `Creative ${row.creative_id}`;

  }


  if (
    row.ad_id &&
    row.ad_id !==
      'UNMAPPED'
  ) {

    return `Ad ${row.ad_id}`;

  }


  return 'Unmapped Creative';

}


function formatDate(
  value: string
) {

  if (!value) {
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
    new Date(
      `${value}T00:00:00`
    )
  );

}