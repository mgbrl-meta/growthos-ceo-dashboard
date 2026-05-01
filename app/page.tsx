'use client';

import { useEffect, useMemo, useState } from 'react';
import GoogleOSSettings, {
  defaultSettings,
  GoogleOSSettingsState,
} from "./components/GoogleOSSettings";

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

const DEFAULT_PARAMS: MetaParams = {
  targetRoas: 0.8,
  targetCpa: 1800,
  scalePct: 10,
  killPct: 15,
  minSpend: 10000,
  minPurchases: 3,
  maxCpa: 2200,
  minRoas: 0.7,
  minCtr: 0.8,
  maxFrequency: 2.5,
  cpmIncreasePct: 20,
};

const formatCurrency = (value: number = 0) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatNumber = (value: number = 0, digits = 2) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits }).format(Number(value || 0));

const pctChange = (current: number, previous: number) => {
  if (!previous || previous === 0) return 0;
  return ((Number(current || 0) - Number(previous || 0)) / Number(previous || 0)) * 100;
};

const safeDivide = (a: any, b: any) => {
  const numerator = Number(a || 0);
  const denominator = Number(b || 0);
  if (!denominator) return 0;
  return numerator / denominator;
};

const sum = (rows: Row[], key: string) => rows.reduce((acc, row) => acc + Number(row[key] || 0), 0);

