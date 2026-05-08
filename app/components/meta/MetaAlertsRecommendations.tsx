'use client';

import { useEffect, useState } from 'react';

type MetaParams = {
  targetRoas: number;
  targetCpa: number;
  minSpend: number;
  minPurchases: number;
  maxCpa: number;
  minCtr: number;
  maxFrequency: number;
  cpmIncreasePct: number;
};

const formatCurrency = (value: number = 0) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatNumber = (value: number = 0, digits = 2) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits }).format(
    Number(value || 0)
  );

const safeDivide = (a: any, b: any) => {
  const numerator = Number(a || 0);
  const denominator = Number(b || 0);
  if (!denominator) return 0;
  return numerator / denominator;
};

const sum = (rows: any[], key: string) =>
  rows.reduce((acc, row) => acc + Number(row[key] || 0), 0);

export default function AlertRecommendations({
  start,
  end,
  compareStart,
  compareEnd,
  params,
}: {
  start: string;
  end: string;
  compareStart: string;
  compareEnd: string;
  params: MetaParams;
}) {
  const [overview, setOverview] = useState<any>(null);
  const [campaignRows, setCampaignRows] = useState<any[]>([]);
  const [creativeRows, setCreativeRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);

      try {
        const [overviewRes, campaignRes, creativeRes] = await Promise.all([
          fetch(
            `/api/meta-os?tab=overview&start=${start}&end=${end}&compareStart=${compareStart}&compareEnd=${compareEnd}`
          ),
          fetch(`/api/meta-os?tab=campaign&start=${start}&end=${end}`),
          fetch(`/api/meta-os?tab=creative-alerts&start=${start}&end=${end}`),
        ]);

        const overviewJson = await overviewRes.json();
        const campaignJson = await campaignRes.json();
        const creativeJson = await creativeRes.json();

        setOverview(overviewJson || null);
        setCampaignRows(Array.isArray(campaignJson) ? campaignJson : []);
        setCreativeRows(Array.isArray(creativeJson) ? creativeJson : []);
      } catch (error) {
        console.error('Alert recommendations error', error);
        setOverview(null);
        setCampaignRows([]);
        setCreativeRows([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [start, end, compareStart, compareEnd]);

  if (loading || !overview) {
    return <LoadingCard text="Loading recommendations..." />;
  }

  const current = overview.current || {};
  const roas = safeDivide(current.revenue, current.spend);
  const cpa = safeDivide(current.spend, current.purchases);
  const frequency = safeDivide(current.impressions, current.reach);

  const totalSpend = sum(campaignRows, 'spend');
  const topCampaign = [...campaignRows].sort(
    (a, b) => Number(b.spend || 0) - Number(a.spend || 0)
  )[0];
  const topShare = safeDivide(topCampaign?.spend, totalSpend) * 100;

  const benchmark = buildCreativeBenchmark(creativeRows);

  const enrichedCreatives = creativeRows
    .map((creative) => enrichCreativeAlert(creative, benchmark, params))
    .sort((a, b) => Number(b.priorityScore || 0) - Number(a.priorityScore || 0));

  const wasteCreatives = enrichedCreatives.filter((x) => x.wasteSignals.length > 0);
  const fatigueCreatives = enrichedCreatives.filter((x) => x.fatigueSignals.length > 0);
  const leakageCreatives = enrichedCreatives.filter((x) => x.leakageSignals.length > 0);

  const priorityCreatives = enrichedCreatives
    .filter((x) => x.priorityScore > 0)
    .slice(0, 10);

  const accountAlerts = [
    roas < params.targetRoas && {
      tone: 'red',
      title: 'ROAS below target',
      text: `Meta ROAS is ${formatNumber(roas)} vs target ${params.targetRoas}. Reduce waste before scaling.`,
    },
    cpa > params.maxCpa && {
      tone: 'red',
      title: 'CPA above hard limit',
      text: `CPA is ${formatCurrency(cpa)} vs max ${formatCurrency(params.maxCpa)}.`,
    },
    frequency > params.maxFrequency && {
      tone: 'amber',
      title: 'Account fatigue risk',
      text: `Frequency is ${formatNumber(frequency)} vs threshold ${params.maxFrequency}.`,
    },
    topShare > 50 && {
      tone: 'amber',
      title: 'Campaign dependency risk',
      text: `${topCampaign?.campaign_name} controls ${formatNumber(topShare)}% of spend.`,
    },
  ].filter(Boolean) as any[];

  const summary = buildSummary({
    roas,
    cpa,
    frequency,
    wasteCreatives,
    fatigueCreatives,
    leakageCreatives,
    priorityCreatives,
  });

  return (
    <div className="space-y-6">
      <Panel title="Operator Summary">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          <SummaryTile title="Waste Creatives" value={wasteCreatives.length} tone="red" text="High spend or poor conversion efficiency" />
          <SummaryTile title="Fatigue Creatives" value={fatigueCreatives.length} tone="amber" text="Rising frequency / CPM / CPA with falling CTR or ROAS" />
          <SummaryTile title="Funnel Leakage" value={leakageCreatives.length} tone="blue" text="Drop-off between click, LPV, ATC, checkout and purchase" />
          <SummaryTile title="Priority Actions" value={priorityCreatives.length} tone="slate" text="Creatives requiring direct operator review" />
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h4 className="font-black text-slate-950">Recommendation Summary</h4>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{summary}</p>
        </div>
      </Panel>

      <Panel title="Account-Level Alerts">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {accountAlerts.length === 0 ? (
            <AlertBox tone="green" title="Account stable" text="No major account-level alert found for the selected period." />
          ) : (
            accountAlerts.map((alert, i) => (
              <AlertBox key={i} tone={alert.tone} title={alert.title} text={alert.text} />
            ))
          )}
        </div>
      </Panel>

      <Panel title="Priority Creative Recommendations">
        <div className="space-y-4">
          {priorityCreatives.length === 0 ? (
            <p className="text-sm font-semibold text-slate-500">
              No high-priority creative issues found.
            </p>
          ) : (
            priorityCreatives.map((creative, i) => (
              <CreativeAlertCard key={i} creative={creative} />
            ))
          )}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <AlertCreativeBucket title="Waste Spend Analysis" tone="red" items={wasteCreatives} signalKey="wasteSignals" />
        <AlertCreativeBucket title="Fatigue Analysis" tone="amber" items={fatigueCreatives} signalKey="fatigueSignals" />
        <AlertCreativeBucket title="Funnel Leakage Analysis" tone="blue" items={leakageCreatives} signalKey="leakageSignals" />
      </div>
    </div>
  );
}

function buildCreativeBenchmark(rows: any[]) {
  const spend = sum(rows, 'spend');
  const impressions = sum(rows, 'impressions');
  const clicks = sum(rows, 'clicks');
  const lpv = sum(rows, 'lpv');
  const atc = sum(rows, 'atc');
  const checkout = sum(rows, 'checkout');
  const purchases = sum(rows, 'purchases');
  const revenue = sum(rows, 'revenue');
  const reach = sum(rows, 'reach');

  return {
    avgSpend: safeDivide(spend, Math.max(rows.length, 1)),
    cpm: safeDivide(spend, impressions) * 1000,
    cpc: safeDivide(spend, clicks),
    ctr: safeDivide(clicks, impressions) * 100,
    cpa: safeDivide(spend, purchases),
    roas: safeDivide(revenue, spend),
    frequency: safeDivide(impressions, reach),
    clickToLpv: safeDivide(lpv, clicks) * 100,
    lpvToAtc: safeDivide(atc, lpv) * 100,
    atcToCheckout: safeDivide(checkout, atc) * 100,
    checkoutToPurchase: safeDivide(purchases, checkout) * 100,
    atcToPurchase: safeDivide(purchases, atc) * 100,
  };
}

function enrichCreativeAlert(row: any, benchmark: any, params: MetaParams) {
  const spend = Number(row.spend || 0);
  const impressions = Number(row.impressions || 0);
  const clicks = Number(row.clicks || 0);
  const lpv = Number(row.lpv || 0);
  const atc = Number(row.atc || 0);
  const checkout = Number(row.checkout || 0);
  const purchases = Number(row.purchases || 0);
  const revenue = Number(row.revenue || 0);
  const reach = Number(row.reach || 0);

  const ctr = Number(row.ctr || safeDivide(clicks, impressions) * 100);
  const cpm = Number(row.cpm || safeDivide(spend, impressions) * 1000);
  const cpc = Number(row.cpc || safeDivide(spend, clicks));
  const cpa = Number(row.cpa || safeDivide(spend, purchases));
  const roas = Number(row.roas || safeDivide(revenue, spend));
  const frequency = Number(row.frequency || safeDivide(impressions, reach));

  const clickToLpv = safeDivide(lpv, clicks) * 100;
  const lpvToAtc = safeDivide(atc, lpv) * 100;
  const atcToCheckout = safeDivide(checkout, atc) * 100;
  const checkoutToPurchase = safeDivide(purchases, checkout) * 100;
  const atcToPurchase = safeDivide(purchases, atc) * 100;

  const wasteSignals: string[] = [];
  const fatigueSignals: string[] = [];
  const leakageSignals: string[] = [];

  if (spend >= Math.max(params.minSpend, benchmark.avgSpend * 1.2) && purchases < params.minPurchases) {
    wasteSignals.push('High spend with no/low purchases');
  }

  if (cpc > benchmark.cpc * 1.25 && clickToLpv < benchmark.clickToLpv * 0.8) {
    wasteSignals.push('High CPC with weak LPV rate');
  }

  if (atc >= 5 && atcToPurchase < benchmark.atcToPurchase * 0.7) {
    wasteSignals.push('High ATC but low purchase conversion');
  }

  if (frequency > Math.max(params.maxFrequency, benchmark.frequency * 1.2)) {
    fatigueSignals.push('Frequency above threshold');
  }

  if (ctr < Math.max(params.minCtr, benchmark.ctr * 0.8)) {
    fatigueSignals.push('CTR below benchmark');
  }

  if (cpm > benchmark.cpm * 1.2) {
    fatigueSignals.push('CPM above benchmark');
  }

  if (roas < benchmark.roas * 0.8) {
    fatigueSignals.push('ROAS below benchmark');
  }

  if (cpa > benchmark.cpa * 1.2) {
    fatigueSignals.push('CPA above benchmark');
  }

  if (frequency > benchmark.frequency * 1.15 && ctr < benchmark.ctr * 0.85 && (cpa > benchmark.cpa * 1.15 || roas < benchmark.roas * 0.85)) {
    fatigueSignals.push('Frequency ↑ + CTR ↓ + CPA ↑ / ROAS ↓');
  }

  if (ctr < benchmark.ctr * 0.8) leakageSignals.push('Creative problem: Impression → Click weak');
  if (clickToLpv < benchmark.clickToLpv * 0.8) leakageSignals.push('Landing page problem: Click → LPV weak');
  if (lpvToAtc < benchmark.lpvToAtc * 0.8) leakageSignals.push('Offer problem: LPV → ATC weak');
  if (atcToCheckout < benchmark.atcToCheckout * 0.8) leakageSignals.push('Cart problem: ATC → Checkout weak');
  if (checkoutToPurchase < benchmark.checkoutToPurchase * 0.8) leakageSignals.push('Checkout problem: Checkout → Purchase weak');

  const priorityScore = wasteSignals.length * 3 + fatigueSignals.length * 2 + leakageSignals.length;

  let recommendation = 'Monitor';
  if (wasteSignals.length >= 2) recommendation = 'Cut or fix before spending more';
  else if (fatigueSignals.length >= 3) recommendation = 'Refresh creative / rotate angle';
  else if (leakageSignals.some((x) => x.includes('Creative problem'))) recommendation = 'Fix hook or first-frame relevance';
  else if (leakageSignals.some((x) => x.includes('Landing page'))) recommendation = 'Check page speed and message match';
  else if (leakageSignals.some((x) => x.includes('Checkout'))) recommendation = 'Audit checkout friction';

  return {
    ...row,
    spend,
    cpm,
    ctr,
    cpc,
    cpa,
    roas,
    frequency,
    wasteSignals,
    fatigueSignals,
    leakageSignals,
    priorityScore,
    recommendation,
  };
}

function buildSummary({ roas, cpa, frequency, wasteCreatives, fatigueCreatives, leakageCreatives, priorityCreatives }: any) {
  if (priorityCreatives.length === 0) {
    return `No major creative-level alert is visible in the selected period. Account ROAS is ${formatNumber(roas)}, CPA is ${formatCurrency(cpa)}, and frequency is ${formatNumber(frequency)}.`;
  }

  if (wasteCreatives.length >= fatigueCreatives.length && wasteCreatives.length >= leakageCreatives.length) {
    return `${wasteCreatives.length} creatives are showing waste-spend risk. First action: reduce spend on high-spend creatives with weak purchases.`;
  }

  if (fatigueCreatives.length >= wasteCreatives.length && fatigueCreatives.length >= leakageCreatives.length) {
    return `${fatigueCreatives.length} creatives are showing fatigue risk. First action: refresh hooks/angles where frequency is rising while CTR or ROAS is falling.`;
  }

  return `${leakageCreatives.length} creatives are showing funnel leakage. First action: identify whether the leak is creative, landing page, offer, cart, or checkout.`;
}

function Panel({ title, children }: any) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
      <h3 className="mb-4 text-lg font-black tracking-tight">{title}</h3>
      {children}
    </section>
  );
}

