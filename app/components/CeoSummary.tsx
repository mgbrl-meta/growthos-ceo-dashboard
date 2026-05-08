type CeoSummaryProps = {
  metrics: any;
  data: any[];
};

const formatCurrency = (value: number = 0) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatNumber = (value: number = 0, digits = 2) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits }).format(Number(value || 0));

const safeDivide = (a: any, b: any) => {
  const numerator = Number(a || 0);
  const denominator = Number(b || 0);
  if (!denominator) return 0;
  return numerator / denominator;
};

export default function CeoSummary({ metrics = {} }: any) {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <MetricCard title="Revenue" value={formatCurrency(metrics.revenue)} delta={metrics.revenueDelta} goodUp />
        <MetricCard title="Total Spend" value={formatCurrency(metrics.spend)} delta={metrics.spendDelta} />
        <MetricCard title="Contribution After Ads" value={formatCurrency(metrics.contribution)} delta={metrics.revenueDelta - metrics.spendDelta} goodUp />
        <MetricCard title="Blended ROAS" value={formatNumber(metrics.roas)} delta={metrics.roasDelta} goodUp />
        <MetricCard title="New CAC" value={formatCurrency(metrics.newCac)} delta={metrics.newCacDelta} />
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Channel Efficiency">
          <ChannelRow name="Meta" spend={metrics.metaSpend} revenue={metrics.metaRevenue} total={metrics.spend} />
          <ChannelRow name="Google" spend={metrics.googleSpend} revenue={metrics.googleRevenue} total={metrics.spend} />
          <ChannelRow name="Organic / Direct" spend={0} revenue={metrics.organicRevenue} total={metrics.spend} />
        </Panel>
        <Panel title="Customer Economics">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <DataTile label="New Customers" value={formatNumber(metrics.newCustomers, 0)} />
            <DataTile label="Repeat Customers" value={formatNumber(metrics.repeatCustomers, 0)} />
            <DataTile label="New Revenue" value={formatCurrency(metrics.newRevenue)} />
            <DataTile label="Repeat Revenue" value={formatCurrency(metrics.repeatRevenue)} />
            <DataTile label="New Revenue %" value={`${formatNumber(metrics.newRevenuePct)}%`} />
            <DataTile label="Repeat Revenue %" value={`${formatNumber(metrics.repeatRevenuePct)}%`} />
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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

function MetricCard({ title, value, delta, goodUp = false, status }: any) {
  const isGood = goodUp ? delta >= 0 : delta <= 0;
  return (
    <div className="group relative overflow-hidden rounded-[2rem] border border-white/70 bg-white p-5 shadow-2xl shadow-slate-200/70 transition hover:-translate-y-1 hover:shadow-slate-300/70">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-blue-600 to-emerald-400" />
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

function Panel({ title, children }: any) {
  return (
    <section className="rounded-[2rem] border border-white/70 bg-white p-6 shadow-2xl shadow-slate-200/70">
      <h3 className="mb-4 text-lg font-black tracking-tight">{title}</h3>
      {children}
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

function ProfitLine({ label, value }: any) {
  return <div className="flex justify-between rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm"><span className="font-bold text-slate-500">{label}</span><strong>{value}</strong></div>;
}
