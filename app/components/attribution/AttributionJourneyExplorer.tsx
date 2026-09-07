'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowRight,
  Clock3,
  Eye,
  GitBranch,
  Search,
  ShoppingCart,
} from 'lucide-react';


type Props = {
  startDate: string;
  endDate: string;
};


const MODEL =
  'LAST_NON_DIRECT';


export default function AttributionJourneyExplorer({
  startDate,
  endDate,
}: Props) {

  const [
    journeys,
    setJourneys,
  ] = useState<any[]>(
    []
  );


  const [
    selectedOrderId,
    setSelectedOrderId,
  ] = useState<string>(
    ''
  );


  const [
    search,
    setSearch,
  ] = useState(
    ''
  );


  const [
    appliedSearch,
    setAppliedSearch,
  ] = useState(
    ''
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


      const params =
        new URLSearchParams({

          start:
            startDate,

          end:
            endDate,

          model:
            MODEL,

          limit:
            '50',

        });


      if (appliedSearch) {

        params.set(
          'search',
          appliedSearch
        );

      }


      const response =
        await fetch(
          `/api/attribution-os/journeys?${params.toString()}`,
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
          json?.error
          ||
          'Unable to load journeys'
        );

      }


      const rows =
        json?.data?.journeys
        || [];


      setJourneys(
        rows
      );


      setSelectedOrderId(
        current => {

          if (
            current &&
            rows.some(
              (row: any) =>
                row.order_id ===
                current
            )
          ) {

            return current;

          }


          return (
            rows?.[0]?.order_id
            || ''
          );

        }
      );


    } catch (
      loadError: any
    ) {

      console.error(
        'ATTRIBUTION_JOURNEY_UI_ERROR',
        loadError
      );


      setError(
        loadError?.message
        ||
        'Unable to load journeys'
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
      appliedSearch,
    ]
  );


  const selected =
    journeys.find(
      row =>
        row.order_id ===
        selectedOrderId
    )
    ||
    journeys[0]
    ||
    null;


  const summary =
    useMemo(
      () => {

        const total =
          journeys.length;


        const exact =
          journeys.filter(
            row =>
              String(
                row.match_status
                || ''
              )
              .toUpperCase()
              .includes(
                'EXACT'
              )
          ).length;


        const multiSession =
          journeys.filter(
            row =>
              num(
                row.sessions_before_purchase
              ) > 1
          ).length;


        const multiTouch =
          journeys.filter(
            row =>
              num(
                row.marketing_touches_before_purchase
              ) > 1
          ).length;


        return {
          total,
          exact,
          multiSession,
          multiTouch,
        };

      },
      [
        journeys,
      ]
    );


  function submitSearch(
    event: React.FormEvent
  ) {

    event.preventDefault();


    setAppliedSearch(
      search.trim()
    );

  }


  if (error) {

    return (

      <section className="rounded-lg border border-red-200 bg-red-50 p-3.5">

        <h3 className="font-semibold text-red-900">
          Journey Explorer failed to load
        </h3>

        <p className="mt-1 text-[11px] text-red-700">
          {error}
        </p>

        <button
          type="button"
          onClick={
            load
          }
          className="mt-2.5 rounded-xl bg-red-900 px-3 py-2 text-[10px] font-semibold text-white"
        >
          Retry
        </button>

      </section>

    );

  }


  return (

    <div className="space-y-3">


      {/* =====================================================
          TOP STRIP
      ===================================================== */}

      <section className="flex flex-wrap items-end justify-between gap-2.5">

        <div>

          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600">
            Journey Explorer
          </p>

          <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.035em] text-slate-950">
            Individual customer journeys
          </h2>

          <p className="mt-1 text-[10px] text-slate-400">
            Follow the complete sequence from discovery to purchase.
          </p>

        </div>


        <form
          onSubmit={
            submitSearch
          }
          className="flex items-center gap-2"
        >

          <div className="flex h-8 w-[300px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm">

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
              placeholder="Order, customer or visitor"
              className="min-w-0 flex-1 bg-transparent text-[10px] font-medium text-slate-800 outline-none"
            />

          </div>


          <button
            type="submit"
            className="h-8 rounded-xl bg-slate-950 px-3 text-[10px] font-semibold text-white"
          >
            Search
          </button>

        </form>

      </section>


      {/* =====================================================
          KPIs
      ===================================================== */}

      <section className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid-cols-4">

        <MiniKpi
          label="Journeys Loaded"
          value={
            integer(
              summary.total
            )
          }
        />

        <MiniKpi
          label="Exact Matched"
          value={
            integer(
              summary.exact
            )
          }
        />

        <MiniKpi
          label="Multi-session"
          value={
            integer(
              summary.multiSession
            )
          }
        />

        <MiniKpi
          label="Multi-touch"
          value={
            integer(
              summary.multiTouch
            )
          }
          last
        />

      </section>


      {/* =====================================================
          EXPLORER
      ===================================================== */}

      <section className="grid min-h-[650px] grid-cols-1 gap-3 xl:grid-cols-[380px_minmax(0,1fr)]">


        {/* ===================================================
            LEFT — ORDERS
        =================================================== */}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-100 px-3 py-2">

            <div className="flex items-center justify-between">

              <div>

                <h3 className="text-[11px] font-semibold text-slate-950">
                  Orders
                </h3>

                <p className="mt-0.5 text-[10px] text-slate-400">
                  Most recent first
                </p>

              </div>


              {loading && (

                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />

              )}

            </div>

          </div>


          <div className="max-h-[720px] overflow-y-auto">

            {journeys.length > 0
              ? journeys.map(
                  row => (

                    <button
                      key={
                        row.order_id
                      }
                      type="button"

                      onClick={() =>
                        setSelectedOrderId(
                          row.order_id
                        )
                      }

                      className={`
                        w-full
                        border-b
                        border-slate-100
                        px-3
                        py-2
                        text-left
                        transition

                        ${
                          selected?.order_id ===
                          row.order_id

                            ? 'bg-violet-50'

                            : 'hover:bg-slate-50'
                        }
                      `}
                    >

                      <div className="flex items-start justify-between gap-2.5">

                        <div>

                          <p className="text-[11px] font-semibold text-slate-900">
                            {
                              row.order_name
                              ||
                              row.order_id
                            }
                          </p>

                          <p className="mt-1 text-[10px] text-slate-400">
                            {
                              formatDateTime(
                                row.order_created_at
                              )
                            }
                          </p>

                        </div>


                        <p className="text-[10px] font-semibold text-slate-900">
                          {
                            currency(
                              row.order_value
                            )
                          }
                        </p>

                      </div>


                      <div className="mt-2 flex flex-wrap items-center gap-1.5">

                        <Pill
                          text={
                            pretty(
                              row.first_touch_channel
                              ||
                              row.first_session_channel
                            )
                          }
                        />

                        <ArrowRight
                          size={11}
                          className="text-slate-300"
                        />

                        <Pill
                          text={
                            pretty(
                              row.last_touch_channel
                              ||
                              row.converting_channel
                            )
                          }
                        />

                      </div>


                      <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">

                        <span>
                          {
                            integer(
                              row.sessions_before_purchase
                            )
                          } sessions
                        </span>

                        <span>
                          {
                            integer(
                              row.marketing_touches_before_purchase
                            )
                          } touches
                        </span>

                        <span>
                          {
                            decimal(
                              row.days_to_purchase
                            )
                          }d
                        </span>

                      </div>

                    </button>

                  )
                )
              : (

                  <div className="p-4 text-center text-[11px] text-slate-400">
                    No journeys found.
                  </div>

                )}

          </div>

        </div>


        {/* ===================================================
            RIGHT — DETAIL
        =================================================== */}

        <div>

          {selected
            ? (

                <JourneyDetail
                  journey={
                    selected
                  }
                />

              )
            : (

                <div className="flex min-h-[500px] items-center justify-center rounded-lg border border-slate-200 bg-white text-[11px] text-slate-400">
                  Select an order to inspect its journey.
                </div>

              )}

        </div>

      </section>

    </div>

  );

}


