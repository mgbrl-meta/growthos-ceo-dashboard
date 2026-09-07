'use client';

import type { ReactNode } from 'react';

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'slate';

type BaseProps = {
  className?: string;
};

export function GosPanel({ title, children, className = '' }: BaseProps & { title?: string; children: ReactNode }) {
  return (
    <section className={`gos-panel ${className}`}>
      {title ? <h3 className="gos-section-title mb-2.5">{title}</h3> : null}
      {children}
    </section>
  );
}

export function GosChartPanel({ title, children, className = '' }: BaseProps & { title: string; children: ReactNode }) {
  return (
    <section className={`gos-panel ${className}`}>
      <h3 className="gos-section-title mb-2">{title}</h3>
      {children}
    </section>
  );
}

export function GosMetricCard({
  title,
  value,
  delta = 0,
  goodUp = false,
  status,
  className = '',
}: BaseProps & {
  title: string;
  value: ReactNode;
  delta?: number;
  goodUp?: boolean;
  status?: string;
}) {
  const change = Number(delta || 0);
  const isGood = goodUp ? change >= 0 : change <= 0;

  return (
    <div className={`gos-card min-h-[82px] px-3 py-2.5 transition-colors duration-150 hover:border-slate-300 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="gos-label">{title}</p>
        <span className={`shrink-0 whitespace-nowrap text-[9px] font-semibold ${isGood ? 'text-emerald-600' : 'text-red-600'}`}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <h3 className="gos-kpi-value">{value}</h3>
        {status ? (
          <span className="gos-badge max-w-[104px] justify-center bg-slate-100 text-center text-slate-600">
            {status}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function GosDataTile({ label, value, className = '' }: BaseProps & { label: string; value: ReactNode }) {
  return (
    <div className={`gos-data-tile ${className}`}>
      <p className="gos-label">{label}</p>
      <p className="mt-1 text-[15px] font-semibold leading-tight tracking-[-0.02em] text-slate-950">{value}</p>
    </div>
  );
}

export function GosMiniStat({ label, value, className = '' }: BaseProps & { label: string; value: ReactNode }) {
  return (
    <div className={`min-h-[46px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 ${className}`}>
      <p className="text-[9px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-[11px] font-semibold leading-[15px] text-slate-900">{value}</p>
    </div>
  );
}

export function GosDriverRow({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3 border-b border-slate-100 py-1.5 first:pt-0 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-800">{label}</p>
        {note ? <p className="mt-0.5 truncate text-[9px] font-medium text-slate-500">{note}</p> : null}
      </div>
      <strong className="shrink-0 text-[12px] font-semibold tracking-[-0.015em] text-slate-950">{value}</strong>
    </div>
  );
}

export function GosValueRow({ label, value, className = '' }: BaseProps & { label: string; value: ReactNode }) {
  return (
    <div className={`flex min-h-[36px] items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 ${className}`}>
      <span className="text-[10px] font-medium text-slate-500">{label}</span>
      <strong className="text-[11px] font-semibold text-slate-950">{value}</strong>
    </div>
  );
}

export function GosAlert({ tone, title, text, className = '' }: BaseProps & { tone: 'red' | 'amber' | 'green'; title: string; text: string }) {
  const cls = tone === 'red'
    ? 'border-red-200 bg-red-50 text-red-900'
    : tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-emerald-200 bg-emerald-50 text-emerald-900';

  return (
    <div className={`rounded-lg border px-2.5 py-2 ${cls} ${className}`}>
      <h4 className="text-[10px] font-semibold leading-4">{title}</h4>
      <p className="mt-0.5 text-[9px] font-medium leading-[14px] opacity-75">{text}</p>
    </div>
  );
}

export function GosLoadingCard({ text }: { text: string }) {
  return <div className="gos-panel text-[11px] font-medium text-slate-500">{text}</div>;
}

export function GosEmptyState({
  title,
  text,
  children,
  className = '',
}: BaseProps & { title?: string; text?: string; children?: ReactNode }) {
  return (
    <div className={`rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 ${className}`}>
      {title ? <h3 className="text-[12px] font-semibold text-slate-900">{title}</h3> : null}
      {text ? <p className="mt-1 text-[10px] font-medium leading-4 text-slate-500">{text}</p> : null}
      {children ? <div className={title || text ? 'mt-1' : ''}>{children}</div> : null}
    </div>
  );
}

export function GosCampaignPicker({
  campaigns,
  value,
  onChange,
  label = 'Campaign',
}: {
  campaigns: string[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const safeCampaigns = Array.isArray(campaigns) ? campaigns : [];
  return (
    <div className="gos-card flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <label className="gos-label">{label}</label>
      <select
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        disabled={safeCampaigns.length === 0}
        className="gos-select w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-80"
      >
        {safeCampaigns.length === 0 ? <option value="">No campaigns available</option> : null}
        {safeCampaigns.map((campaign) => (
          <option key={campaign} value={campaign}>{campaign}</option>
        ))}
      </select>
    </div>
  );
}

export function GosStatusBadge({ status, tone }: { status: ReactNode; tone?: Tone }) {
  const inferred: Tone = tone || (
    status === 'SCALE' ? 'green' :
    status === 'KILL' ? 'red' :
    status === 'TEST' ? 'blue' :
    'slate'
  );
  const cls = inferred === 'green'
    ? 'bg-emerald-100 text-emerald-700'
    : inferred === 'red'
      ? 'bg-red-100 text-red-700'
      : inferred === 'amber'
        ? 'bg-amber-100 text-amber-700'
        : inferred === 'blue'
          ? 'bg-blue-100 text-blue-700'
          : 'bg-slate-200 text-slate-600';
  return <span className={`gos-badge shrink-0 whitespace-nowrap ${cls}`}>{status}</span>;
}

export function GosDecisionRow({
  title,
  subtitle,
  status,
  children,
  className = '',
}: BaseProps & {
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-[10px] border border-slate-200 bg-slate-50/70 p-3 ${className}`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-[11px] font-semibold text-slate-900">{title}</h4>
          {subtitle ? <p className="mt-0.5 text-[9px] font-medium leading-[14px] text-slate-500">{subtitle}</p> : null}
        </div>
        {status ? <GosStatusBadge status={status} /> : null}
      </div>
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-6">{children}</div>
    </div>
  );
}

export function GosSummaryTile({
  title,
  value,
  text,
  tone = 'slate',
}: {
  title: string;
  value: ReactNode;
  text?: ReactNode;
  tone?: Tone;
}) {
  const cls = tone === 'red'
    ? 'border-red-200 bg-red-50 text-red-900'
    : tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : tone === 'blue'
        ? 'border-blue-200 bg-blue-50 text-blue-900'
        : tone === 'green'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-slate-200 bg-slate-50 text-slate-900';
  return (
    <div className={`min-h-[72px] rounded-[10px] border px-3 py-2.5 ${cls}`}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.06em] opacity-70">{title}</p>
      <p className="mt-1 text-[20px] font-bold leading-none tracking-[-0.03em]">{value}</p>
      {text ? <p className="mt-1.5 text-[9px] font-medium leading-[13px] opacity-75">{text}</p> : null}
    </div>
  );
}
