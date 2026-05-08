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
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts';

export default function MetaOverview({
  start,
  end,
  compareStart,
  compareEnd,
  params,
}: any) {
  const [payload, setPayload] = useState<any>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [overviewRes, trendRes] = await Promise.all([
          fetch(
            `/api/meta-os?tab=overview&start=${start}&end=${end}&compareStart=${compareStart}&compareEnd=${compareEnd}`
          ),
          fetch(`/api/meta-os?tab=trend&start=${start}&end=${end}`),
        ]);

        setPayload(await overviewRes.json());

        const trendJson = await trendRes.json();
        setTrend(Array.isArray(trendJson) ? trendJson : []);
      } catch (error) {
        console.error('Meta overview error', error);
        setPayload(null);
        setTrend([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [start, end, compareStart, compareEnd]);

  if (loading || !payload) {
    return <LoadingCard text="Loading Meta overview..." />;
  }

  const current = payload.current || {};
  const compare = payload.compare || {};

  const spend = Number(current.spend || 0);
  const revenue = Number(current.revenue || 0);
  const purchases = Number(current.purchases || 0);
  const impressions = Number(current.impressions || 0);
  const reach = Number(current.reach || 0);
  const clicks = Number(current.clicks || 0);

  const roas = safeDivide(revenue, spend);
  const cpa = safeDivide(spend, purchases);
  const ctr = safeDivide(clicks, impressions) * 100;
  const cpm = safeDivide(spend, impressions) * 1000;
  const frequency = safeDivide(impressions, reach);

  const compareRoas = safeDivide(compare.revenue, compare.spend);
  const compareCpa = safeDivide(compare.spend, compare.purchases);

  const funnelData = [
    { name: 'Clicks', value: Number(current.clicks || 0) },
    { name: 'LPV', value: Number(current.lpv || 0) },
    { name: 'ATC', value: Number(current.atc || 0) },
    { name: 'Checkout', value: Number(current.checkout || 0) },
    { name: 'Purchase', value: Number(current.purchases || 0) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Revenue" value={formatCurrency(revenue)} delta={pctChange(revenue, compare.revenue)} goodUp />
        <MetricCard title="Spend" value={formatCurrency(spend)} delta={pctChange(spend, compare.spend)} />
        <MetricCard title="ROAS" value={formatNumber(roas)} delta={pctChange(roas, compareRoas)} goodUp status={roas >= params.targetRoas ? 'Above target' : 'Below target'} />
        <MetricCard title="CPA" value={formatCurrency(cpa)} delta={pctChange(cpa, compareCpa)} status={cpa <= params.targetCpa ? 'Within target' : 'Above target'} />
        <MetricCard title="Purchases" value={formatNumber(purchases, 0)} delta={pctChange(purchases, compare.purchases)} goodUp />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DataTile label="Reach" value={formatNumber(reach, 0)} />
        <DataTile label="CPM" value={formatCurrency(cpm)} />
        <DataTile label="Frequency" value={formatNumber(frequency)} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ChartPanel title="Revenue vs Spend">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v || 0))} />
                <Area type="monotone" dataKey="revenue" stroke="#0f172a" fill="#0f172a" fillOpacity={0.12} strokeWidth={2} />
                <Area type="monotone" dataKey="spend" stroke="#2563eb" fill="#2563eb" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="ROAS Trend">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                <Tooltip />
                <Line type="monotone" dataKey="roas" stroke="#0f172a" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="CPA Trend">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v || 0))} />
                <Line type="monotone" dataKey="cpa" stroke="#dc2626" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="Funnel Drop-off">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                <Tooltip />
                <Bar dataKey="value" fill="#0f172a" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Cost Drivers">
          <DriverRow label="CPM" value={formatCurrency(cpm)} note="Auction cost pressure" />
          <DriverRow label="Frequency" value={formatNumber(frequency)} note={frequency > params.maxFrequency ? 'Fatigue risk' : 'Below fatigue threshold'} />
          <DriverRow label="Reach" value={formatNumber(reach, 0)} note="Audience coverage" />
        </Panel>

        <Panel title="Conversion Drivers">
          <DriverRow label="CTR" value={`${formatNumber(ctr)}%`} note={ctr < params.minCtr ? 'Creative signal weak' : 'Creative signal acceptable'} />
          <DriverRow label="CPA" value={formatCurrency(cpa)} note={cpa > params.maxCpa ? 'Above hard limit' : 'Within limit'} />
          <DriverRow label="ROAS" value={formatNumber(roas)} note={roas < params.minRoas ? 'Below floor' : 'Above floor'} />
        </Panel>
      </section>
    </div>
  );
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

function pctChange(current: number, previous: number) {
  if (!previous || previous === 0) return 0;
  return ((Number(current || 0) - Number(previous || 0)) / Number(previous || 0)) * 100;
}

function safeDivide(a: any, b: any) {
  const numerator = Number(a || 0);
  const denominator = Number(b || 0);
  if (!denominator) return 0;
  return numerator / denominator;
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

function ChartPanel({ title, children }: any) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
      <h3 className="mb-4 text-sm font-black uppercase tracking-[0.16em] text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function MetricCard({ title, value, delta, goodUp = false, status }: any) {
  const isGood = goodUp ? delta >= 0 : delta <= 0;

  return (
    <div className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 transition hover:-translate-y-1">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-blue-600 to-emerald-400" />
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">{title}</p>
      <h3 className="mt-2 text-2xl font-black tracking-tight">{value}</h3>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className={isGood ? 'text-sm font-black text-emerald-600' : 'text-sm font-black text-red-600'}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta || 0).toFixed(2)}%
        </p>
        {status && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
            {status}
          </span>
        )}
      </div>
    </div>
  );
}

function DataTile({ label, value }: any) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function DriverRow({ label, value, note }: any) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-4 last:border-0">
      <div>
        <p className="font-black">{label}</p>
        <p className="text-sm text-slate-500">{note}</p>
      </div>
      <strong className="text-lg">{value}</strong>
    </div>
  );
}