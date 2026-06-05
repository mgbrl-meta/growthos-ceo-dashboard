'use client';

import { useEffect, useState } from 'react';

const money = (value: number) =>
  `INR ${Math.round(value || 0).toLocaleString('en-IN')}`;

export default function CommandCenter() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadMissionControl() {
      setLoading(true);

      try {
        const res = await fetch('/api/retention-os/mission-control');
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error('Mission control fetch error', error);
      } finally {
        setLoading(false);
      }
    }

    loadMissionControl();
  }, []);

  const top = data?.topOpportunity;

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">
          Mission Control
        </p>

        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
          Customer Value Expansion Engine
        </h2>

        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Live retention opportunities, expected profit and top recommended action.
        </p>

        {loading && (
          <p className="mt-3 text-xs font-bold text-blue-600">
            Loading live mission control...
          </p>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-5">
          <Card
            label="Total Opportunities"
            title={`${data?.totalOpportunities || 0}`}
            note="Live opportunity groups detected"
          />

          <Card
            label="Potential Revenue"
            title={money(data?.totalPotentialRevenue || 0)}
            note="Raw estimated revenue opportunity"
          />

          <Card
            label="Potential Profit"
            title={money(data?.totalPotentialProfit || 0)}
            note="Raw estimated contribution opportunity"
          />

          <Card
            label="Forecasted Profit"
            title={money(data?.forecastedProfit || 0)}
            note="Confidence-weighted profit forecast"
          />

          <Card
            label="Top Action"
            title={top?.recommended_action || 'No action yet'}
            note={top?.opportunity_group || 'Waiting for mapped product data'}
          />
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Highest Priority Opportunity
        </p>

        <h3 className="mt-2 text-2xl font-black text-slate-950">
          {top
            ? `${top.opportunity_type?.replaceAll('_', ' ')} - ${top.opportunity_group}`
            : 'No opportunity detected yet'}
        </h3>

        <p className="mt-3 text-sm text-slate-500">
          {top?.reason || 'Map products and complete backfill to activate live opportunity detection.'}
        </p>

        {top && (
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <Mini label="Customers" value={String(top.customers || 0)} />
            <Mini label="Estimated Revenue" value={money(top.estimated_revenue || 0)} />
            <Mini label="Estimated Profit" value={money(top.estimated_profit || 0)} />
            <Mini label="Confidence" value={`${top.confidence || 0}%`} />
          </div>
        )}
      </section>
    </div>
  );
}

function Card({
  label,
  title,
  note,
}: {
  label: string;
  title: string;
  note: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>

      <h3 className="mt-3 text-xl font-black tracking-[-0.03em] text-slate-950">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}