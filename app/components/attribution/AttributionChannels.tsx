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
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';


type Props = {
  startDate: string;
  endDate: string;
};


const MODEL =
  'LAST_NON_DIRECT';


export default function AttributionChannels({
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

      const params =
        new URLSearchParams({
          start: startDate,
          end: endDate,
          model: MODEL,
        });

      const response =
        await fetch(
          `/api/attribution-os/channels?${params.toString()}`,
          {
            cache: 'no-store',
          }
        );

      const json =
        await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(
          json?.error ||
          'Unable to load channel attribution'
        );
      }

      setRows(
        json?.data?.channels ||
        []
      );

    } catch (error: any) {
      setError(
        error?.message ||
        'Unable to load channels'
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


  const totals =
    useMemo(() => ({
      revenue:
        rows.reduce(
          (a, r) =>
            a + num(r.attributed_revenue),
          0
        ),

      assisted:
        rows.reduce(
          (a, r) =>
            a + num(r.assisted_orders),
          0
        ),

      credits:
        rows.reduce(
          (a, r) =>
            a + num(r.equivalent_order_credits),
          0
        ),

      channels:
        rows.length,
    }), [rows]);


  if (loading) {
    return <Loading text="Loading channels..." />;
  }


  if (error) {
    return (
      <ErrorBox
        text={error}
        retry={load}
      />
    );
  }


  return (
    <div className="space-y-3">

      <PageIntro
        eyebrow="Attribution OS"
        title="Channel Attribution"
        description="Understand which channels start, assist and close customer journeys."
      />


      <KpiGrid
        items={[
          [
            'Attributed Revenue',
            currency(totals.revenue),
          ],
          [
            'Assisted Orders',
            integer(totals.assisted),
          ],
          [
            'Equivalent Credits',
            decimal(totals.credits),
          ],
          [
            'Tracked Channels',
            integer(totals.channels),
          ],
        ]}
      />


      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">

        <Card
          title="Attributed Revenue"
          subtitle="Revenue contribution by channel"
        >
          <div className="h-[310px]">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={rows}
                layout="vertical"
                margin={{
                  left: 20,
                  right: 20,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                />

                <XAxis
                  type="number"
                  tickFormatter={
                    compactCurrency
                  }
                />

                <YAxis
                  type="category"
                  dataKey="channel"
                  width={100}
                  tickFormatter={pretty}
                />

                <Tooltip
                  formatter={
                    value =>
                      currency(value)
                  }
                />

                <Bar
                  dataKey="attributed_revenue"
                  name="Revenue"
                  fill="#0f172a"
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>


        <Card
          title="Journey Roles"
          subtitle="Starter, assist and closer contribution"
        >
          <div className="h-[310px]">
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
                  dataKey="channel"
                  tickFormatter={pretty}
                />

                <YAxis />

                <Tooltip />
                <Legend />

                <Bar
                  dataKey="starter_orders"
                  name="Starter"
                  stackId="role"
                  fill="#8b5cf6"
                />

                <Bar
                  dataKey="assist_orders"
                  name="Assist"
                  stackId="role"
                  fill="#f59e0b"
                />

                <Bar
                  dataKey="closer_orders"
                  name="Closer"
                  stackId="role"
                  fill="#3b82f6"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

      </section>


      <TableShell>

        <thead>
          <tr>
            <Th>Channel</Th>
            <Th>Assisted</Th>
            <Th>Credited</Th>
            <Th>Starter</Th>
            <Th>Assist</Th>
            <Th>Closer</Th>
            <Th>Credits</Th>
            <Th align="right">
              Revenue
            </Th>
          </tr>
        </thead>

        <tbody>
          {rows.map(
            row => (
              <tr
                key={row.channel}
                className="border-b border-slate-100 last:border-0"
              >
                <Td>
                  <strong>
                    {pretty(row.channel)}
                  </strong>
                </Td>

                <Td>
                  {integer(
                    row.assisted_orders
                  )}
                </Td>

                <Td>
                  {integer(
                    row.credited_orders
                  )}
                </Td>

                <Td>
                  {integer(
                    row.starter_orders
                  )}
                </Td>

                <Td>
                  {integer(
                    row.assist_orders
                  )}
                </Td>

                <Td>
                  {integer(
                    row.closer_orders
                  )}
                </Td>

                <Td>
                  {decimal(
                    row.equivalent_order_credits
                  )}
                </Td>

                <Td align="right">
                  <strong>
                    {currency(
                      row.attributed_revenue
                    )}
                  </strong>
                </Td>
              </tr>
            )
          )}
        </tbody>

      </TableShell>

    </div>
  );
}


/* shared local UI */

function PageIntro({
  eyebrow,
  title,
  description,
}: any) {
  return (
    <section>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.035em] text-slate-950">
        {title}
      </h2>
      <p className="mt-1 text-[10px] text-slate-400">
        {description}
      </p>
    </section>
  );
}


function KpiGrid({
  items,
}: {
  items: [string, string][];
}) {
  return (
    <section className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid-cols-4">
      {items.map(
        ([label, value], i) => (
          <div
            key={label}
            className={
              i < items.length - 1
                ? 'border-b border-r border-slate-200 p-4'
                : 'p-4'
            }
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {label}
            </p>
            <p className="mt-2 text-[15px] font-semibold text-slate-950">
              {value}
            </p>
          </div>
        )
      )}
    </section>
  );
}


function Card({
  title,
  subtitle,
  children,
}: any) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <h3 className="text-[11px] font-semibold text-slate-950">
        {title}
      </h3>
      <p className="mt-1 text-[10px] text-slate-400">
        {subtitle}
      </p>
      <div className="mt-2.5">
        {children}
      </div>
    </section>
  );
}


