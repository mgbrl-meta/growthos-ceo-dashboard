'use client';

import { useEffect, useState } from 'react';

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

export default function MetaCreativeAnalysis({
  start,
  end,
  params,
  campaigns,
  selectedCampaign,
  setSelectedCampaign,
}: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [dailyRows, setDailyRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCampaign) return;

    async function load() {
      setLoading(true);

      try {
        const [summaryRes, dailyRes] = await Promise.all([
          fetch(
            `/api/meta-os?tab=creative&start=${start}&end=${end}&campaign=${encodeURIComponent(
              selectedCampaign
            )}`
          ),
          fetch(
            `/api/meta-os?tab=creative-daily-4pi&start=${start}&end=${end}&campaign=${encodeURIComponent(
              selectedCampaign
            )}`
          ),
        ]);

        const summaryJson = await summaryRes.json();
        const dailyJson = await dailyRes.json();

        setRows(Array.isArray(summaryJson) ? summaryJson : []);
        setDailyRows(Array.isArray(dailyJson) ? dailyJson : []);
      } catch (error) {
        console.error('Creative analysis error', error);
        setRows([]);
        setDailyRows([]);
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
        text="Select a campaign to analyse creatives."
      />
    );
  }

  if (loading) {
    return <LoadingCard text="Loading creative analysis..." />;
  }

  const baseline = rows[0] || {};

  const enriched = rows.map((creative) => ({
    ...creative,
    status: classifyCreative(creative, params),
  }));

  const scale = enriched.filter((c) => c.status === 'SCALE');
  const test = enriched.filter((c) => c.status === 'TEST');
  const kill = enriched.filter((c) => c.status === 'KILL');
  const ignore = enriched.filter((c) => c.status === 'IGNORE');

  const groupedDaily = dailyRows.reduce((acc: any, row: any) => {
    const key = row.ad_id || row.creative_name || 'unknown';

    if (!acc[key]) acc[key] = [];

    acc[key].push(row);

    return acc;
  }, {});

  const fourPiCreatives = Object.values(groupedDaily).map((creativeRows: any) =>
    buildCreative4PiSummary(creativeRows)
  );

  const tofCreatives = fourPiCreatives.filter(
    (c: any) => c.dominantStage === 'TOF'
  );

  const mofCreatives = fourPiCreatives.filter(
    (c: any) => c.dominantStage === 'MOF'
  );

  const bofCreatives = fourPiCreatives.filter(
    (c: any) => c.dominantStage === 'BOF'
  );

  return (
    <div className="space-y-6">
      <CampaignPicker
        campaigns={campaigns}
        value={selectedCampaign}
        onChange={setSelectedCampaign}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <DataTile
          label="Campaign ROAS"
          value={formatNumber(baseline.campaign_roas)}
        />
        <DataTile
          label="Campaign CPA"
          value={formatCurrency(baseline.campaign_cpa)}
        />
        <DataTile
          label="Campaign CTR"
          value={`${formatNumber(baseline.campaign_ctr)}%`}
        />
        <DataTile
          label="Campaign CPM"
          value={formatCurrency(baseline.campaign_cpm)}
        />
        <DataTile label="Creatives" value={formatNumber(rows.length, 0)} />
      </div>

      <Panel title="Section 1: Daily 4PI Funnel Analysis">
        <p className="mb-5 text-sm font-semibold leading-6 text-slate-600">
          This analysis uses daily creative behavior only. Frequency defines TOF,
          MOF, BOF. CPM and CPA are compared against campaign average.
        </p>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <FourPiFunnelBox
            title="TOF Creatives"
            subtitle="Frequency 1.00–1.15"
            items={tofCreatives}
          />
          <FourPiFunnelBox
            title="MOF Creatives"
            subtitle="Frequency 1.16–1.25"
            items={mofCreatives}
          />
          <FourPiFunnelBox
            title="BOF Creatives"
            subtitle="Frequency 1.26+"
            items={bofCreatives}
          />
        </div>
      </Panel>

      <Panel title="Section 2: Creative Decision Buckets">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <CreativeBucket
            title="🟢 Scale"
            subtitle="Meaningful spend + above campaign average"
            items={scale}
          />
          <CreativeBucket
            title="🟡 Test"
            subtitle="Low spend but promising signal"
            items={test}
          />
          <CreativeBucket
            title="🔴 Kill / Fix"
            subtitle="Meaningful spend + below campaign average"
            items={kill}
          />
          <CreativeBucket
            title="⚪ Ignore"
            subtitle="Low signal / no action yet"
            items={ignore}
          />
        </div>
      </Panel>

      <Panel title="Section 3: Creative Leaderboard">
        <div className="space-y-3">
          {enriched
            .sort((a, b) => Number(b.roas_index || 0) - Number(a.roas_index || 0))
            .map((creative, i) => (
              <DecisionRow
                key={i}
                title={creative.creative_name || 'Unnamed creative'}
                status={creative.status}
                subtitle={`ROAS Index ${formatNumber(
                  creative.roas_index
                )} · CTR Index ${formatNumber(creative.ctr_index)}`}
              >
                <MiniStat label="Spend" value={formatCurrency(creative.spend)} />
                <MiniStat
                  label="Revenue"
                  value={formatCurrency(creative.revenue)}
                />
                <MiniStat
                  label="ROAS"
                  value={`${formatNumber(creative.roas)} (${formatIndex(
                    creative.roas_index
                  )})`}
                />
                <MiniStat
                  label="CTR"
                  value={`${formatNumber(creative.ctr)}% (${formatIndex(
                    creative.ctr_index
                  )})`}
                />
                <MiniStat label="CPA" value={formatCurrency(creative.cpa)} />
                <MiniStat
                  label="Purchases"
                  value={formatNumber(creative.purchases, 0)}
                />
              </DecisionRow>
            ))}
        </div>
      </Panel>
    </div>
  );
}