function LoadingCard({ text }: any) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 font-bold text-slate-500 shadow-xl shadow-slate-200/60">
      {text}
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

function AlertBox({ tone, title, text }: any) {
  const cls =
    tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-900'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-emerald-200 bg-emerald-50 text-emerald-900';

  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <h4 className="font-black">{title}</h4>
      <p className="mt-1 text-sm opacity-80">{text}</p>
    </div>
  );
}

function SummaryTile({ title, value, tone, text }: any) {
  const cls =
    tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-900'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : tone === 'blue'
          ? 'border-blue-200 bg-blue-50 text-blue-900'
          : 'border-slate-200 bg-slate-50 text-slate-900';

  return (
    <div className={`rounded-[2rem] border p-5 shadow-xl shadow-slate-200/50 ${cls}`}>
      <p className="text-xs font-black uppercase tracking-[0.16em] opacity-70">{title}</p>
      <p className="mt-2 text-4xl font-black tracking-tight">{value}</p>
      <p className="mt-2 text-sm font-bold opacity-80">{text}</p>
    </div>
  );
}

function CreativeAlertCard({ creative }: any) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-lg shadow-slate-200/60">
      <h4 className="text-lg font-black text-slate-950">
        {creative.creative_name || creative.ad_name || 'Unnamed creative'}
      </h4>
      <p className="mt-2 text-sm font-semibold text-slate-600">{creative.recommendation}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <MiniStat label="Spend" value={formatCurrency(creative.spend)} />
        <MiniStat label="Avg CPM" value={formatCurrency(creative.cpm)} />
        <MiniStat label="Avg CTR" value={`${formatNumber(creative.ctr)}%`} />
        <MiniStat label="Avg CPA" value={formatCurrency(creative.cpa)} />
        <MiniStat label="Avg Freq" value={formatNumber(creative.frequency)} />
      </div>
    </div>
  );
}

function AlertCreativeBucket({ title, tone, items, signalKey }: any) {
  const cls =
    tone === 'red'
      ? 'border-red-200 bg-red-50'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50'
        : 'border-blue-200 bg-blue-50';

  return (
    <section className={`rounded-[2rem] border p-5 shadow-xl shadow-slate-200/50 ${cls}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-black text-slate-950">{title}</h3>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm font-semibold text-slate-500">No creatives in this bucket.</p>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 8).map((creative: any, i: number) => (
            <div key={i} className="rounded-2xl border border-white/70 bg-white p-4">
              <p className="font-black text-slate-950">
                {creative.creative_name || creative.ad_name || 'Unnamed creative'}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Spend {formatCurrency(creative.spend)} · CPM {formatCurrency(creative.cpm)} · CTR {formatNumber(creative.ctr)}% · CPA {formatCurrency(creative.cpa)} · Freq {formatNumber(creative.frequency)}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm font-semibold text-slate-700">
                {(creative[signalKey] || []).slice(0, 3).map((signal: string, j: number) => (
                  <li key={j}>{signal}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}