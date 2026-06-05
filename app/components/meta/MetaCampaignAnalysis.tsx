'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

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

export default function MetaCampaignAnalysis({ start, end, params }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [weeklyRows, setWeeklyRows] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [dailyChartRows, setDailyChartRows] = useState<any[]>([]);
  const [selectedChartMetric, setSelectedChartMetric] = useState("spend");
  const [selectedChartCampaign, setSelectedChartCampaign] = useState("");

  useEffect(() => {
  async function load() {
    setLoading(true);

    try {
      // CAMPAIGN LIST
      const res = await fetch(
        `/api/meta-os?tab=campaign&start=${start}&end=${end}`
      );

      const json = await res.json();

      const campaignRows = Array.isArray(json) ? json : [];

      setRows(campaignRows);

      // AUTO SELECT FIRST CAMPAIGN
      const activeCampaign =
        selectedCampaign ||
        campaignRows?.[0]?.campaign_name ||
        '';

      if (!selectedCampaign && activeCampaign) {
        setSelectedCampaign(activeCampaign);
      }

      // WEEKLY DATA
      const weeklyRes = await fetch(
        `/api/meta-os?tab=campaign-weekly&start=${start}&end=${end}&campaign=${encodeURIComponent(activeCampaign)}`
      );

      const weeklyJson = await weeklyRes.json();

      setWeeklyRows(Array.isArray(weeklyJson) ? weeklyJson : []);
    } catch (error) {
      console.error('Campaign analysis error', error);
      setRows([]);
      setWeeklyRows([]);
    } finally {
      setLoading(false);
    }
  }

  load();
}, [start, end, selectedCampaign]);

  useEffect(() => {
    if (!selectedChartCampaign) return;

    async function loadDailyChart() {
      const res = await fetch(
        `/api/meta-os?tab=campaign-daily-chart&start=${start}&end=${end}&campaign=${encodeURIComponent(selectedChartCampaign)}`
      );

      const json = await res.json();

      setDailyChartRows(Array.isArray(json) ? json : []);
    }

    loadDailyChart();
  }, [selectedChartCampaign, start, end]);

  if (loading) {
    return <LoadingCard text="Loading campaigns..." />;
  }

  const accountBenchmark = buildBenchmark(rows);

  const enriched = rows
    .map((campaign) => {
      const decisionData = getDecisionBucket(
        campaign,
        accountBenchmark,
        params
      );

      return {
        ...campaign,
        decision: decisionData.decision,
        reason: decisionData.reason,
        spendShare:
          safeDivide(campaign.spend, accountBenchmark.spend) * 100,
      };
    })
    .sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0));

  const scale = enriched.filter((x) => x.decision === 'SCALE');
  const test = enriched.filter((x) => x.decision === 'TEST');
  const kill = enriched.filter((x) => x.decision === 'KILL');
  const ignore = enriched.filter((x) => x.decision === 'IGNORE');

  const campaignOptions = [
    ...new Set(weeklyRows.map((x) => x.campaign_name).filter(Boolean)),
  ];

  const filteredWeekly = selectedCampaign
    ? weeklyRows.filter((x) => x.campaign_name === selectedCampaign)
    : [];

  const months = [...new Set(filteredWeekly.map((x) => x.month))];

  const getMetric = (
    month: string,
    week: string,
    metric: string
  ) => {
    const row = filteredWeekly.find(
      (x) => x.month === month && x.week === week
    );

    return Number(row?.[metric] || 0);
  };

  const chartMetrics = [
    { key: "cpm", label: "CPM" },
    { key: "ctr", label: "CTR" },
    { key: "cpa", label: "CPA" },
    { key: "spend", label: "Spend" },
    { key: "revenue", label: "Purchase Value" },
  ];

  const dailyChartData = dailyChartRows.map((x) => ({
    date: x.date?.value || x.date,
    cpm: Number(x.cpm || 0),
    ctr: Number(x.ctr || 0),
    cpa: Number(x.cpa || 0),
    spend: Number(x.spend || 0),
    revenue: Number(x.revenue || 0),
  }));

  return (
    <div className="space-y-6">
      <Panel title="Campaign Decision Buckets">
        <p className="mb-5 text-sm font-semibold text-slate-600">
          Campaigns are benchmarked against overall Meta account performance
          for the selected date range.
        </p>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
          <DecisionBucket title="🟢 Scale" items={scale} />
          <DecisionBucket title="🟡 Test" items={test} />
          <DecisionBucket title="🔴 Kill / Fix" items={kill} />
          <DecisionBucket title="⚪ Ignore" items={ignore} />
        </div>
      </Panel>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <ConcentrationCard
          title="Top Campaign Share"
          value={`${formatNumber(enriched[0]?.spendShare || 0)}%`}
          danger={(enriched[0]?.spendShare || 0) > 50}
        />

        <ConcentrationCard
          title="Top 3 Campaign Share"
          value={`${formatNumber(
            enriched
              .slice(0, 3)
              .reduce(
                (acc, row) => acc + Number(row.spendShare || 0),
                0
              )
          )}%`}
          danger={
            enriched
              .slice(0, 3)
              .reduce(
                (acc, row) => acc + Number(row.spendShare || 0),
                0
              ) > 80
          }
        />

        <ConcentrationCard
          title="Campaigns Evaluated"
          value={formatNumber(enriched.length, 0)}
          danger={false}
        />
      </section>

      <Panel title="Weekly Campaign Breakdown">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">
                Weekly Campaign Breakdown
              </h3>
              <p className="text-xs text-slate-500">
                Month-wise W1/W2/W3/W4 performance by selected campaign
              </p>
            </div>

            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="w-80 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm"
            >
              <option value="">Select Campaign</option>
              {campaignOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {!selectedCampaign ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Select a campaign to view weekly Spend, CPA, AOV and ROAS.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-left font-black text-slate-700">
                      Metric
                    </th>

                    {months.map((month) => (
                      <th
                        key={month}
                        colSpan={4}
                        className="border-b border-r border-slate-200 px-4 py-3 text-center font-black text-slate-900"
                      >
                        {month}
                      </th>
                    ))}
                  </tr>

                  <tr className="bg-white">
                    <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-3"></th>

                    {months.map((month) =>
                      ['W1', 'W2', 'W3', 'W4'].map((week) => (
                        <th
                          key={`${month}-${week}`}
                          className="border-b border-r border-slate-200 px-4 py-3 text-center font-bold text-slate-600"
                        >
                          {week}
                        </th>
                      ))
                    )}
                  </tr>
                </thead>

                <tbody>
                  {[
                    { key: 'spend', label: 'Spend', type: 'currency' },
                    { key: 'cpa', label: 'CPA', type: 'currency' },
                    { key: 'aov', label: 'AOV', type: 'currency' },
                    { key: 'roas', label: 'ROAS', type: 'number' },
                  ].map((metric) => (
                    <tr key={metric.key} className="hover:bg-slate-50">
                      <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 font-black text-slate-800">
                        {metric.label}
                      </td>

                      {months.map((month) =>
                        ['W1', 'W2', 'W3', 'W4'].map((week) => {
                          const value = getMetric(month, week, metric.key);

                          return (
                            <td
                              key={`${month}-${week}-${metric.key}`}
                              className="border-r border-t border-slate-100 px-4 py-3 text-center font-semibold text-slate-700"
                            >
                              {metric.type === 'currency'
                                ? formatCurrency(value)
                                : value.toFixed(2)}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>

      <div className="mt-8">
        <Panel title="Campaign Daily Trend">
          <div className="space-y-5">

            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Campaign Daily Trend
                </h3>

                <p className="text-xs text-slate-500">
                  Daily performance trend by campaign
                </p>
              </div>

              <div className="flex items-center gap-3">

                <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700">
                  Daily
                </div>

                <select
                  value={selectedChartCampaign}
                  onChange={(e) =>
                    setSelectedChartCampaign(e.target.value)
                  }
                  className="w-80 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm shadow-sm"
                >
                  <option value="">Select Campaign</option>

                  {campaignOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!selectedChartCampaign ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
                Select a campaign to view trend chart
              </div>
            ) : (
              <>
                <div className="h-80 rounded-2xl border border-slate-200 bg-white p-5">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />

                      <XAxis dataKey="date" />

                      <YAxis />

                      <Tooltip />

                      <Line
                        type="monotone"
                        dataKey={selectedChartMetric}
                        strokeWidth={3}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex flex-wrap gap-2">
                  {chartMetrics.map((metric) => (
                    <button
                      key={metric.key}
                      onClick={() =>
                        setSelectedChartMetric(metric.key)
                      }
                      className={`rounded-full border px-4 py-2 text-xs font-bold ${selectedChartMetric === metric.key
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-600"
                        }`}
                    >
                      {metric.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Campaign Leaderboard">
        <div className="space-y-3">
          {enriched.map((campaign, i) => (
            <DecisionRow
              key={i}
              title={campaign.campaign_name || 'Unnamed campaign'}
              status={campaign.decision}
              subtitle={`${formatNumber(campaign.spendShare)}% spend share · ${campaign.reason
                }`}
            >
              <MiniStat label="Spend" value={formatCurrency(campaign.spend)} />
              <MiniStat
                label="Revenue"
                value={formatCurrency(campaign.revenue)}
              />
              <MiniStat label="ROAS" value={formatNumber(campaign.roas)} />
              <MiniStat label="CPA" value={formatCurrency(campaign.cpa)} />
              <MiniStat
                label="CTR"
                value={`${formatNumber(campaign.ctr)}%`}
              />
              <MiniStat
                label="Freq"
                value={formatNumber(campaign.frequency)}
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

function ConcentrationCard({ title, value, danger }: any) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
      <p className="text-sm font-bold text-slate-500">{title}</p>
      <p className="mt-1 text-3xl font-black tracking-tight">{value}</p>
      <p
        className={
          danger
            ? 'mt-2 text-xs font-black text-red-600'
            : 'mt-2 text-xs font-black text-emerald-600'
        }
      >
        {danger ? 'High Risk' : 'Healthy'}
      </p>
    </div>
  );
}