function classifyCreative(c: any, params: MetaParams) {
  const spend = Number(c.spend || 0);
  const purchases = Number(c.purchases || 0);
  const roasIndex = Number(c.roas_index || 0);
  const ctrIndex = Number(c.ctr_index || 0);

  const highIndex = 1 + params.scalePct / 100;
  const lowIndex = 1 - params.killPct / 100;

  if (
    spend >= params.minSpend &&
    purchases >= params.minPurchases &&
    roasIndex >= highIndex
  ) {
    return 'SCALE';
  }

  if (spend < params.minSpend && (roasIndex >= highIndex || ctrIndex >= highIndex)) {
    return 'TEST';
  }

  if (spend >= params.minSpend && roasIndex <= lowIndex) {
    return 'KILL';
  }

  return 'IGNORE';
}

function getDailyFunnelStage(frequency: number) {
  if (frequency <= 1.15) return 'TOF';
  if (frequency <= 1.25) return 'MOF';
  return 'BOF';
}

function getIndexBucket(value: number, benchmark: number) {
  if (!benchmark) return 'Moderate';

  const index = Number(value || 0) / Number(benchmark || 0);

  if (index < 0.9) return 'Low';
  if (index > 1.1) return 'High';

  return 'Moderate';
}

function getDailyEfficiencyBucket(cpa: number, campaignCpa: number) {
  if (!cpa || !campaignCpa) return 'Unknown';

  const index = cpa / campaignCpa;

  if (index < 0.9) return 'Low CPA';
  if (index > 1.1) return 'High CPA';

  return 'Moderate CPA';
}

function getDaily4PiStrength(
  stage: string,
  spendBucket: string,
  cpmBucket: string,
  cpaBucket: string
) {
  if (stage === 'TOF') {
    if (
      spendBucket === 'High' &&
      cpmBucket === 'Low' &&
      cpaBucket === 'Low CPA'
    ) {
      return 'Strong';
    }

    if (cpmBucket === 'High' || cpaBucket === 'High CPA') {
      return 'Weak';
    }

    return 'Medium';
  }

  if (stage === 'MOF') {
    if (
      spendBucket !== 'Low' &&
      cpmBucket !== 'High' &&
      cpaBucket !== 'High CPA'
    ) {
      return 'Strong';
    }

    if (cpmBucket === 'High' && cpaBucket === 'High CPA') {
      return 'Weak';
    }

    return 'Medium';
  }

  if (stage === 'BOF') {
    if (cpaBucket === 'Low CPA') return 'Strong';

    if (cpaBucket === 'High CPA' && cpmBucket === 'High') {
      return 'Weak';
    }

    return 'Medium';
  }

  return 'Medium';
}