export default function Dashboard() {
  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  const setPreset = (preset: "yesterday" | "l7" | "l14" | "l30" | "mtd" | "lastMonth") => {
    const today = new Date();

    let currentStart = new Date();
    let currentEnd = new Date();

    if (preset === "yesterday") {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);

      currentStart = y;
      currentEnd = y;
    }

    if (preset === "l7") {
      currentEnd = today;
      currentStart = new Date(today);
      currentStart.setDate(today.getDate() - 6);
    }

    if (preset === "l14") {
      currentEnd = today;
      currentStart = new Date(today);
      currentStart.setDate(today.getDate() - 13);
    }

    if (preset === "l30") {
      currentEnd = today;
      currentStart = new Date(today);
      currentStart.setDate(today.getDate() - 29);
    }

    if (preset === "mtd") {
      currentEnd = today;
      currentStart = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    if (preset === "lastMonth") {
      currentStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      currentEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    }

    const days =
      Math.round(
        (currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

    const compareEndDate = new Date(currentStart);
    compareEndDate.setDate(currentStart.getDate() - 1);

    const compareStartDate = new Date(compareEndDate);
    compareStartDate.setDate(compareEndDate.getDate() - days + 1);

    setStart(formatDate(currentStart));
    setEnd(formatDate(currentEnd));
    setCompareStart(formatDate(compareStartDate));
    setCompareEnd(formatDate(compareEndDate));
  };
  
  const [activeTab, setActiveTab] = useState('CEO Summary');
  const [activeMetaTab, setActiveMetaTab] = useState('Settings');
  const [activeGoogleTab, setActiveGoogleTab] = useState('Settings');
  const [googleSettings, setGoogleSettings] = 
    useState<GoogleOSSettingsState>(defaultSettings);

  const googleTabs = [
    'Settings',
    'Overview',
    'Channel Mix',
    'Campaign',
    'Ad Group',
    'Search Terms',
    'Keywords',
    'Funnel',
    'Alerts',
  ];

  const today = new Date();

  const format = (d: Date) => d.toISOString().split("T")[0];

  // current period (last 30 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 29);

  // compare period (previous 30 days)
  const compareEndDate = new Date(startDate);
  compareEndDate.setDate(startDate.getDate() - 1);

  const compareStartDate = new Date(compareEndDate);
  compareStartDate.setDate(compareEndDate.getDate() - 29);

  const [start, setStart] = useState(format(startDate));
  const [end, setEnd] = useState(format(endDate));
  const [compareStart, setCompareStart] = useState(format(compareStartDate));
  const [compareEnd, setCompareEnd] = useState(format(compareEndDate));

  const [data, setData] = useState<Row[]>([]);
  const [compareData, setCompareData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const currentRes = await fetch(`/api/ceo-summary?start=${start}&end=${end}`);
      const currentJson = await currentRes.json();

      const compareRes = await fetch(`/api/ceo-summary?start=${compareStart}&end=${compareEnd}`);
      const compareJson = await compareRes.json();

      setData(Array.isArray(currentJson) ? currentJson : []);
      setCompareData(Array.isArray(compareJson) ? compareJson : []);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const metrics = useMemo(() => {
    const revenue = sum(data, 'revenue');
    const spend = sum(data, 'total_spend');
    const metaSpend = sum(data, 'meta_spend');
    const googleSpend = sum(data, 'google_spend');
    const metaRevenue = sum(data, 'meta_revenue');
    const googleRevenue = sum(data, 'google_revenue');
    const orders = sum(data, 'orders');
    const customers = sum(data, 'customers');
    const newCustomers = sum(data, 'new_customers');
    const repeatCustomers = sum(data, 'repeat_customers');
    const newRevenue = sum(data, 'new_customer_revenue');
    const repeatRevenue = sum(data, 'repeat_customer_revenue');

    const cRevenue = sum(compareData, 'revenue');
    const cSpend = sum(compareData, 'total_spend');
    const cNewCustomers = sum(compareData, 'new_customers');
    const roas = safeDivide(revenue, spend);
    const cRoas = safeDivide(cRevenue, cSpend);
    const newCac = safeDivide(spend, newCustomers);
    const cNewCac = safeDivide(cSpend, cNewCustomers);

    return {
      revenue,
      spend,
      contribution: revenue - spend,
      roas,
      roi: safeDivide(revenue - spend, spend),
      cac: safeDivide(spend, customers),
      newCac,
      aov: safeDivide(revenue, orders),
      orders,
      customers,
      newCustomers,
      repeatCustomers,
      newRevenue,
      repeatRevenue,
      metaSpend,
      googleSpend,
      metaRevenue,
      googleRevenue,
      organicRevenue: Math.max(revenue - metaRevenue - googleRevenue, 0),
      revenueDelta: pctChange(revenue, cRevenue),
      spendDelta: pctChange(spend, cSpend),
      roasDelta: pctChange(roas, cRoas),
      newCacDelta: pctChange(newCac, cNewCac),
      repeatRevenuePct: safeDivide(repeatRevenue, revenue) * 100,
      newRevenuePct: safeDivide(newRevenue, revenue) * 100,
    };
  }, [data, compareData]);

  const tabs = ['CEO Summary', 'Meta OS', 'Google OS', 'Retention OS', 'Product OS'];

  return (
    <main className="min-h-screen bg-[#090d16] text-slate-100">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-white/10 bg-[#0b1020] p-6 lg:block">
          <div className="mb-9">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-lg font-black text-slate-950 shadow-[0_0_40px_rgba(255,255,255,0.18)]">
              GO
            </div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">GrowthOS</p>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.06em] text-white">Command Center</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">CEO-grade operating system for revenue, media, customers and inventory decisions.</p>
          </div>

          <nav className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={
                  activeTab === tab
                    ? 'flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left text-sm font-black text-slate-950 shadow-[0_18px_60px_rgba(255,255,255,0.16)]'
                    : 'flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-bold text-slate-400 hover:bg-white/10 hover:text-white'
                }
              >
                <span>{tab}</span>
                <span className={activeTab === tab ? 'h-2 w-2 rounded-full bg-emerald-500' : 'h-2 w-2 rounded-full bg-slate-700'} />
              </button>
            ))}
          </nav>

          <div className="absolute bottom-6 left-6 right-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Status</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </span>
              <span className="text-sm font-black text-white">{loading ? 'Syncing data' : 'Live data'}</span>
            </div>
          </div>
        </aside>

        <section className="flex-1 overflow-hidden bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_90%_10%,rgba(16,185,129,0.12),transparent_24%),linear-gradient(180deg,#0f172a_0%,#f8fafc_38%)]">
          <div className="mx-auto max-w-[1600px] p-4 md:p-8">
            <header className="mb-6 rounded-[2rem] border border-white/10 bg-white/[0.08] p-5 shadow-2xl shadow-slate-950/20 backdrop-blur-2xl md:p-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.26em] text-cyan-200">{activeTab}</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.06em] text-white md:text-5xl">GrowthOS Dashboard</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Revenue, spend, channel efficiency, customer quality and decision alerts in one operating cockpit.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-right sm:grid-cols-4">
                  <HeroPill label="Revenue" value={formatCurrency(metrics.revenue)} />
                  <HeroPill label="Spend" value={formatCurrency(metrics.spend)} />
                  <HeroPill label="ROAS" value={formatNumber(metrics.roas)} />
                  <HeroPill label="New CAC" value={formatCurrency(metrics.newCac)} />
                </div>
              </div>

              <nav className="mt-6 flex gap-2 overflow-x-auto rounded-2xl bg-slate-950/55 p-2 lg:hidden">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={
                      activeTab === tab
                        ? 'whitespace-nowrap rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-950'
                        : 'whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold text-slate-400'
                    }
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </header>

            <DateControl
              start={start}
              end={end}
              compareStart={compareStart}
              compareEnd={compareEnd}
              setStart={setStart}
              setEnd={setEnd}
              setCompareStart={setCompareStart}
              setCompareEnd={setCompareEnd}
              onApply={fetchData}
              loading={loading}
              setPreset={setPreset}
            />

            <div className="text-slate-950">
              {activeTab === 'CEO Summary' && <CeoSummary metrics={metrics} data={data} />}

              {activeTab === 'Meta OS' && (
                <MetaOS
                  activeMetaTab={activeMetaTab}
                  setActiveMetaTab={setActiveMetaTab}
                  start={start}
                  end={end}
                  compareStart={compareStart}
                  compareEnd={compareEnd}
                />
              )}

              {activeTab === 'Google OS' && (
                <GoogleOS
                  activeGoogleTab={activeGoogleTab}
                  setActiveGoogleTab={setActiveGoogleTab}
                  googleTabs={googleTabs}
                  googleSettings={googleSettings}
                  setGoogleSettings={setGoogleSettings}
                />
              )}

              {activeTab !== 'CEO Summary' && activeTab !== 'Meta OS' && activeTab !== 'Google OS' && (
                <section className="rounded-[2rem] border border-white/70 bg-white/90 p-10 shadow-2xl shadow-slate-200/70 backdrop-blur-xl">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Coming Next</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">{activeTab}</h2>
                  <p className="mt-2 text-slate-500">This GrowthOS module will come next.</p>
                </section>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function HeroPill({ label, value }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 backdrop-blur-xl">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-white md:text-base">{value}</p>
    </div>
  );
}
function DateControl({ start, end, compareStart, compareEnd, setStart, setEnd, setCompareStart, setCompareEnd, onApply, loading, setPreset, }: any) {
  return (
    <section className="mb-7 rounded-[2rem] border border-white/70 bg-white/95 p-5 shadow-2xl shadow-slate-900/10 backdrop-blur-xl md:p-6">
      <div className="mb-5 flex items-end justify-between gap-6">
        <div>
          <h3 className="text-lg font-black tracking-tight">Date Control</h3>
          <p className="text-sm text-slate-500">Primary period vs comparison period</p>
        </div>
        <button onClick={onApply} className="rounded-2xl bg-gradient-to-r from-slate-950 to-slate-800 px-7 py-3 text-sm font-black text-white shadow-xl shadow-slate-900/20 transition hover:-translate-y-0.5">
          {loading ? 'Loading...' : 'Apply'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => setPreset("yesterday")} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 hover:border-slate-950 hover:bg-slate-950 hover:text-white"
>         Yesterday
        </button>
        <button onClick={() => setPreset("l7")} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 hover:border-slate-950 hover:bg-slate-950 hover:text-white">
          Last 7 Days
        </button>
        <button onClick={() => setPreset("l14")} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 hover:border-slate-950 hover:bg-slate-950 hover:text-white">
          Last 14 Days
        </button>
        <button onClick={() => setPreset("l30")} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 hover:border-slate-950 hover:bg-slate-950 hover:text-white">
          Last 30 Days
        </button>
        <button onClick={() => setPreset("mtd")} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 hover:border-slate-950 hover:bg-slate-950 hover:text-white">
          This Month
        </button>
        <button onClick={() => setPreset("lastMonth")} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 hover:border-slate-950 hover:bg-slate-950 hover:text-white">
          Last Month
        </button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <Field label="Start Date" value={start} setValue={setStart} />
        <Field label="End Date" value={end} setValue={setEnd} />
        <Field label="Compare Start" value={compareStart} setValue={setCompareStart} />
        <Field label="Compare End" value={compareEnd} setValue={setCompareEnd} />
      </div>
    </section>
  );
}

function CeoSummary({ metrics, data }: any) {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-5 gap-4">
        <MetricCard title="Revenue" value={formatCurrency(metrics.revenue)} delta={metrics.revenueDelta} goodUp />
        <MetricCard title="Total Spend" value={formatCurrency(metrics.spend)} delta={metrics.spendDelta} />
        <MetricCard title="Contribution After Ads" value={formatCurrency(metrics.contribution)} delta={metrics.revenueDelta - metrics.spendDelta} goodUp />
        <MetricCard title="Blended ROAS" value={formatNumber(metrics.roas)} delta={metrics.roasDelta} goodUp />
        <MetricCard title="New CAC" value={formatCurrency(metrics.newCac)} delta={metrics.newCacDelta} />
      </section>

      <section className="grid grid-cols-2 gap-5">
        <Panel title="Channel Efficiency">
          <ChannelRow name="Meta" spend={metrics.metaSpend} revenue={metrics.metaRevenue} total={metrics.spend} />
          <ChannelRow name="Google" spend={metrics.googleSpend} revenue={metrics.googleRevenue} total={metrics.spend} />
          <ChannelRow name="Organic / Direct" spend={0} revenue={metrics.organicRevenue} total={metrics.spend} />
        </Panel>
        <Panel title="Customer Economics">
          <div className="grid grid-cols-2 gap-3">
            <DataTile label="New Customers" value={formatNumber(metrics.newCustomers, 0)} />
            <DataTile label="Repeat Customers" value={formatNumber(metrics.repeatCustomers, 0)} />
            <DataTile label="New Revenue" value={formatCurrency(metrics.newRevenue)} />
            <DataTile label="Repeat Revenue" value={formatCurrency(metrics.repeatRevenue)} />
            <DataTile label="New Revenue %" value={`${formatNumber(metrics.newRevenuePct)}%`} />
            <DataTile label="Repeat Revenue %" value={`${formatNumber(metrics.repeatRevenuePct)}%`} />
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-2 gap-5">
        <Panel title="Profitability Snapshot">
          <div className="space-y-3">
            <ProfitLine label="Revenue" value={formatCurrency(metrics.revenue)} />
            <ProfitLine label="Ad Spend" value={`- ${formatCurrency(metrics.spend)}`} />
            <div className="flex justify-between rounded-2xl bg-slate-950 p-4 text-white">
              <span className="font-bold text-slate-300">Contribution After Ads</span>
              <strong>{formatCurrency(metrics.contribution)}</strong>
            </div>
          </div>
        </Panel>
        <Panel title="CEO Alerts">
          <AlertBox tone={metrics.contribution < 0 ? 'red' : 'green'} title={metrics.contribution < 0 ? 'Negative after ads' : 'Positive after ads'} text={`Contribution after ads is ${formatCurrency(metrics.contribution)}.`} />
          <AlertBox tone={metrics.roas < 1 ? 'red' : metrics.roas < 2 ? 'amber' : 'green'} title={metrics.roas < 1 ? 'ROAS below 1.0' : metrics.roas < 2 ? 'ROAS needs monitoring' : 'ROAS healthy'} text={`Current blended ROAS is ${formatNumber(metrics.roas)}.`} />
          <AlertBox tone={metrics.newCac > metrics.aov ? 'amber' : 'green'} title={metrics.newCac > metrics.aov ? 'CAC above AOV' : 'CAC quality acceptable'} text={`New CAC is ${formatCurrency(metrics.newCac)} vs AOV ${formatCurrency(metrics.aov)}.`} />
        </Panel>
      </section>
    </div>
  );
}

function GoogleOS({ activeGoogleTab, setActiveGoogleTab, googleTabs, googleSettings, setGoogleSettings }: any) {
  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/95 p-6 shadow-2xl shadow-slate-200/70 backdrop-blur-xl">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Google OS</p>
          <h2 className="mt-1 text-3xl font-black tracking-[-0.05em]">Search & Intent Decision System</h2>
          <p className="mt-1 max-w-3xl text-slate-500">
            Settings, channel mix, campaign diagnosis, ad group control, search terms, keywords, funnel and alerts.
          </p>
        </div>
        <div className="rounded-full border bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm">
          Search Terms First System
        </div>
      </div>

      <div className="mb-6 flex max-w-full gap-2 overflow-x-auto rounded-2xl bg-slate-950 p-2 shadow-inner">
        {googleTabs.map((tab: string) => (
          <button
            key={tab}
            onClick={() => setActiveGoogleTab(tab)}
            className={
              activeGoogleTab === tab
                ? 'whitespace-nowrap rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-950 shadow-sm'
                : 'whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold text-slate-400 hover:bg-white/10 hover:text-white'
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {activeGoogleTab === 'Settings' && (
        <div className="rounded-3xl border bg-slate-50 p-6 shadow-sm">
          <GoogleOSSettings settings={googleSettings} setSettings={setGoogleSettings} />
        </div>
      )}

      {activeGoogleTab !== 'Settings' && (
        <div className="space-y-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <DataTile label="Module" value={activeGoogleTab} />
            <DataTile label="Primary Use" value={activeGoogleTab === 'Search Terms' ? 'Negative / Positive Keyword Decisions' : 'Performance Diagnosis'} />
            <DataTile label="Status" value="UI Ready" />
          </section>

          <Panel title={activeGoogleTab + ' Workspace'}>
            <EmptyState
              title={activeGoogleTab + ' logic comes next'}
              text="The Claude-style UI shell is integrated. Now connect this tab to your Google OS API/table logic without touching the design system."
            />
          </Panel>

          <PanelDark title="Decision Logic Placeholder">
            <RiskBox title="Keep" text="Use this area for winners, positives, profitable campaigns or scalable signals." />
            <RiskBox title="Watch" text="Use this area for low-data terms, volatile campaigns or learning-stage assets." />
            <RiskBox title="Block / Fix" text="Use this area for waste, negatives, CPA leaks or funnel drop-offs." />
          </PanelDark>
        </div>
      )}
    </section>
  );
}

function MetaOS({ activeMetaTab, setActiveMetaTab, start, end, compareStart, compareEnd }: any) {
  const [params, setParams] = useState<MetaParams>(DEFAULT_PARAMS);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const res = await fetch(`/api/meta-os?tab=campaign-list&start=${start}&end=${end}`);
        const json = await res.json();
        const names = Array.isArray(json) ? json.map((x: any) => x.campaign_name).filter(Boolean) : [];
        setCampaigns(names);
        if (names.length > 0 && !names.includes(selectedCampaign)) {
          setSelectedCampaign(names[0]);
        }
      } catch (e) {
        console.error('Campaign list error', e);
      }
    }
    fetchCampaigns();
  }, [start, end]);

  const metaTabs = ['Settings', 'Overview', 'Campaign Analysis', 'Ad Set Analysis', 'Creative Analysis', 'Funnel Analysis', 'Alerts & Recommendations'];

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/95 p-6 shadow-2xl shadow-slate-200/70 backdrop-blur-xl">
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Meta OS</p>
        <h2 className="mt-1 text-3xl font-black tracking-[-0.05em]">Performance Decision System</h2>
        <p className="mt-1 text-slate-500">Settings-driven analysis across overview, campaigns, ad sets, creatives, funnel and alerts.</p>
      </div>

      <div className="mb-6 flex max-w-full gap-2 overflow-x-auto rounded-2xl bg-slate-950 p-2 shadow-inner">
        {metaTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveMetaTab(tab)}
            className={
              activeMetaTab === tab
                ? 'whitespace-nowrap rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-950 shadow-sm'
                : 'whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold text-slate-400 hover:bg-white/10 hover:text-white'
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {activeMetaTab === 'Settings' && <MetaSettings params={params} setParams={setParams} />}
      {activeMetaTab === 'Overview' && <MetaOverview start={start} end={end} compareStart={compareStart} compareEnd={compareEnd} params={params} />}
      {activeMetaTab === 'Campaign Analysis' && <MetaCampaignAnalysis start={start} end={end} params={params} />}
      {activeMetaTab === 'Ad Set Analysis' && <MetaAdSetAnalysis start={start} end={end} params={params} campaigns={campaigns} selectedCampaign={selectedCampaign} setSelectedCampaign={setSelectedCampaign} />}
      {activeMetaTab === 'Creative Analysis' && <MetaCreativeAnalysis start={start} end={end} params={params} campaigns={campaigns} selectedCampaign={selectedCampaign} setSelectedCampaign={setSelectedCampaign} />}
      {activeMetaTab === 'Funnel Analysis' && <MetaFunnelAnalysis start={start} end={end} compareStart={compareStart} compareEnd={compareEnd} campaigns={campaigns} selectedCampaign={selectedCampaign} setSelectedCampaign={setSelectedCampaign} />}
      {activeMetaTab === 'Alerts & Recommendations' && <MetaAlerts start={start} end={end} compareStart={compareStart} compareEnd={compareEnd} params={params} />}
    </section>
  );
}

function MetaSettings({ params, setParams }: any) {
  const update = (key: keyof MetaParams, value: string) => setParams((prev: MetaParams) => ({ ...prev, [key]: Number(value || 0) }));

  return (
    <div className="grid grid-cols-2 gap-5">
      <SettingCard title="Core Targets">
        <SettingInput label="Target ROAS" value={params.targetRoas} onChange={(v: string) => update('targetRoas', v)} />
        <SettingInput label="Target CPA" value={params.targetCpa} onChange={(v: string) => update('targetCpa', v)} />
      </SettingCard>
      <SettingCard title="Decision Rules">
        <SettingInput label="Scale If Better Than Target %" value={params.scalePct} onChange={(v: string) => update('scalePct', v)} />
        <SettingInput label="Kill If Worse Than Target %" value={params.killPct} onChange={(v: string) => update('killPct', v)} />
      </SettingCard>
      <SettingCard title="Minimum Data Threshold">
        <SettingInput label="Minimum Spend To Evaluate" value={params.minSpend} onChange={(v: string) => update('minSpend', v)} />
        <SettingInput label="Minimum Purchases" value={params.minPurchases} onChange={(v: string) => update('minPurchases', v)} />
      </SettingCard>
      <SettingCard title="Efficiency Limits">
        <SettingInput label="Max CPA" value={params.maxCpa} onChange={(v: string) => update('maxCpa', v)} />
        <SettingInput label="Min ROAS" value={params.minRoas} onChange={(v: string) => update('minRoas', v)} />
      </SettingCard>
      <SettingCard title="Creative & Fatigue Signals">
        <SettingInput label="Min CTR %" value={params.minCtr} onChange={(v: string) => update('minCtr', v)} />
        <SettingInput label="Max Frequency" value={params.maxFrequency} onChange={(v: string) => update('maxFrequency', v)} />
        <SettingInput label="CPM Increase %" value={params.cpmIncreasePct} onChange={(v: string) => update('cpmIncreasePct', v)} />
      </SettingCard>
      <div className="rounded-[2rem] border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-6 text-white shadow-2xl shadow-slate-900/25">
        <h3 className="text-lg font-black">How this powers Meta OS</h3>
        <p className="mt-2 text-sm text-slate-400">Every tab uses these rules to classify Scale, Watch, Kill, Test and fatigue risks.</p>
        <div className="mt-5 space-y-2 text-sm text-slate-300">
          <p>Scale ROAS: above {(params.targetRoas * (1 + params.scalePct / 100)).toFixed(2)}</p>
          <p>Kill ROAS: below {(params.targetRoas * (1 - params.killPct / 100)).toFixed(2)}</p>
          <p>Evaluate only after {formatCurrency(params.minSpend)} spend</p>
        </div>
      </div>
    </div>
  );
}

function MetaOverview({ start, end, compareStart, compareEnd, params }: any) {
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/meta-os?tab=overview&start=${start}&end=${end}&compareStart=${compareStart}&compareEnd=${compareEnd}`);
        setPayload(await res.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [start, end, compareStart, compareEnd]);

  if (loading || !payload) return <LoadingCard text="Loading Meta overview..." />;

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

  const cRoas = safeDivide(compare.revenue, compare.spend);
  const cpaDelta = pctChange(cpa, safeDivide(compare.spend, compare.purchases));
  const roasDelta = pctChange(roas, cRoas);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-4">
        <MetaMetric title="Revenue" value={formatCurrency(revenue)} delta={pctChange(revenue, compare.revenue)} goodUp />
        <MetaMetric title="Spend" value={formatCurrency(spend)} delta={pctChange(spend, compare.spend)} />
        <MetaMetric title="ROAS" value={formatNumber(roas)} delta={roasDelta} goodUp status={roas >= params.targetRoas ? 'Above target' : 'Below target'} />
        <MetaMetric title="CPA" value={formatCurrency(cpa)} delta={cpaDelta} status={cpa <= params.targetCpa ? 'Within target' : 'Above target'} />
        <MetaMetric title="Purchases" value={formatNumber(purchases, 0)} delta={pctChange(purchases, compare.purchases)} goodUp />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <DataTile label="Reach" value={formatNumber(reach, 0)} />
        <DataTile label="CPM" value={formatCurrency(cpm)} />
        <DataTile label="Frequency" value={formatNumber(frequency)} />
      </div>
      <Panel title="What Changed">
        <div className="grid grid-cols-3 gap-3">
          <Insight good={pctChange(revenue, compare.revenue) >= 0} text={`Revenue ${pctChange(revenue, compare.revenue) >= 0 ? 'grew' : 'dropped'} ${Math.abs(pctChange(revenue, compare.revenue)).toFixed(1)}%`} />
          <Insight good={pctChange(spend, compare.spend) <= 0} text={`Spend ${pctChange(spend, compare.spend) >= 0 ? 'increased' : 'reduced'} ${Math.abs(pctChange(spend, compare.spend)).toFixed(1)}%`} />
          <Insight good={roasDelta >= 0} text={`ROAS ${roasDelta >= 0 ? 'improved' : 'worsened'} ${Math.abs(roasDelta).toFixed(1)}%`} />
        </div>
      </Panel>
      <section className="grid grid-cols-2 gap-5">
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

function MetaCampaignAnalysis({ start, end, params }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/meta-os?tab=campaign&start=${start}&end=${end}`);
        const json = await res.json();
        setRows(Array.isArray(json) ? json : []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [start, end]);

  if (loading) return <LoadingCard text="Loading campaigns..." />;

  const totalSpend = sum(rows, 'spend');
  const enriched = rows
    .map((c) => {
      const spendShare = safeDivide(c.spend, totalSpend) * 100;
      const status = classifyRoas(c.roas, c.spend, c.purchases, params);
      return { ...c, spendShare, status };
    })
    .sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0));

  const scale = enriched.filter((c) => c.status === 'SCALE');
  const kill = enriched.filter((c) => c.status === 'KILL');

  return (
    <div className="space-y-6">
      <Panel title="Budget Allocation">
        <div className="space-y-3">
          {enriched.map((c, i) => (
            <DecisionRow key={i} title={c.campaign_name} status={c.status} subtitle={`${formatNumber(c.spendShare)}% spend share`}>
              <MiniStat label="Spend" value={formatCurrency(c.spend)} />
              <MiniStat label="Revenue" value={formatCurrency(c.revenue)} />
              <MiniStat label="ROAS" value={formatNumber(c.roas)} />
              <MiniStat label="CPA" value={formatCurrency(c.cpa)} />
              <MiniStat label="CTR" value={`${formatNumber(c.ctr)}%`} />
              <MiniStat label="Freq" value={formatNumber(c.frequency)} />
            </DecisionRow>
          ))}
        </div>
      </Panel>
      <section className="grid grid-cols-3 gap-5">
        <ConcentrationCard title="Top Campaign Share" value={`${formatNumber(enriched[0]?.spendShare || 0)}%`} danger={(enriched[0]?.spendShare || 0) > 50} />
        <ConcentrationCard title="Top 3 Campaign Share" value={`${formatNumber(enriched.slice(0, 3).reduce((a, b) => a + b.spendShare, 0))}%`} danger={enriched.slice(0, 3).reduce((a, b) => a + b.spendShare, 0) > 80} />
        <ConcentrationCard title="Campaigns Evaluated" value={formatNumber(enriched.length, 0)} danger={false} />
      </section>
      <section className="grid grid-cols-2 gap-5">
        <Bucket title="🟢 Scaling Opportunities" items={scale} empty="No strong scale candidates" />
        <Bucket title="🔴 Budget Leaks" items={kill} empty="No major leaks" />
      </section>
    </div>
  );
}

