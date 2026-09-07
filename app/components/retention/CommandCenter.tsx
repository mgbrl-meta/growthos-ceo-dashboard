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
        const res = await fetch('/api/retention-os/mission-control', {
          cache: 'no-store',
        });

        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error('Mission control fetch error', error);
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    loadMissionControl();
  }, []);

  const top = data?.topOpportunity;

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-600">
          Mission Control
        </p>

        <h2 className="mt-2 text-[15px] font-semibold tracking-[-0.04em] text-slate-950">
          Retention Decision Engine
        </h2>

        <p className="mt-2 max-w-3xl text-[11px] text-slate-500">
          Powered by NBA v6: journey action + product action + expected business value.
        </p>

        {loading && (
          <p className="mt-3 text-[10px] font-bold text-blue-600">
            Loading mission control...
          </p>
        )}

        <div className="mt-3 grid gap-2.5 md:grid-cols-5">
          <Card label="Actions" title={`${data?.totalOpportunities || 0}`} note="NBA rows loaded" />
          <Card label="Revenue" title={money(data?.totalPotentialRevenue || 0)} note="Journey + product revenue" />
          <Card label="Profit" title={money(data?.totalPotentialProfit || 0)} note="Journey + product profit" />
          <Card label="EBV" title={money(data?.forecastedProfit || 0)} note="Expected business value" />
          <Card
            label="Top Action"
            title={top?.action_coverage || 'No action'}
            note={top?.recommended_product || top?.journey_opportunity_type || 'Waiting for data'}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          Highest Value Decision
        </p>

        <h3 className="mt-2 text-[14px] font-semibold text-slate-950">
          {top
            ? `${top.journey_opportunity_type || 'Journey'} + ${top.product_opportunity_type || 'No Product'}`
            : 'No opportunity detected yet'}
        </h3>

        <p className="mt-3 text-[11px] text-slate-500">
          {top?.recommended_product || top?.strategic_segment || 'No recommendation available yet.'}
        </p>

        {top && (
          <div className="mt-3 grid gap-2.5 md:grid-cols-4">
            <Mini label="Journey State" value={top.journey_state || '-'} />
            <Mini label="Strategic Segment" value={top.strategic_segment || '-'} />
            <Mini label="Product" value={top.recommended_product || '-'} />
            <Mini label="EBV" value={money(top.combined_ebv || 0)} />
          </div>
        )}
      </section>
    </div>
  );
}

function Card({ label, title, note }: { label: string; title: string; note: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <h3 className="mt-3 text-[15px] font-semibold tracking-[-0.03em] text-slate-950">
        {title}
      </h3>
      <p className="mt-2 text-[10px] leading-5 text-slate-500">{note}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-[14px] font-semibold text-slate-950">{value}</p>
    </div>
  );
}
