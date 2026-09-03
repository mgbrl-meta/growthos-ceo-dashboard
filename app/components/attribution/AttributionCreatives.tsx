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


export default function AttributionCreatives({
  startDate,
  endDate,
}: Props) {

  const [
    rows,
    setRows,
  ] = useState<any[]>([]);


  const [
    search,
    setSearch,
  ] = useState('');


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    error,
    setError,
  ] = useState('');


  async function load() {

    try {

      setLoading(true);
      setError('');


      const params =
        new URLSearchParams({

          start:
            startDate,

          end:
            endDate,

          model:
            'LAST_NON_DIRECT',

        });


      const response =
        await fetch(

          `/api/attribution-os/creatives?${params.toString()}`,

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
          'Unable to load creatives'
        );

      }


      setRows(
        json?.data?.creatives ||
        []
      );


    } catch (
      error: any
    ) {

      console.error(
        'ATTRIBUTION_CREATIVES_UI_ERROR',
        error
      );


      setError(
        error?.message ||
        'Unable to load creatives'
      );


    } finally {

      setLoading(false);

    }

  }


  useEffect(
    () => {

      load();

    },
    [
      startDate,
      endDate,
    ]
  );


  const filtered =
    useMemo(
      () => {

        const q =
          search
            .trim()
            .toLowerCase();


        if (!q) {
          return rows;
        }


        return rows.filter(
          row =>

            [
              row.creative_id,
              row.ad_id,
              row.adset_id,
              row.campaign_id,
              row.channel,
            ]
              .some(
                value =>
                  String(
                    value || ''
                  )
                    .toLowerCase()
                    .includes(q)
              )

        );

      },
      [
        rows,
        search,
      ]
    );


  const totalRevenue =
    sum(
      rows,
      'attributed_revenue'
    );


  const totalAssisted =
    sum(
      rows,
      'assisted_orders'
    );


  const totalCredits =
    sum(
      rows,
      'equivalent_order_credits'
    );


  if (loading) {

    return (

      <div className="flex min-h-[400px] items-center justify-center">

        <div className="text-center">

          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />

          <p className="mt-3 text-sm text-slate-400">
            Loading creatives...
          </p>

        </div>

      </div>

    );

  }


  if (error) {

    return (

      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">

        <p className="font-black text-red-900">
          Creative attribution failed to load
        </p>

        <p className="mt-1 text-sm text-red-700">
          {error}
        </p>


        <button
          type="button"
          onClick={load}
          className="mt-4 rounded-xl bg-red-900 px-4 py-2 text-xs font-black text-white"
        >
          Retry
        </button>

      </div>

    );

  }


  return (

    <div className="space-y-5">


      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <section className="flex flex-wrap items-end justify-between gap-4">

        <div>

          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">
            Attribution OS
          </p>


          <h2 className="mt-1 text-xl font-black tracking-[-0.035em] text-slate-950">
            Creative Attribution
          </h2>


          <p className="mt-1 text-xs text-slate-400">
            Identify which individual ads and creatives start, assist and close customer journeys.
          </p>

        </div>


        <div className="flex h-10 w-[320px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm">

          <Search
            size={15}
            className="text-slate-400"
          />


          <input

            value={
              search
            }

            onChange={
              event =>
                setSearch(
                  event.target.value
                )
            }

            placeholder="Search creative, ad or campaign"

            className="min-w-0 flex-1 bg-transparent text-xs font-medium text-slate-800 outline-none"

          />

        </div>

      </section>


      {/* =====================================================
          KPI STRIP
      ===================================================== */}

      <section className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-4">


        <Metric
          label="Creatives"
          value={
            integer(
              rows.length
            )
          }
        />


        <Metric
          label="Attributed Revenue"
          value={
            currency(
              totalRevenue
            )
          }
        />


        <Metric
          label="Assisted Orders"
          value={
            integer(
              totalAssisted
            )
          }
        />


        <Metric
          label="Equivalent Credits"
          value={
            decimal(
              totalCredits
            )
          }
          last
        />


      </section>


      {/* =====================================================
          TABLE
      ===================================================== */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">


        <div className="border-b border-slate-100 px-5 py-4">

          <div className="flex items-center justify-between gap-4">

            <div>

              <h3 className="text-sm font-black text-slate-950">
                Creative Intelligence
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                Creative-level journey contribution
              </p>

            </div>


            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500">

              {
                integer(
                  filtered.length
                )
              } rows

            </span>

          </div>

        </div>


        <div className="overflow-x-auto">

          <table className="w-full min-w-[1250px]">

            <thead>

              <tr className="border-b border-slate-200">

                <Th>
                  Creative
                </Th>

                <Th>
                  Channel
                </Th>

                <Th>
                  Campaign
                </Th>

                <Th>
                  Ad Set
                </Th>

                <Th>
                  Ad
                </Th>

                <Th>
                  Assisted
                </Th>

                <Th>
                  Visitors
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

                <Th right>
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
                      `${
                        row.creative_id
                      }-${
                        row.ad_id
                      }-${index}`
                    }

                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"

                  >


                    <Td>

                      <div className="font-bold text-slate-900">

                        {
                          row.creative_id &&
                          row.creative_id !==
                            'UNMAPPED'

                            ? row.creative_id

                            : 'Unmapped'
                        }

                      </div>

                    </Td>


                    <Td>

                      <ChannelPill
                        channel={
                          row.channel
                        }
                      />

                    </Td>


                    <Td>
                      {
                        displayId(
                          row.campaign_id
                        )
                      }
                    </Td>


                    <Td>
                      {
                        displayId(
                          row.adset_id
                        )
                      }
                    </Td>


                    <Td>
                      {
                        displayId(
                          row.ad_id
                        )
                      }
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
                        integer(
                          row.starter_orders
                        )
                      }
                    </Td>


                    <Td>
                      {
                        integer(
                          row.assist_orders
                        )
                      }
                    </Td>


                    <Td>
                      {
                        integer(
                          row.closer_orders
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


                    <Td right>

                      <strong className="text-slate-950">

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


              {filtered.length === 0 && (

                <tr>

                  <td
                    colSpan={12}
                    className="px-5 py-12 text-center text-sm text-slate-400"
                  >
                    No creatives found for the selected period.
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </section>

    </div>

  );

}


/* ============================================================
   KPI
============================================================ */

function Metric({
  label,
  value,
  last = false,
}: any) {

  return (

    <div
      className={
        last
          ? 'p-4'
          : 'border-b border-r border-slate-200 p-4'
      }
    >

      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>


      <p className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">
        {value}
      </p>

    </div>

  );

}


/* ============================================================
   TABLE
============================================================ */

function Th({
  children,
  right = false,
}: any) {

  return (

    <th
      className={
        right

          ? 'px-4 py-3 text-right text-[10px] font-black uppercase tracking-wide text-slate-400'

          : 'px-4 py-3 text-left text-[10px] font-black uppercase tracking-wide text-slate-400'
      }
    >
      {children}
    </th>

  );

}


function Td({
  children,
  right = false,
}: any) {

  return (

    <td
      className={
        right

          ? 'px-4 py-3 text-right text-xs text-slate-600'

          : 'px-4 py-3 text-left text-xs text-slate-600'
      }
    >
      {children}
    </td>

  );

}


/* ============================================================
   CHANNEL
============================================================ */

function ChannelPill({
  channel,
}: any) {

  return (

    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">

      {
        pretty(
          channel
        )
      }

    </span>

  );

}


/* ============================================================
   FORMATTERS
============================================================ */

function num(
  value: any
) {

  const number =
    Number(
      value
    );


  return Number.isFinite(
    number
  )
    ? number
    : 0;

}


function sum(
  rows: any[],
  key: string
) {

  return rows.reduce(
    (
      total,
      row
    ) =>
      total +
      num(
        row?.[key]
      ),
    0
  );

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
    num(
      value
    )
  );

}


function decimal(
  value: any
) {

  return num(
    value
  ).toFixed(
    2
  );

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
    num(
      value
    )
  );

}


function pretty(
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
      character =>
        character.toUpperCase()
    );

}


function displayId(
  value: any
) {

  if (
    !value ||
    value ===
      'UNMAPPED'
  ) {

    return '—';

  }


  return String(
    value
  );

}