function MetaAdSetAnalysis({ start, end, params, campaigns, selectedCampaign, setSelectedCampaign }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCampaign) return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/meta-os?tab=adset&start=${start}&end=${end}&campaign=${encodeURIComponent(selectedCampaign)}`);
        const json = await res.json();
        setRows(Array.isArray(json) ? json : []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [start, end, selectedCampaign]);

  if (!selectedCampaign) return <EmptyState title="No campaign selected" text="Select a campaign to analyse ad sets." />;
  if (loading) return <LoadingCard text="Loading ad sets..." />;

  const campaignReach = Number(rows[0]?.campaign_reach || 0);
  const campaignSpend = Number(rows[0]?.campaign_spend || 0);
  const campaignRevenue = Number(rows[0]?.campaign_revenue || 0);
  const totalAdSetReach = sum(rows, 'reach');
  const overlapIndex = safeDivide(totalAdSetReach - campaignReach, campaignReach) * 100;
  const topAdset = [...rows].sort((a, b) => Number(b.reach || 0) - Number(a.reach || 0))[0];
  const dominance = safeDivide(topAdset?.reach, campaignReach) * 100;

  return (
    <div className="space-y-6">
      <CampaignPicker campaigns={campaigns} value={selectedCampaign} onChange={setSelectedCampaign} />
      <div className="grid grid-cols-5 gap-4">
        <DataTile label="Campaign Spend" value={formatCurrency(campaignSpend)} />
        <DataTile label="Campaign Revenue" value={formatCurrency(campaignRevenue)} />
        <DataTile label="Campaign ROAS" value={formatNumber(safeDivide(campaignRevenue, campaignSpend))} />
        <DataTile label="Active Ad Sets" value={formatNumber(rows.length, 0)} />
        <DataTile label="Campaign Reach" value={formatNumber(campaignReach, 0)} />
      </div>
      <Panel title="Ad Set Performance Inside Campaign">
        <div className="space-y-3">
          {rows.map((a, i) => {
            const status = classifyRoas(a.roas, a.spend, a.purchases, params);
            return (
              <DecisionRow key={i} title={a.adset_name} status={status} subtitle={`Spend share ${formatNumber(a.spend_share)}% · Reach contribution ${formatNumber(a.reach_contribution)}%`}>
                <MiniStat label="Spend" value={formatCurrency(a.spend)} />
                <MiniStat label="Revenue" value={formatCurrency(a.revenue)} />
                <MiniStat label="ROAS" value={formatNumber(a.roas)} />
                <MiniStat label="CPA" value={formatCurrency(a.cpa)} />
                <MiniStat label="Purchases" value={formatNumber(a.purchases, 0)} />
                <MiniStat label="Freq" value={formatNumber(a.frequency)} />
              </DecisionRow>
            );
          })}
        </div>
      </Panel>
      <section className="grid grid-cols-3 gap-5">
        <ConcentrationCard title="Overlap Index" value={`${formatNumber(overlapIndex)}%`} danger={overlapIndex > 75} />
        <ConcentrationCard title="Top Ad Set Dominance" value={`${formatNumber(dominance)}%`} danger={dominance > 70} />
        <ConcentrationCard title="Structure Health" value={rows.length > 5 ? 'Fragmented' : 'Healthy'} danger={rows.length > 5} />
      </section>
      <PanelDark title="Delivery Diagnosis">
        <RiskBox title="Reach Overlap" text={overlapIndex > 75 ? 'High overlap signal. Multiple ad sets may be reaching the same users.' : 'Overlap appears controlled for this campaign.'} />
        <RiskBox title="Ad Set Dominance" text={dominance > 70 ? `${topAdset?.adset_name} covers most campaign reach. Other ad sets may be redundant.` : 'Reach is not overly dominated by one ad set.'} />
        <RiskBox title="Action Logic" text="Use this tab for delivery and structure decisions, not audience assumptions." />
      </PanelDark>
    </div>
  );
}

function MetaCreativeAnalysis({ start, end, params, campaigns, selectedCampaign, setSelectedCampaign }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCampaign) return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/meta-os?tab=creative&start=${start}&end=${end}&campaign=${encodeURIComponent(selectedCampaign)}`);
        const json = await res.json();
        setRows(Array.isArray(json) ? json : []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [start, end, selectedCampaign]);

  if (!selectedCampaign) return <EmptyState title="No campaign selected" text="Select a campaign to analyse creatives." />;
  if (loading) return <LoadingCard text="Loading creatives..." />;

  const enriched = rows.map((c) => ({ ...c, status: classifyCreative(c, params) }));
  const scale = enriched.filter((c) => c.status === 'SCALE');
  const test = enriched.filter((c) => c.status === 'TEST');
  const kill = enriched.filter((c) => c.status === 'KILL');
  const ignore = enriched.filter((c) => c.status === 'IGNORE');
  const baseline = rows[0] || {};

  return (
    <div className="space-y-6">
      <CampaignPicker campaigns={campaigns} value={selectedCampaign} onChange={setSelectedCampaign} />
      <div className="grid grid-cols-5 gap-4">
        <DataTile label="Campaign ROAS" value={formatNumber(baseline.campaign_roas)} />
        <DataTile label="Campaign CPA" value={formatCurrency(baseline.campaign_cpa)} />
        <DataTile label="Campaign CTR" value={`${formatNumber(baseline.campaign_ctr)}%`} />
        <DataTile label="Campaign CPM" value={formatCurrency(baseline.campaign_cpm)} />
        <DataTile label="Creatives" value={formatNumber(rows.length, 0)} />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <CreativeBucket title="🟢 Scale" subtitle="Meaningful spend + above campaign average" items={scale} />
        <CreativeBucket title="🟡 Test" subtitle="Low spend but promising signal" items={test} />
        <CreativeBucket title="🔴 Kill / Fix" subtitle="Meaningful spend + below campaign average" items={kill} />
        <CreativeBucket title="⚪ Ignore" subtitle="Low signal / no action yet" items={ignore} />
      </div>
      <Panel title="Creative Leaderboard">
        <div className="space-y-3">
          {enriched
            .sort((a, b) => Number(b.roas_index || 0) - Number(a.roas_index || 0))
            .map((c, i) => (
              <DecisionRow key={i} title={c.creative_name || 'Unnamed creative'} status={c.status} subtitle={`ROAS Index ${formatNumber(c.roas_index)} · CTR Index ${formatNumber(c.ctr_index)}`}>
                <MiniStat label="Spend" value={formatCurrency(c.spend)} />
                <MiniStat label="Revenue" value={formatCurrency(c.revenue)} />
                <MiniStat label="ROAS" value={`${formatNumber(c.roas)} (${formatIndex(c.roas_index)})`} />
                <MiniStat label="CTR" value={`${formatNumber(c.ctr)}% (${formatIndex(c.ctr_index)})`} />
                <MiniStat label="CPA" value={formatCurrency(c.cpa)} />
                <MiniStat label="Purchases" value={formatNumber(c.purchases, 0)} />
              </DecisionRow>
            ))}
        </div>
      </Panel>
      <section className="grid grid-cols-2 gap-5">
        <Panel title="Creative Insights">
          <AlertBox tone="green" title="Campaign-normalized" text="Creatives are judged against campaign average, not global ROAS." />
          <AlertBox tone="amber" title="High CTR + low ROAS" text="Hook may be working but conversion quality may be weak." />
          <AlertBox tone="green" title="Low spend winners" text="Low spend winners are marked TEST, not SCALE, until spend validates performance." />
        </Panel>
        <PanelDark title="Action Panel">
          {[...scale.slice(0, 2), ...test.slice(0, 2), ...kill.slice(0, 2)].map((c, i) => (
            <RiskBox key={i} title={`${c.status}: ${c.creative_name}`} text={`ROAS Index ${formatNumber(c.roas_index)} · CTR Index ${formatNumber(c.ctr_index)}`} />
          ))}
        </PanelDark>
      </section>
    </div>
  );
}