function JourneyDetail({
  journey,
}: {
  journey: any;
}) {

  const touches =
    journey.touchpoints
    || [];


  return (

    <div className="space-y-3">


      {/* ORDER HEADER */}

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">

        <div className="flex flex-wrap items-start justify-between gap-2.5">

          <div>

            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-600">
              Selected Order
            </p>

            <h2 className="mt-1 text-[14px] font-semibold tracking-[-0.04em] text-slate-950">
              {
                journey.order_name
                ||
                journey.order_id
              }
            </h2>

            <p className="mt-1 text-[10px] text-slate-400">
              {
                formatDateTime(
                  journey.order_created_at
                )
              }
            </p>

          </div>


          <div className="text-right">

            <p className="text-[14px] font-semibold text-slate-950">
              {
                currency(
                  journey.order_value
                )
              }
            </p>

            <StatusPill
              text={
                journey.match_status
                ||
                'UNKNOWN'
              }
            />

          </div>

        </div>


        <div className="mt-3 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-5 md:grid-cols-4">

          <DetailMetric
            label="Sessions"
            value={
              integer(
                journey.sessions_before_purchase
              )
            }
          />

          <DetailMetric
            label="Marketing Touches"
            value={
              integer(
                journey.marketing_touches_before_purchase
              )
            }
          />

          <DetailMetric
            label="Channels"
            value={
              integer(
                journey.unique_channels_before_purchase
              )
            }
          />

          <DetailMetric
            label="Days to Purchase"
            value={
              decimal(
                journey.days_to_purchase
              )
            }
          />

        </div>

      </section>


      {/* JOURNEY PATH */}

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">

        <SectionTitle
          title="Journey Path"
          subtitle="Marketing-channel sequence before purchase"
        />


        <div className="mt-2.5 flex flex-wrap items-center gap-2">

          {pathParts(
            journey.touch_channel_path
            ||
            journey.session_channel_path
          ).map(
            (
              part,
              index,
              parts
            ) => (

              <div
                key={
                  `${part}-${index}`
                }
                className="flex items-center gap-2"
              >

                <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-700">
                  {
                    pretty(
                      part
                    )
                  }
                </span>

                {index <
                  parts.length - 1 && (

                  <ArrowRight
                    size={14}
                    className="text-slate-300"
                  />

                )}

              </div>

            )
          )}


          <ArrowRight
            size={14}
            className="text-slate-300"
          />

          <span className="rounded-xl bg-slate-950 px-3 py-2 text-[10px] font-semibold text-white">
            Purchase
          </span>

        </div>

      </section>


      {/* TOUCH TIMELINE */}

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">

        <SectionTitle
          title="Marketing Touch Timeline"
          subtitle="Ordered touchpoints used by the attribution model"
        />


        <div className="mt-3">

          {touches.length > 0
            ? touches.map(
                (
                  touch: any,
                  index: number
                ) => (

                  <div
                    key={
                      `${touch.touch_number}-${index}`
                    }
                    className="relative flex gap-2.5 pb-6 last:pb-0"
                  >

                    {index <
                      touches.length - 1 && (

                      <div className="absolute left-[15px] top-4 h-[calc(100%-20px)] w-px bg-slate-200" />

                    )}


                    <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-violet-50 text-[11px] font-semibold text-violet-700">

                      {
                        touch.touch_number
                      }

                    </div>


                    <div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-slate-50/70 p-4">

                      <div className="flex flex-wrap items-start justify-between gap-3">

                        <div>

                          <p className="font-semibold text-slate-900">
                            {
                              pretty(
                                touch.channel
                              )
                            }
                          </p>

                          <p className="mt-1 text-[11px] text-slate-400">
                            {
                              [
                                touch.source,
                                touch.medium,
                              ]
                                .filter(
                                  Boolean
                                )
                                .join(
                                  ' / '
                                )
                              ||
                              'No source / medium'
                            }
                          </p>

                        </div>


                        <div className="text-right">

                          <p className="text-[10px] font-bold text-slate-600">
                            {
                              formatDateTime(
                                touch.touchpoint_timestamp
                              )
                            }
                          </p>

                          <p className="mt-1 text-[10px] text-slate-400">
                            {
                              decimal(
                                touch.days_before_order
                              )
                            } days before order
                          </p>

                        </div>

                      </div>


                      <div className="mt-3 flex flex-wrap gap-2">

                        {touch.campaign_id && (

                          <Pill
                            text={
                              `Campaign ${touch.campaign_id}`
                            }
                          />

                        )}

                        {touch.ad_id && (

                          <Pill
                            text={
                              `Ad ${touch.ad_id}`
                            }
                          />

                        )}

                        {touch.creative_id && (

                          <Pill
                            text={
                              `Creative ${touch.creative_id}`
                            }
                          />

                        )}

                        {touch.keyword && (

                          <Pill
                            text={
                              touch.keyword
                            }
                          />

                        )}

                      </div>


                      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">

                        <span className="text-[10px] font-semibold text-slate-400">
                          Attribution credit
                        </span>

                        <div className="text-right">

                          <span className="text-[10px] font-semibold text-violet-700">
                            {
                              pctFromFraction(
                                touch.credit_weight
                              )
                            }
                          </span>

                          <span className="ml-2 text-[10px] font-semibold text-slate-900">
                            {
                              currency(
                                touch.attributed_revenue
                              )
                            }
                          </span>

                        </div>

                      </div>

                    </div>

                  </div>

                )
              )
            : (

                <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-400">
                  No model touch credits are available for this order.
                </div>

              )}

        </div>

      </section>


      {/* BEHAVIOUR */}

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">

        <SectionTitle
          title="Pre-purchase Behaviour"
          subtitle="What the visitor did before converting"
        />


        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">

          <BehaviourMetric
            icon={
              <Eye size={15} />
            }
            label="Page Views"
            value={
              journey.page_views_before_purchase
            }
          />

          <BehaviourMetric
            icon={
              <Eye size={15} />
            }
            label="Product Views"
            value={
              journey.product_views_before_purchase
            }
          />

          <BehaviourMetric
            icon={
              <GitBranch size={15} />
            }
            label="Collections"
            value={
              journey.collection_views_before_purchase
            }
          />

          <BehaviourMetric
            icon={
              <Search size={15} />
            }
            label="Searches"
            value={
              journey.searches_before_purchase
            }
          />

          <BehaviourMetric
            icon={
              <ShoppingCart size={15} />
            }
            label="Add to Cart"
            value={
              journey.add_to_cart_events_before_purchase
            }
          />

          <BehaviourMetric
            icon={
              <Clock3 size={15} />
            }
            label="Checkout Starts"
            value={
              journey.checkout_starts_before_purchase
            }
          />

        </div>

      </section>


      {/* PRODUCTS */}

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">

        <SimplePanel
          title="Products Viewed"
          value={
            journey.products_viewed_before_purchase
          }
          count={
            journey.unique_products_viewed_before_purchase
          }
        />

        <SimplePanel
          title="Products Added"
          value={
            journey.products_added_before_purchase
          }
          count={
            journey.unique_products_added_before_purchase
          }
        />

      </section>

    </div>

  );

}


