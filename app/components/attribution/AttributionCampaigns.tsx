'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Search,
} from 'lucide-react';

import {
  GrowthOSPageActionPortal,
} from '../ui/GrowthOSPageShell';

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
          model: 'LAST_NON_DIRECT',
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

      if (
        !response.ok ||
        !json?.ok
      ) {
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

      if (!q) {
        return rows;
      }

      return rows.filter(
        row =>
          String(
            row.campaign_id ||
              ''
          )
            .toLowerCase()
            .includes(q) ||
          String(
            row.channel ||
              ''
          )
            .toLowerCase()
            .includes(q) ||
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
        a +
        num(
          r.attributed_revenue
        ),
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
    <>
      <GrowthOSPageActionPortal>
        <SearchControl
          value={search}
          onChange={setSearch}
        />
      </GrowthOSPageActionPortal>

      <div className="space-y-3">
        <section className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid-cols-4">
          <Metric
            label="Campaigns"
            value={integer(
              rows.length
            )}
          />

          <Metric
            label="Attributed Revenue"
            value={currency(
              totalRevenue
            )}
          />

          <Metric
            label="Assisted Orders"
            value={integer(
              sum(
                rows,
                'assisted_orders'
              )
            )}
          />

          <Metric
            label="Equivalent Credits"
            value={decimal(
              sum(
                rows,
                'equivalent_order_credits'
              )
            )}
          />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-slate-50/70">
                <tr className="border-b border-slate-200">
                  <Th>
                    Campaign ID
                  </Th>

                  <Th>
                    Channel
                  </Th>

                  <Th>
                    Source
                  </Th>

                  <Th>
                    Assisted
                  </Th>

                  <Th>
                    Starter
                  </Th>

                  <Th>
                    Assist
                  </Th>

                  <Th>
                    Closer
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
                {filtered.map(
                  (
                    row,
                    index
                  ) => (
                    <tr
                      key={`${row.channel}-${row.campaign_id}-${index}`}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                    >
                      <Td>
                        <strong className="font-semibold text-slate-900">
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
                        <strong className="font-semibold text-slate-900">
                          {currency(
                            row.attributed_revenue
                          )}
                        </strong>
                      </Td>
                    </tr>
                  )
                )}

                {filtered.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-[11px] text-slate-400"
                    >
                      No campaigns found
                      for the selected
                      period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

function SearchControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <div className="flex h-9 w-[300px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
      <Search
        size={15}
        className="shrink-0 text-slate-400"
      />

      <input
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        placeholder="Search campaign..."
        className="min-w-0 flex-1 bg-transparent text-[11px] font-medium text-slate-800 outline-none placeholder:text-slate-400"
      />
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-r border-slate-200 p-4 last:border-r-0 lg:border-b-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-[16px] font-semibold tracking-[-0.02em] text-slate-950">
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
    <th
      className={`px-3 py-2.5 text-${align} text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-400`}
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
      className={`px-3 py-2 text-${align} text-[11px] text-slate-600`}
    >
      {children}
    </td>
  );
}

function Loading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center text-[11px] text-slate-400">
      Loading campaigns...
    </div>
  );
}

function ErrorBox({
  text,
  retry,
}: any) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="font-semibold text-red-900">
        {text}
      </p>

      <button
        onClick={retry}
        className="mt-3 rounded-lg bg-red-900 px-3 py-2 text-[10px] font-semibold text-white"
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
      c =>
        c.toUpperCase()
    );
}