function MetaFunnelAnalysis({ start, end, compareStart, compareEnd, campaigns, selectedCampaign, setSelectedCampaign }: any) {
  const [viewMode, setViewMode] = useState<'account' | 'campaign'>('account');
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const campaignParam = viewMode === 'campaign' && selectedCampaign ? `&campaign=${encodeURIComponent(selectedCampaign)}` : '';
        const res = await fetch(`/api/meta-os?tab=funnel&start=${start}&end=${end}&compareStart=${compareStart}&compareEnd=${compareEnd}${campaignParam}`);
        setPayload(await res.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [start, end, compareStart, compareEnd, viewMode, selectedCampaign]);

  if (loading || !payload) return <LoadingCard text="Loading funnel..." />;

  const data = payload.current || {};
  const compare = payload.compare || {};
  const rates = getFunnelRates(data);
  const prevRates = getFunnelRates(compare);
  const deltas = {
    ctr: rates.ctr - prevRates.ctr,
    lpv: rates.lpvRate - prevRates.lpvRate,
    atc: rates.atcRate - prevRates.atcRate,
    checkout: rates.checkoutRate - prevRates.checkoutRate,
    purchase: rates.purchaseRate - prevRates.purchaseRate,
  };
  const biggestDrop = Object.entries(deltas).sort((a, b) => a[1] - b[1])[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-3xl border bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-black">Funnel Analysis</h3>
          <p className="text-sm text-slate-500">Account-level health or campaign-level diagnosis.</p>
        </div>
        <div className="flex gap-2">
          <Toggle active={viewMode === 'account'} onClick={() => setViewMode('account')} label="Account Level" />
          <Toggle active={viewMode === 'campaign'} onClick={() => setViewMode('campaign')} label="Campaign Level" />
        </div>
      </div>
      {viewMode === 'campaign' && <CampaignPicker campaigns={campaigns} value={selectedCampaign} onChange={setSelectedCampaign} />}
      <Panel title="Funnel Flow">
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-3">
          <FunnelCard label="Impressions" value={data.impressions} />
          <Arrow />
          <FunnelCard label="Clicks" value={data.clicks} rate={rates.ctr} delta={deltas.ctr} rateLabel="CTR" />
          <Arrow />
          <FunnelCard label="LPV" value={data.lpv} rate={rates.lpvRate} delta={deltas.lpv} rateLabel="LPV Rate" />
          <Arrow />
          <FunnelCard label="ATC" value={data.atc} rate={rates.atcRate} delta={deltas.atc} rateLabel="ATC Rate" />
          <Arrow />
          <FunnelCard label="Checkout" value={data.checkout} rate={rates.checkoutRate} delta={deltas.checkout} rateLabel="Checkout Rate" />
          <Arrow />
          <FunnelCard label="Purchase" value={data.purchases} rate={rates.purchaseRate} delta={deltas.purchase} rateLabel="Purchase Rate" />
        </div>
      </Panel>
      <AlertBox tone="red" title="Biggest Drop-Off" text={`${String(biggestDrop[0]).toUpperCase()} changed ${biggestDrop[1] >= 0 ? '+' : ''}${formatNumber(biggestDrop[1])} pts vs compare.`} />
      <PanelDark title="Diagnosis">
        <RiskBox title="Creative" text="Low CTR indicates weak hooks or messaging." />
        <RiskBox title="Landing" text="High CTR but low LPV suggests mismatch or slow load." />
        <RiskBox title="Conversion" text="Low ATC or purchase rate indicates product or checkout issue." />
      </PanelDark>
    </div>
  );
}

