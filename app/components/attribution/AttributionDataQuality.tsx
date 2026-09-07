'use client';

import {
  useEffect,
  useState,
} from 'react';


export default function AttributionDataQuality() {

  const [health, setHealth] =
    useState<any>(null);

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
          '/api/attribution-os/data-quality',
          {
            cache: 'no-store',
          }
        );

      const json =
        await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(
          json?.error ||
          'Unable to load data quality'
        );
      }

      setHealth(
        json?.data?.health ||
        null
      );

    } catch (error: any) {
      setError(
        error?.message ||
        'Unable to load data quality'
      );

    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    load();
  }, []);


  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-[11px] text-slate-400">
        Checking attribution infrastructure...
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

      <section className="flex items-end justify-between gap-2.5">

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600">
            Attribution OS
          </p>

          <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.035em]">
            Data Quality
          </h2>

          <p className="mt-1 text-[10px] text-slate-400">
            Monitor collection, sessionization, identity matching and order resolution.
          </p>
        </div>


        <button
          onClick={load}
          className="rounded-xl bg-slate-950 px-3 py-2 text-[10px] font-semibold text-white"
        >
          Refresh
        </button>

      </section>


      <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">

        <HealthCard
          label="Sessionization"
          value={
            pct(
              health?.sessionization_coverage_pct
            )
          }
          healthy={
            num(
              health?.sessionization_coverage_pct
            ) >= 95
          }
        />

        <HealthCard
          label="Cart Token Coverage"
          value={
            pct(
              health?.all_history_cart_token_coverage_pct
            )
          }
          healthy={
            num(
              health?.all_history_cart_token_coverage_pct
            ) >= 90
          }
        />

        <HealthCard
          label="Exact Match"
          value={
            pct(
              health?.exact_match_when_cart_available_pct
            )
          }
          healthy={
            num(
              health?.exact_match_when_cart_available_pct
            ) >= 80
          }
        />

        <HealthCard
          label="Session Resolution"
          value={
            pct(
              health?.canonical_session_resolution_pct
            )
          }
          healthy={
            num(
              health?.canonical_session_resolution_pct
            ) >= 90
          }
        />

      </section>


      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">

        <Panel title="Collection">

          <Row
            label="Raw Events"
            value={
              integer(
                health?.raw_events
              )
            }
          />

          <Row
            label="Raw Visitors"
            value={
              integer(
                health?.raw_visitors
              )
            }
          />

          <Row
            label="Marketing Touchpoints"
            value={
              integer(
                health?.marketing_touchpoints
              )
            }
          />

          <Row
            label="Latest Raw Event"
            value={
              formatDate(
                health?.latest_raw_event
              )
            }
          />

          <Row
            label="Latest Raw Ingestion"
            value={
              formatDate(
                health?.latest_raw_ingestion
              )
            }
          />

        </Panel>


        <Panel title="Sessionization">

          <Row
            label="Sessionized Events"
            value={
              integer(
                health?.sessionized_events
              )
            }
          />

          <Row
            label="Canonical Sessions"
            value={
              integer(
                health?.canonical_sessions
              )
            }
          />

          <Row
            label="Canonical Visitors"
            value={
              integer(
                health?.canonical_visitors
              )
            }
          />

          <Row
            label="Events Waiting"
            value={
              integer(
                health?.raw_events_not_sessionized
              )
            }
          />

          <Row
            label="Visitors Waiting"
            value={
              integer(
                health?.visitors_not_sessionized
              )
            }
          />

        </Panel>


        <Panel title="Order Matching">

          <Row
            label="Realtime Orders"
            value={
              integer(
                health?.realtime_orders
              )
            }
          />

          <Row
            label="Orders With Cart Token"
            value={
              integer(
                health?.orders_with_cart_token
              )
            }
          />

          <Row
            label="Exact Orders"
            value={
              integer(
                health?.exact_orders
              )
            }
          />

          <Row
            label="Ambiguous Orders"
            value={
              integer(
                health?.ambiguous_orders
              )
            }
          />

          <Row
            label="Unmatched Orders"
            value={
              integer(
                health?.unmatched_orders
              )
            }
          />

          <Row
            label="No Cart Token"
            value={
              integer(
                health?.no_cart_token_orders
              )
            }
          />

        </Panel>


        <Panel title="Freshness">

          <Row
            label="Health Checked"
            value={
              formatDate(
                health?.checked_at
              )
            }
          />

          <Row
            label="Latest Touchpoint"
            value={
              formatDate(
                health?.latest_touchpoint_event
              )
            }
          />

          <Row
            label="Latest Session"
            value={
              formatDate(
                health?.latest_session_end
              )
            }
          />

          <Row
            label="Latest Realtime Order"
            value={
              formatDate(
                health?.latest_realtime_order
              )
            }
          />

        </Panel>

      </section>

    </div>
  );
}


function HealthCard({
  label,
  value,
  healthy,
}: any) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">

      <div className="flex items-center gap-2">

        <span
          className={
            healthy
              ? 'h-2 w-2 rounded-full bg-emerald-500'
              : 'h-2 w-2 rounded-full bg-amber-500'
          }
        />

        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>

      </div>


      <p className="mt-3 text-[14px] font-semibold">
        {value}
      </p>


      <p
        className={
          healthy
            ? 'mt-2 text-[10px] font-bold text-emerald-600'
            : 'mt-2 text-[10px] font-bold text-amber-600'
        }
      >
        {healthy
          ? 'Healthy'
          : 'Review'}
      </p>

    </section>
  );
}


function Panel({
  title,
  children,
}: any) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">

      <h3 className="text-[11px] font-semibold">
        {title}
      </h3>

      <div className="mt-2.5">
        {children}
      </div>

    </section>
  );
}


function Row({
  label,
  value,
}: any) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">

      <span className="text-[10px] font-semibold text-slate-500">
        {label}
      </span>

      <strong className="text-[10px] text-slate-900">
        {value}
      </strong>

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

function pct(v: any) {
  return `${num(v).toFixed(1)}%`;
}

function formatDate(v: any) {
  if (!v)
    return '—';

  const date =
    new Date(v);

  if (
    Number.isNaN(
      date.getTime()
    )
  )
    return String(v);

  return new Intl.DateTimeFormat(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone:
        'Asia/Kolkata',
    }
  ).format(date);
}