function MiniKpi({
  label,
  value,
  last = false,
}: any) {

  return (

    <div
      className={`
        p-4
        ${
          last
            ? ''
            : 'border-b border-r border-slate-200'
        }
      `}
    >

      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-[15px] font-semibold text-slate-950">
        {value}
      </p>

    </div>

  );

}


function DetailMetric({
  label,
  value,
}: any) {

  return (

    <div>

      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-[14px] font-semibold text-slate-950">
        {value}
      </p>

    </div>

  );

}


function SectionTitle({
  title,
  subtitle,
}: any) {

  return (

    <div>

      <h3 className="text-[11px] font-semibold text-slate-950">
        {title}
      </h3>

      <p className="mt-1 text-[10px] text-slate-400">
        {subtitle}
      </p>

    </div>

  );

}


function BehaviourMetric({
  icon,
  label,
  value,
}: any) {

  return (

    <div className="rounded-xl bg-slate-50 p-3">

      <div className="flex items-center gap-2 text-slate-400">
        {icon}

        <span className="text-[10px] font-bold uppercase tracking-wide">
          {label}
        </span>
      </div>

      <p className="mt-2 text-[14px] font-semibold text-slate-950">
        {
          integer(
            value
          )
        }
      </p>

    </div>

  );

}


function SimplePanel({
  title,
  value,
  count,
}: any) {

  return (

    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">

      <div className="flex items-center justify-between gap-3">

        <h3 className="text-[11px] font-semibold text-slate-950">
          {title}
        </h3>

        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
          {
            integer(
              count
            )
          } unique
        </span>

      </div>

      <p className="mt-2.5 break-words text-[10px] leading-6 text-slate-500">
        {
          value
          ||
          'No products recorded'
        }
      </p>

    </section>

  );

}