function MetaAlerts({ start, end, compareStart, compareEnd, params }: any) {
  const [campaignRows, setCampaignRows] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [campaignRes, overviewRes] = await Promise.all([
          fetch(`/api/meta-os?tab=campaign&start=${start}&end=${end}`),
          fetch(`/api/meta-os?tab=overview&start=${start}&end=${end}&compareStart=${compareStart}&compareEnd=${compareEnd}`),
        ]);
        setCampaignRows(await campaignRes.json());
        setOverview(await overviewRes.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [start, end, compareStart, compareEnd]);

  if (loading || !overview) return <LoadingCard text="Loading recommendations..." />;

  const current = overview.current || {};
  const roas = safeDivide(current.revenue, current.spend);
  const cpa = safeDivide(current.spend, current.purchases);
  const frequency = safeDivide(current.impressions, current.reach);
  const totalSpend = sum(campaignRows, 'spend');
  const topCampaign = [...campaignRows].sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0))[0];
  const topShare = safeDivide(topCampaign?.spend, totalSpend) * 100;

  const alerts = [
    roas < params.targetRoas && { tone: 'red', title: 'ROAS below target', text: `Meta ROAS is ${formatNumber(roas)} vs target ${params.targetRoas}.` },
    cpa > params.maxCpa && { tone: 'red', title: 'CPA above hard limit', text: `CPA is ${formatCurrency(cpa)} vs max ${formatCurrency(params.maxCpa)}.` },
    frequency > params.maxFrequency && { tone: 'amber', title: 'Frequency fatigue risk', text: `Frequency is ${formatNumber(frequency)} vs threshold ${params.maxFrequency}.` },
    topShare > 50 && { tone: 'amber', title: 'Campaign dependency risk', text: `${topCampaign?.campaign_name} controls ${formatNumber(topShare)}% of spend.` },
    roas >= params.targetRoas && cpa <= params.maxCpa && { tone: 'green', title: 'Meta within operating range', text: 'ROAS and CPA are within current Settings thresholds.' },
  ].filter(Boolean) as any[];

  return (
    <div className="grid grid-cols-2 gap-5">
      {alerts.map((a, i) => <AlertBox key={i} tone={a.tone} title={a.title} text={a.text} />)}
    </div>
  );
}

