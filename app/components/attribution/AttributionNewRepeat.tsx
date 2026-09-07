'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';


type Props = {
  startDate: string;
  endDate: string;
};


export default function AttributionNewRepeat({
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
          `/api/attribution-os/new-repeat?start=${startDate}&end=${endDate}`,
          {
            cache: 'no-store',
          }
        );

      const json =
        await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(
          json?.error ||
          'Unable to load customer mix'
        );
      }

      setRows(
        json?.data?.segments ||
        []
      );

    } catch (error: any) {
      setError(
        error?.message ||
        'Unable to load customer mix'
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


  const chartData =
    useMemo(
      () =>
        rows.map(
          row => ({
            name:
              customerType(
                row.tracked_customer_type
              ),

            value:
              num(row.orders),
          })
        ),
      [rows]
    );


  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-[11px] text-slate-400">
        Loading customer mix...
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

      <PageIntro />


      <section className="grid grid-cols-1 gap-3 xl:grid-cols-[0.7fr_1.3fr]">

        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">

          <h3 className="text-[11px] font-semibold">
            Purchase Mix
          </h3>

          <p className="mt-1 text-[10px] text-slate-400">
            New versus repeat tracked orders
          </p>


          <div className="h-[200px]">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <PieChart>

                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={3}
                >

                  {chartData.map(
                    (
                      row,
                      index
                    ) => (
                      <Cell
                        key={
                          `${row.name}-${index}`
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

                <Tooltip />
                <Legend />

              </PieChart>

            </ResponsiveContainer>

          </div>

        </section>


        <section className="grid grid-cols-1 gap-2.5 md:grid-cols-2">

          {rows.map(
            row => (
              <section
                key={
                  row.tracked_customer_type
                }
                className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
              >

                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">
                  {customerType(
                    row.tracked_customer_type
                  )}
                </p>

                <p className="mt-2 text-[14px] font-semibold">
                  {integer(
                    row.orders
                  )} orders
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2.5">

                  <Small
                    label="Revenue"
                    value={
                      currency(
                        row.revenue
                      )
                    }
                  />

                  <Small
                    label="AOV"
                    value={
                      currency(
                        row.avg_order_value
                      )
                    }
                  />

                  <Small
                    label="Sessions"
                    value={
                      decimal(
                        row.avg_sessions_to_purchase
                      )
                    }
                  />

                  <Small
                    label="Touches"
                    value={
                      decimal(
                        row.avg_marketing_touches
                      )
                    }
                  />

                  <Small
                    label="Days"
                    value={
                      decimal(
                        row.avg_days_to_purchase
                      )
                    }
                  />

                  <Small
                    label="Customers"
                    value={
                      integer(
                        row.customers
                      )
                    }
                  />

                </div>

              </section>
            )
          )}

        </section>

      </section>

    </div>
  );
}


function PageIntro() {
  return (
    <section>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600">
        Attribution OS
      </p>
      <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.035em]">
        New vs Repeat
      </h2>
      <p className="mt-1 text-[10px] text-slate-400">
        Understand how acquisition and repeat-customer journeys differ.
      </p>
    </section>
  );
}


function Small({
  label,
  value,
}: any) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-[14px] font-semibold">
        {value}
      </p>
    </div>
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

function customerType(v: any) {
  const x =
    String(v || '')
      .toUpperCase();

  if (
    x.includes('FIRST')
    ||
    x.includes('NEW')
  )
    return 'New Customer';

  if (
    x.includes('REPEAT')
  )
    return 'Repeat Customer';

  return v || 'Unknown';
}