function Pill({
  text,
}: {
  text: string;
}) {

  return (

    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">
      {text}
    </span>

  );

}


function StatusPill({
  text,
}: {
  text: string;
}) {

  const exact =
    String(
      text
    )
      .toUpperCase()
      .includes(
        'EXACT'
      );


  return (

    <span
      className={`
        mt-2
        inline-flex
        rounded-full
        px-2.5
        py-1
        text-[10px]
        font-semibold

        ${
          exact
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-amber-50 text-amber-700'
        }
      `}
    >
      {text}
    </span>

  );

}


function num(
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


function pctFromFraction(
  value: any
) {

  return `${(
    num(
      value
    )
    *
    100
  ).toFixed(
    1
  )}%`;

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


function pathParts(
  value: any
) {

  if (!value) {

    return [
      'Unknown',
    ];

  }


  return String(
    value
  )
    .replaceAll(
      '>',
      '→'
    )
    .replaceAll(
      '|',
      '→'
    )
    .split(
      '→'
    )
    .map(
      item =>
        item.trim()
    )
    .filter(
      Boolean
    );

}


function formatDateTime(
  value: any
) {

  if (!value) {
    return '—';
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return String(
      value
    );

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

      hour:
        '2-digit',

      minute:
        '2-digit',

      timeZone:
        'Asia/Kolkata',
    }
  ).format(
    date
  );

}