function classifyRoas(roas: number, spend: number, purchases: number, params: MetaParams) {
  if (Number(spend || 0) < params.minSpend || Number(purchases || 0) < params.minPurchases) return 'WATCH';
  if (Number(roas || 0) >= params.targetRoas * (1 + params.scalePct / 100)) return 'SCALE';
  if (Number(roas || 0) <= params.targetRoas * (1 - params.killPct / 100)) return 'KILL';
  return 'WATCH';
}

function classifyCreative(c: any, params: MetaParams) {
  const spend = Number(c.spend || 0);
  const purchases = Number(c.purchases || 0);
  const roasIndex = Number(c.roas_index || 0);
  const ctrIndex = Number(c.ctr_index || 0);
  const highIndex = 1 + params.scalePct / 100;
  const lowIndex = 1 - params.killPct / 100;

  if (spend >= params.minSpend && purchases >= params.minPurchases && roasIndex >= highIndex) return 'SCALE';
  if (spend < params.minSpend && (roasIndex >= highIndex || ctrIndex >= highIndex)) return 'TEST';
  if (spend >= params.minSpend && roasIndex <= lowIndex) return 'KILL';
  return 'IGNORE';
}

function getFunnelRates(data: any) {
  return {
    ctr: safeDivide(data.clicks, data.impressions) * 100,
    lpvRate: safeDivide(data.lpv, data.clicks) * 100,
    atcRate: safeDivide(data.atc, data.lpv) * 100,
    checkoutRate: safeDivide(data.checkout, data.atc) * 100,
    purchaseRate: safeDivide(data.purchases, data.checkout) * 100,
  };
}