function buildCreative4PiSummary(rows: any[]) {
  const totalSpend = rows.reduce(
    (acc, row) => acc + Number(row.spend || 0),
    0
  );

  const avgCpm =
    rows.reduce((acc, row) => acc + Number(row.cpm || 0), 0) /
    Math.max(rows.length, 1);

  const avgCpa =
    rows.reduce((acc, row) => acc + Number(row.cpa || 0), 0) /
    Math.max(rows.length, 1);

  const avgDailySpend = totalSpend / Math.max(rows.length, 1);

  const daily = rows.map((row) => {
    const frequency = Number(row.frequency || 0);
    const spend = Number(row.spend || 0);
    const cpm = Number(row.cpm || 0);
    const campaignCpm = Number(row.campaign_cpm || 0);
    const cpa = Number(row.cpa || 0);
    const campaignCpa = Number(row.campaign_cpa || 0);

    const stage = getDailyFunnelStage(frequency);
    const spendBucket = getIndexBucket(spend, avgDailySpend);
    const cpmBucket = getIndexBucket(cpm, campaignCpm);
    const cpaBucket = getDailyEfficiencyBucket(cpa, campaignCpa);
    const strength = getDaily4PiStrength(
      stage,
      spendBucket,
      cpmBucket,
      cpaBucket
    );

    return {
      ...row,
      stage,
      spendBucket,
      cpmBucket,
      cpaBucket,
      strength,
    };
  });

  const count = (key: string, value: string) =>
    daily.filter((row) => row[key] === value).length;

  const tofDays = count('stage', 'TOF');
  const mofDays = count('stage', 'MOF');
  const bofDays = count('stage', 'BOF');

  let dominantStage = 'TOF';

  if (mofDays >= tofDays && mofDays >= bofDays) dominantStage = 'MOF';
  if (bofDays >= tofDays && bofDays >= mofDays) dominantStage = 'BOF';

  const stageRows = daily.filter((row) => row.stage === dominantStage);

  const strongDays = stageRows.filter((row) => row.strength === 'Strong').length;
  const mediumDays = stageRows.filter((row) => row.strength === 'Medium').length;
  const weakDays = stageRows.filter((row) => row.strength === 'Weak').length;

  let overallStrength = 'Medium';

  if (strongDays >= mediumDays && strongDays >= weakDays) {
    overallStrength = 'Strong';
  }

  if (weakDays >= strongDays && weakDays >= mediumDays) {
    overallStrength = 'Weak';
  }

  let recommendation = 'Watch';

  if (dominantStage === 'TOF' && overallStrength === 'Strong') {
    recommendation = 'Scale reach';
  }

  if (dominantStage === 'TOF' && overallStrength === 'Medium') {
    recommendation = 'Maintain reach';
  }

  if (dominantStage === 'TOF' && overallStrength === 'Weak') {
    recommendation = 'Fix hook / relevance';
  }

  if (dominantStage === 'MOF' && overallStrength === 'Strong') {
    recommendation = 'Scale carefully';
  }

  if (dominantStage === 'MOF' && overallStrength === 'Medium') {
    recommendation = 'Maintain';
  }

  if (dominantStage === 'MOF' && overallStrength === 'Weak') {
    recommendation = 'Improve messaging';
  }

  if (dominantStage === 'BOF' && overallStrength === 'Strong') {
    recommendation = 'Scale';
  }

  if (dominantStage === 'BOF' && overallStrength === 'Medium') {
    recommendation = 'Evaluate via CPA';
  }

  if (dominantStage === 'BOF' && overallStrength === 'Weak') {
    recommendation = 'Replace';
  }

  return {
    ad_id: rows[0]?.ad_id || '',
    creative_name: rows[0]?.creative_name || 'Unnamed creative',
    dominantStage,
    overallStrength,
    recommendation,
    tofDays,
    mofDays,
    bofDays,
    strongDays,
    mediumDays,
    weakDays,
    totalSpend,
    avgCpm,
    avgCpa,
    daily,
  };
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

function formatIndex(index: number) {
  const change = (Number(index || 0) - 1) * 100;

  return `${change >= 0 ? '+' : ''}${change.toFixed(0)}% vs avg`;
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

function DataTile({ label, value }: any) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-black tracking-tight">{value}</p>
    </div>
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

function CreativeBucket({ title, subtitle, items }: any) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
      <h3 className="font-black">{title}</h3>
      <p className="mb-4 text-sm text-slate-500">{subtitle}</p>

      {items.length === 0 && (
        <p className="text-sm text-slate-500">No creatives in this bucket.</p>
      )}

      <div className="space-y-3">
        {items.slice(0, 5).map((c: any, i: number) => (
          <div key={i} className="rounded-2xl border bg-slate-50 p-4">
            <p className="font-black">{c.creative_name}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Spend {formatCurrency(c.spend)} · ROAS {formatNumber(c.roas)} ·
              Index {formatNumber(c.roas_index)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FourPiFunnelBox({ title, subtitle, items }: any) {
  const strong = items.filter((x: any) => x.overallStrength === 'Strong');
  const medium = items.filter((x: any) => x.overallStrength === 'Medium');
  const weak = items.filter((x: any) => x.overallStrength === 'Weak');

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
      <div className="mb-5">
        <h3 className="text-lg font-black text-slate-950">{title}</h3>
        <p className="text-sm font-semibold text-slate-500">{subtitle}</p>
      </div>

      <FourPiStrengthGroup title="Strong" items={strong} />
      <FourPiStrengthGroup title="Medium" items={medium} />
      <FourPiStrengthGroup title="Weak" items={weak} />
    </div>
  );
}

function FourPiStrengthGroup({ title, items }: any) {
  const tone =
    title === 'Strong'
      ? 'border-emerald-200 bg-emerald-50'
      : title === 'Weak'
        ? 'border-red-200 bg-red-50'
        : 'border-amber-200 bg-amber-50';

  return (
    <div className={`mb-4 rounded-2xl border p-4 ${tone}`}>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-black text-slate-950">{title}</h4>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm font-semibold text-slate-500">No creatives</p>
      ) : (
        <div className="space-y-3">
          {items.map((creative: any, i: number) => (
            <div key={i} className="rounded-xl border border-white/70 bg-white p-3">
              <p className="font-black text-slate-950">
                {creative.creative_name}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                TOF {creative.tofDays}d · MOF {creative.mofDays}d · BOF{' '}
                {creative.bofDays}d
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Spend {formatCurrency(creative.totalSpend)} · Avg CPM{' '}
                {formatCurrency(creative.avgCpm)} · Avg CPA{' '}
                {formatCurrency(creative.avgCpa)}
              </p>
              <p className="mt-2 text-sm font-bold text-slate-700">
                {creative.recommendation}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}