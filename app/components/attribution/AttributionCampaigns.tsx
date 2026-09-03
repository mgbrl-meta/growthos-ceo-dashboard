'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Search,
} from 'lucide-react';


type Props = {
  startDate: string;
  endDate: string;
};


export default function AttributionCampaigns({
  startDate,
  endDate,
}: Props) {

  const [rows, setRows] =
    useState<any[]>([]);

  const [search, setSearch] =
    useState('');

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
          model:
            'LAST_NON_DIRECT',
        });

      const response =
        await fetch(
          `/api/attribution-os/campaigns?${params.toString()}`,
          {
            cache: 'no-store',
          }
        );

      const json =
        await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(
          json?.error ||
          'Unable to load campaigns'
        );
      }

      setRows(
        json?.data?.campaigns ||
        []
      );

    } catch (error: any) {
      setError(
        error?.message ||
        'Unable to load campaigns'
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


  const filtered =
    useMemo(() => {

      const q =
        search
          .trim()
          .toLowerCase();

      if (!q)
        return rows;

      return rows.filter(
        row =>
          String(
            row.campaign_id ||
            ''
          )
            .toLowerCase()
            .includes(q)
          ||
          String(
            row.channel ||
            ''
          )
            .toLowerCase()
            .includes(q)
          ||
          String(
            row.source ||
            ''
          )
            .toLowerCase()
            .includes(q)
      );

    }, [
      rows,
      search,
    ]);


  const totalRevenue =
    rows.reduce(
      (a, r) =>
        a + num(r.attributed_revenue),
      0
    );


  if (loading) {
    return <Loading />;
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
    <div className="space-y-5">

      <div className="flex flex-wrap items-end justify-between gap-4">

        <PageIntro
          title="Campaign Attribution"
          description="Campaign-level contribution across the customer journey."
        />


        <div className="flex h-10 w-[300px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm">

          <Search
            size={15}
            className="text-slate-400"
          />

          <input
            value={search}
            onChange={
              e =>
                setSearch(
                  e.target.value
                )
            }
            placeholder="Search campaign..."
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
          />

        </div>

      </div>


      <section className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-4">

        <Metric
          label="Campaigns"
          value={
            integer(rows.length)
          }
        />

        <Metric
          label="Attributed Revenue"
          value={
            currency(totalRevenue)
          }
        />

        <Metric
          label="Assisted Orders"
          value={
            integer(
              sum(
                rows,
                'assisted_orders'
              )
            )
          }
        />

        <Metric
          label="Equivalent Credits"
          value={
            decimal(
              sum(
                rows,
                'equivalent_order_credits'
              )
            )
          }
          last
        />

      </section>


      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1100px]">

            <thead>
              <tr>
                <Th>Campaign ID</Th>
                <Th>Channel</Th>
                <Th>Source</Th>
                <Th>Assisted</Th>
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
              {filtered.map(
                (
                  row,
                  index
                ) => (
                  <tr
                    key={
                      `${row.channel}-${row.campaign_id}-${index}`
                    }
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >

                    <Td>
                      <strong>
                        {row.campaign_id}
                      </strong>
                    </Td>

                    <Td>
                      {pretty(
                        row.channel
                      )}
                    </Td>

                    <Td>
                      {row.source}
                    </Td>

                    <Td>
                      {integer(
                        row.assisted_orders
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

          </table>

        </div>

      </section>

    </div>
  );
}


function PageIntro({
  title,
  description,
}: any) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">
        Attribution OS
      </p>
      <h2 className="mt-1 text-xl font-black tracking-[-0.035em]">
        {title}
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        {description}
      </p>
    </div>
  );
}


function Metric({
  label,
  value,
  last,
}: any) {
  return (
    <div className={last ? 'p-4' : 'border-b border-r border-slate-200 p-4'}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-xl font-black">
        {value}
      </p>
    </div>
  );
}


function Th({
  children,
  align = 'left',
}: any) {
  return (
    <th className={`px-4 py-3 text-${align} text-[10px] font-black uppercase tracking-wide text-slate-400`}>
      {children}
    </th>
  );
}


function Td({
  children,
  align = 'left',
}: any) {
  return (
    <td className={`px-4 py-3 text-${align} text-sm text-slate-600`}>
      {children}
    </td>
  );
}


function Loading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center text-sm text-slate-400">
      Loading campaigns...
    </div>
  );
}


function ErrorBox({
  text,
  retry,
}: any) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
      <p className="font-black text-red-900">
        {text}
      </p>
      <button
        onClick={retry}
        className="mt-3 rounded-xl bg-red-900 px-4 py-2 text-xs font-black text-white"
      >
        Retry
      </button>
    </div>
  );
}


function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n)
    ? n
    : 0;
}

function sum(
  rows: any[],
  key: string
) {
  return rows.reduce(
    (a, r) =>
      a + num(r[key]),
    0
  );
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

function pretty(v: any) {
  return String(
    v || 'Unknown'
  )
    .replaceAll('_', ' ')
    .replace(
      /\b\w/g,
      c => c.toUpperCase()
    );
}