function Field({ label, value, setValue }: any) {
  return (
    <label>
      <span className="mb-1 block text-xs font-bold text-slate-500">{label}</span>
      <input type="date" value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-black text-slate-900 outline-none ring-0 transition focus:border-slate-950 focus:shadow-lg" />
    </label>
  );
}

function MetricCard({ title, value, delta, goodUp = false, status }: any) {
  const isGood = goodUp ? delta >= 0 : delta <= 0;
  return (
    <div className="group relative overflow-hidden rounded-[2rem] border border-white/70 bg-white p-5 shadow-2xl shadow-slate-200/70 transition hover:-translate-y-1 hover:shadow-slate-300/70"><div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-blue-600 to-emerald-400" />
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">{title}</p>
      <h3 className="mt-2 text-2xl font-black tracking-tight">{value}</h3>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className={isGood ? 'text-sm font-black text-emerald-600' : 'text-sm font-black text-red-600'}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta || 0).toFixed(2)}%
        </p>
        {status && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{status}</span>}
      </div>
    </div>
  );
}

function MetaMetric(props: any) {
  return <MetricCard {...props} />;
}

function Panel({ title, children }: any) {
  return (
    <section className="rounded-[2rem] border border-white/70 bg-white p-6 shadow-2xl shadow-slate-200/70">
      <h3 className="mb-4 text-lg font-black tracking-tight">{title}</h3>
      {children}
    </section>
  );
}

