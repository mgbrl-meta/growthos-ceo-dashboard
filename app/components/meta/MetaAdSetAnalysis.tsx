'use client';

import { useEffect, useState } from 'react';

type Row = any;

type MetaParams = {
  targetRoas: number;
  targetCpa: number;
  scalePct: number;
  killPct: number;
  minSpend: number;
  minPurchases: number;
  maxCpa: number;
  minRoas: number;
  minCtr: number;
  maxFrequency: number;
  cpmIncreasePct: number;
};

export default function MetaAdSetAnalysis({
  start,
  end,
  params,
  campaigns,
  selectedCampaign,
  setSelectedCampaign,
}: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCampaign) return;

    async function load() {
      setLoading(true);

      try {
        const res = await fetch(
          `/api/meta-os?tab=adset&start=${start}&end=${end}&campaign=${encodeURIComponent(
            selectedCampaign
          )}`
        );

        const json = await res.json();
        setRows(Array.isArray(json) ? json : []);
      } catch (error) {
        console.error('Ad set analysis error', error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [start, end, selectedCampaign]);

  if (!selectedCampaign) {
    return (
      <EmptyState
        title="No campaign selected"
        text="Select a campaign to analyse ad sets."
      />
    );
  }

  if (loading) {
    return <LoadingCard text="Loading ad sets..." />;
  }

  const parentBenchmark = {
    spend: Number(rows[0]?.campaign_spend || 0),
    revenue: Number(rows[0]?.campaign_revenue || 0),
    purchases: Number(rows[0]?.campaign_purchases || 0),
    roas: safeDivide(rows[0]?.campaign_revenue, rows[0]?.campaign_spend),
    cpa: safeDivide(rows[0]?.campaign_spend, rows[0]?.campaign_purchases),
    avgSpend: safeDivide(rows[0]?.campaign_spend, Math.max(rows.length, 1)),
  };

  const fallbackBenchmark = buildBenchmark(rows);
  const benchmark = parentBenchmark.spend ? parentBenchmark : fallbackBenchmark;

  const enriched = rows
    .map((adset) => {
      const decisionData = getDecisionBucket(adset, benchmark, params);

      return {
        ...adset,
        decision: decisionData.decision,
        reason: decisionData.reason,
      };
    })
    .sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0));

  const scale = enriched.filter((x) => x.decision === 'SCALE');
  const test = enriched.filter((x) => x.decision === 'TEST');
  const kill = enriched.filter((x) => x.decision === 'KILL');
  const ignore = enriched.filter((x) => x.decision === 'IGNORE');

  return (
    <div className="space-y-6">
      <CampaignPicker
        campaigns={campaigns}
        value={selectedCampaign}
        onChange={setSelectedCampaign}
      />

      <Panel title="Ad Set Decision Buckets">
        <p className="mb-5 text-sm font-semibold text-slate-600">
          Ad sets are benchmarked against their parent campaign performance for
          the selected date range.
        </p>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
          <DecisionBucket title="🟢 Scale" items={scale} />
          <DecisionBucket title="🟡 Test" items={test} />
          <DecisionBucket title="🔴 Kill / Fix" items={kill} />
          <DecisionBucket title="⚪ Ignore" items={ignore} />
        </div>
      </Panel>

      <Panel title="Ad Set Leaderboard">
        <div className="space-y-3">
          {enriched.map((adset, i) => (
            <DecisionRow
              key={i}
              title={adset.adset_name || 'Unnamed ad set'}
              status={adset.decision}
              subtitle={`Spend share ${formatNumber(adset.spend_share)}% · ${
                adset.reason
              }`}
            >
              <MiniStat label="Spend" value={formatCurrency(adset.spend)} />
              <MiniStat
                label="Revenue"
                value={formatCurrency(adset.revenue)}
              />
              <MiniStat label="ROAS" value={formatNumber(adset.roas)} />
              <MiniStat label="CPA" value={formatCurrency(adset.cpa)} />
              <MiniStat
                label="Purchases"
                value={formatNumber(adset.purchases, 0)}
              />
              <MiniStat
                label="Freq"
                value={formatNumber(adset.frequency)}
              />
            </DecisionRow>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function buildBenchmark(rows: any[]) {
  const spend = sum(rows, 'spend');
  const revenue = sum(rows, 'revenue');
  const purchases = sum(rows, 'purchases');
  const impressions = sum(rows, 'impressions');
  const clicks = sum(rows, 'clicks');
  const reach = sum(rows, 'reach');

  return {
    spend,
    revenue,
    purchases,
    impressions,
    clicks,
    reach,
    roas: safeDivide(revenue, spend),
    cpa: safeDivide(spend, purchases),
    ctr: safeDivide(clicks, impressions) * 100,
    frequency: safeDivide(impressions, reach),
    avgSpend: safeDivide(spend, Math.max(rows.length, 1)),
  };
}

function getDecisionBucket(row: any, benchmark: any, params: MetaParams) {
  const spend = Number(row.spend || 0);
  const roas = Number(row.roas || 0);
  const cpa = Number(row.cpa || 0);
  const purchases = Number(row.purchases || 0);

  const hasEnoughData =
    spend >= params.minSpend && purchases >= params.minPurchases;

  const roasIndex = safeDivide(roas, benchmark.roas);
  const cpaIndex = safeDivide(cpa, benchmark.cpa);
  const spendIndex = safeDivide(spend, benchmark.avgSpend || benchmark.spend);

  if (!hasEnoughData) {
    if (roasIndex >= 1.1 || cpaIndex <= 0.9) {
      return {
        decision: 'TEST',
        reason: 'Low data, but early efficiency is better than benchmark',
      };
    }

    return {
      decision: 'IGNORE',
      reason: 'Low signal / not enough spend or purchases yet',
    };
  }

  if (roasIndex >= 1.1 && cpaIndex <= 0.9) {
    return {
      decision: 'SCALE',
      reason: 'ROAS better than benchmark and CPA lower than benchmark',
    };
  }

  if (roasIndex <= 0.85 && cpaIndex >= 1.15) {
    return {
      decision: 'KILL',
      reason: 'ROAS below benchmark and CPA above benchmark',
    };
  }

  if (spendIndex < 0.7 && (roasIndex >= 1 || cpaIndex <= 1)) {
    return {
      decision: 'TEST',
      reason: 'Under-spent but performance is near or better than benchmark',
    };
  }

  return {
    decision: 'IGNORE',
    reason: 'Average performance; no clear scale or kill signal',
  };
}

function sum(rows: Row[], key: string) {
  return rows.reduce((acc, row) => acc + Number(row[key] || 0), 0);
}

function safeDivide(a: any, b: any) {
  const numerator = Number(a || 0);
  const denominator = Number(b || 0);

  if (!denominator) return 0;

  return numerator / denominator;
}

function formatCurrency(value: number = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatNumber(value: number = 0, digits = 2) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

function EmptyState({ title, text }: any) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/80 p-10 shadow-xl shadow-slate-200/70">
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-2 text-slate-500">{text}</p>
    </div>
  );
}

function LoadingCard({ text }: any) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 font-bold text-slate-500 shadow-xl shadow-slate-200/60">
      {text}
    </div>
  );
}

function Panel({ title, children }: any) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
      <h3 className="mb-4 text-lg font-black tracking-tight">{title}</h3>
      {children}
    </section>
  );
}

