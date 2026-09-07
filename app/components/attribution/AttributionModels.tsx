'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';


type Props = {
  startDate: string;
  endDate: string;
};


export default function AttributionModels({
  startDate,
  endDate,
}: Props) {

  const [rows, setRows] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');


  async function load() {
    try {
      setLoading(true);
      setError('');

      const response =
        await fetch(
          `/api/attribution-os/models?start=${startDate}&end=${endDate}`,
          {
            cache: 'no-store',
          }
        );

      const json =
        await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(
          json?.error ||
          'Unable to load models'
        );
      }

      setRows(
        json?.data?.models ||
        []
      );

    } catch (error: any) {
      setError(
        error?.message ||
        'Unable to load models'
      );

    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    load();
  }, [
    startDate,
    endDate,
  ]);


  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-[11px] text-slate-400">
        Loading attribution models...
      </div>
    );
  }


  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-red-900">
        {error}
      </div>
    );
  }


  return (
    <div className="space-y-3">

      <section>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600">
          Attribution OS
        </p>

        <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.035em]">
          Attribution Models
        </h2>

        <p className="mt-1 text-[10px] text-slate-400">
          Compare how revenue credit changes under each attribution methodology.
        </p>
      </section>


      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">

        <h3 className="text-[11px] font-semibold">
          Attributed Revenue by Model
        </h3>

        <div className="mt-2.5 h-[200px]">

          <ResponsiveContainer
            width="100%"
            height="100%"
          >

            <BarChart
              data={rows}
            >

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
              />

              <XAxis
                dataKey="attribution_model"
              />

              <YAxis
                tickFormatter={
                  compactCurrency
                }
              />

              <Tooltip
                formatter={
                  value =>
                    currency(value)
                }
              />

              <Bar
                dataKey="attributed_revenue"
                fill="#7c3aed"
                radius={[6, 6, 0, 0]}
              />

            </BarChart>

          </ResponsiveContainer>

        </div>

      </section>


      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1050px]">

            <thead>
              <tr>
                <Th>Model</Th>
                <Th>Attributed Orders</Th>
                <Th>Attributed Revenue</Th>
                <Th>Match Rate</Th>
                <Th>Revenue Coverage</Th>
                <Th>Avg Sessions</Th>
                <Th>Avg Touches</Th>
                <Th>Avg Days</Th>
                <Th>Multi-touch</Th>
              </tr>
            </thead>

            <tbody>

              {rows.map(
                row => (
                  <tr
                    key={
                      row.attribution_model
                    }
                    className="border-t border-slate-100"
                  >

                    <Td>
                      <strong>
                        {prettyModel(
                          row.attribution_model
                        )}
                      </strong>
                    </Td>

                    <Td>
                      {integer(
                        row.attributed_orders
                      )}
                    </Td>

                    <Td>
                      {currency(
                        row.attributed_revenue
                      )}
                    </Td>

                    <Td>
                      {pct(
                        row.deterministic_order_match_rate_pct
                      )}
                    </Td>

                    <Td>
                      {pct(
                        row.deterministic_revenue_coverage_pct
                      )}
                    </Td>

                    <Td>
                      {decimal(
                        row.avg_sessions_to_purchase
                      )}
                    </Td>

                    <Td>
                      {decimal(
                        row.avg_marketing_touches_to_purchase
                      )}
                    </Td>

                    <Td>
                      {decimal(
                        row.avg_days_to_purchase
                      )}
                    </Td>

                    <Td>
                      {integer(
                        row.multi_touch_orders
                      )}
                    </Td>

                  </tr>
                )
              )}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  );
}


function Th({
  children,
}: any) {
  return (
    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </th>
  );
}


function Td({
  children,
}: any) {
  return (
    <td className="px-3 py-2 text-[11px] text-slate-600">
      {children}
    </td>
  );
}


function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n)
    ? n
    : 0;
}

function integer(v: any) {
  return new Intl.NumberFormat(
    'en-IN',
    {
      maximumFractionDigits: 0,
    }
  ).format(num(v));
}

function decimal(v: any) {
  return num(v).toFixed(2);
}

function pct(v: any) {
  return `${num(v).toFixed(1)}%`;
}

function currency(v: any) {
  return new Intl.NumberFormat(
    'en-IN',
    {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }
  ).format(num(v));
}

function compactCurrency(v: any) {
  const n = num(v);

  if (n >= 10000000)
    return `₹${(n / 10000000).toFixed(1)}Cr`;

  if (n >= 100000)
    return `₹${(n / 100000).toFixed(1)}L`;

  if (n >= 1000)
    return `₹${(n / 1000).toFixed(0)}K`;

  return `₹${n}`;
}

function prettyModel(v: any) {
  return String(
    v || ''
  )
    .replaceAll('_', ' ')
    .replace(
      /\b\w/g,
      c => c.toUpperCase()
    );
}