function PanelDark({ title, children }: any) {
  return (
    <section className="rounded-[2rem] border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-6 text-white shadow-2xl shadow-slate-900/25">
      <h3 className="mb-4 text-lg font-black tracking-tight">{title}</h3>
      <div className="grid grid-cols-3 gap-4">{children}</div>
    </section>
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

function MiniStat({ label, value }: any) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}

function ChannelRow({ name, spend, revenue, total }: any) {
  const share = safeDivide(spend, total) * 100;
  const roas = safeDivide(revenue, spend);
  return (
    <div className="border-b border-slate-100 py-4 last:border-0">
      <div className="mb-2 flex justify-between">
        <strong>{name}</strong>
        <strong>{formatCurrency(spend)}</strong>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-slate-950 to-blue-600" style={{ width: `${Math.min(share, 100)}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-sm font-semibold text-slate-500">
        <span>{formatNumber(share)}% spend share</span>
        <span>Revenue {formatCurrency(revenue)} · ROAS {formatNumber(roas)}</span>
      </div>
    </div>
  );
}

function AlertBox({ tone, title, text }: any) {
  const cls = tone === 'red' ? 'border-red-200 bg-red-50 text-red-900' : tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900';
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <h4 className="font-black">{title}</h4>
      <p className="mt-1 text-sm opacity-80">{text}</p>
    </div>
  );
}

function Insight({ good, text }: any) {
  return <div className={good ? 'rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800' : 'rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800'}>{text}</div>;
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
      <div className="grid grid-cols-6 gap-3">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: any) {
  const cls = status === 'SCALE' ? 'bg-emerald-100 text-emerald-700' : status === 'KILL' ? 'bg-red-100 text-red-700' : status === 'TEST' ? 'bg-blue-100 text-blue-700' : status === 'IGNORE' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700';
  return <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-black ${cls}`}>{status}</span>;
}

function ConcentrationCard({ title, value, danger }: any) {
  return (
    <div className="rounded-[2rem] border border-white/70 bg-white p-5 shadow-2xl shadow-slate-200/70">
      <p className="text-sm font-bold text-slate-500">{title}</p>
      <p className="mt-1 text-3xl font-black tracking-tight">{value}</p>
      <p className={danger ? 'mt-2 text-xs font-black text-red-600' : 'mt-2 text-xs font-black text-emerald-600'}>{danger ? 'High Risk' : 'Healthy'}</p>
    </div>
  );
}

function Bucket({ title, items, empty }: any) {
  return (
    <div className="rounded-[2rem] border border-white/70 bg-white p-6 shadow-2xl shadow-slate-200/70">
      <h3 className="mb-4 font-black">{title}</h3>
      {items.length === 0 ? <p className="text-sm text-slate-500">{empty}</p> : items.slice(0, 8).map((c: any, i: number) => <p key={i} className="mb-2 font-semibold">{c.campaign_name} → ROAS {formatNumber(c.roas)}</p>)}
    </div>
  );
}

function CreativeBucket({ title, subtitle, items }: any) {
  return (
    <div className="rounded-[2rem] border border-white/70 bg-white p-6 shadow-2xl shadow-slate-200/70">
      <h3 className="font-black">{title}</h3>
      <p className="mb-4 text-sm text-slate-500">{subtitle}</p>
      {items.length === 0 && <p className="text-sm text-slate-500">No creatives in this bucket.</p>}
      <div className="space-y-3">
        {items.slice(0, 5).map((c: any, i: number) => (
          <div key={i} className="rounded-2xl border bg-slate-50 p-4">
            <p className="font-black">{c.creative_name}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">Spend {formatCurrency(c.spend)} · ROAS {formatNumber(c.roas)} · Index {formatNumber(c.roas_index)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CampaignPicker({ campaigns, value, onChange }: any) {
  return (
    <div className="rounded-[2rem] border border-white/70 bg-white p-5 shadow-2xl shadow-slate-200/70">
      <label className="block text-xs font-black uppercase tracking-wider text-slate-500">Campaign</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-2xl border bg-slate-50 px-4 py-3 font-bold outline-none">
        {campaigns.map((c: string) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}

function SettingCard({ title, children }: any) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-lg shadow-slate-200/60">
      <h3 className="mb-4 font-black">{title}</h3>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function SettingInput({ label, value, onChange }: any) {
  return (
    <label>
      <span className="mb-1 block text-xs font-bold text-slate-500">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-black outline-none focus:border-slate-950" />
    </label>
  );
}

function RiskBox({ title, text }: any) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <h4 className="font-black text-white">{title}</h4>
      <p className="mt-2 text-sm text-slate-400">{text}</p>
    </div>
  );
}

function FunnelCard({ label, value, rate, delta, rateLabel }: any) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4 text-center">
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black">{formatNumber(value, 0)}</p>
      {rate !== undefined && (
        <p className="mt-1 text-sm font-bold">
          {rateLabel}: {formatNumber(rate)}% <span className={delta < 0 ? 'text-red-600' : 'text-emerald-600'}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta || 0).toFixed(1)}</span>
        </p>
      )}
    </div>
  );
}

function Arrow() {
  return <div className="text-center text-2xl font-black text-slate-300">→</div>;
}

function Toggle({ active, onClick, label }: any) {
  return <button onClick={onClick} className={active ? 'rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white' : 'rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600'}>{label}</button>;
}

function EmptyState({ title, text }: any) {
  return <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/80 p-10 shadow-xl shadow-slate-200/70"><h3 className="text-xl font-black">{title}</h3><p className="mt-2 text-slate-500">{text}</p></div>;
}

function LoadingCard({ text }: any) {
  return <div className="rounded-[2rem] border border-white/70 bg-white p-6 font-bold text-slate-500 shadow-2xl shadow-slate-200/70">{text}</div>;
}

function ProfitLine({ label, value }: any) {
  return <div className="flex justify-between rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm"><span className="font-bold text-slate-500">{label}</span><strong>{value}</strong></div>;
}

function formatIndex(index: number) {
  const change = (Number(index || 0) - 1) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(0)}% vs avg`;
}