function CampaignPicker({ campaigns, value, onChange }: any) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
      <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
        Campaign
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border bg-slate-50 px-4 py-3 font-bold outline-none"
      >
        {campaigns.map((campaign: string) => (
          <option key={campaign} value={campaign}>
            {campaign}
          </option>
        ))}
      </select>
    </div>
  );
}

function MiniStat({ label, value }: any) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}

function DecisionRow({ title, subtitle, status, children }: any) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-lg shadow-slate-200/60">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h4 className="font-black">{title}</h4>
          <p className="text-sm font-semibold text-slate-500">{subtitle}</p>
        </div>

        <StatusBadge status={status} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {children}
      </div>
    </div>
  );
}

function StatusBadge({ status }: any) {
  const cls =
    status === 'SCALE'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'KILL'
        ? 'bg-red-100 text-red-700'
        : status === 'TEST'
          ? 'bg-blue-100 text-blue-700'
          : 'bg-slate-200 text-slate-600';

  return (
    <span
      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-black ${cls}`}
    >
      {status}
    </span>
  );
}

function DecisionBucket({ title, items }: any) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-black">{title}</h3>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm font-semibold text-slate-500">No items</p>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 8).map((item: any, i: number) => (
            <div key={i} className="rounded-2xl border bg-white p-4">
              <p className="font-black">
                {item.campaign_name || item.adset_name || 'Unnamed'}
              </p>

              <p className="mt-1 text-xs font-semibold text-slate-500">
                Spend {formatCurrency(item.spend)} · ROAS{' '}
                {formatNumber(item.roas)} · CPA {formatCurrency(item.cpa)}
              </p>

              <p className="mt-2 text-sm font-bold text-slate-700">
                {item.reason}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}