function TableShell({
  children,
}: any) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          {children}
        </table>
      </div>
    </section>
  );
}


function Th({
  children,
  align = 'left',
}: any) {
  return (
    <th className={`border-b border-slate-200 px-3 py-2 text-${align} text-[10px] font-semibold uppercase tracking-wide text-slate-400`}>
      {children}
    </th>
  );
}


function Td({
  children,
  align = 'left',
}: any) {
  return (
    <td className={`px-3 py-2 text-${align} text-[11px] text-slate-600`}>
      {children}
    </td>
  );
}


function Loading({
  text,
}: any) {
  return (
    <div className="flex min-h-[400px] items-center justify-center text-[11px] text-slate-400">
      {text}
    </div>
  );
}


function ErrorBox({
  text,
  retry,
}: any) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3.5">
      <p className="font-semibold text-red-900">
        {text}
      </p>
      <button
        onClick={retry}
        className="mt-3 rounded-xl bg-red-900 px-3 py-2 text-[10px] font-semibold text-white"
      >
        Retry
      </button>
    </div>
  );
}


function num(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function integer(value: any) {
  return new Intl.NumberFormat(
    'en-IN',
    {
      maximumFractionDigits: 0,
    }
  ).format(num(value));
}

function decimal(value: any) {
  return num(value).toFixed(2);
}

function currency(value: any) {
  return new Intl.NumberFormat(
    'en-IN',
    {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }
  ).format(num(value));
}

function compactCurrency(value: any) {
  const n = num(value);

  if (n >= 10000000)
    return `₹${(n / 10000000).toFixed(1)}Cr`;

  if (n >= 100000)
    return `₹${(n / 100000).toFixed(1)}L`;

  if (n >= 1000)
    return `₹${(n / 1000).toFixed(0)}K`;

  return `₹${n}`;
}

function pretty(value: any) {
  if (!value)
    return 'Unknown';

  return String(value)
    .replaceAll('_', ' ')
    .replace(
      /\b\w/g,
      c => c.toUpperCase()
    );
}
