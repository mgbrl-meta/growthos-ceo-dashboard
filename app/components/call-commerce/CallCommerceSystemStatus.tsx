'use client';

import {
  Activity,
  CheckCircle2,
  Database,
  PhoneCall,
  RefreshCw,
  Send,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { formatDateTime, integer, timeAgo } from './utils';

export default function CallCommerceSystemStatus() {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/call-commerce/system-status', {
        cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || 'Unable to load system status');
      }
      setData(body.data || {});
    } catch (error: any) {
      setError(error?.message || 'Unable to load system status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const calling = data?.calling || {};
  const meta = data?.meta || {};
  const leads = data?.leads || {};
  const callingHealthy = Number(calling.active || 0) > 0;
  const metaHealthy = Number(meta.needs_attention || 0) === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h3 className="text-[12px] font-semibold text-slate-950">Call Commerce system health</h3>
          <p className="mt-1 text-[9px] text-slate-400">Operational visibility without opening GCP or BigQuery</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[9px] font-semibold text-slate-600">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-[9px] text-red-700">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HealthCard label="Calling Connections" value={`${integer(calling.active)} active`} helper={`${integer(calling.total)} configured`} healthy={callingHealthy} icon={<PhoneCall size={16} />} />
        <HealthCard label="Meta Queue" value={`${integer(meta.pending)} pending`} helper={`${integer(meta.retry)} retry · ${integer(meta.needs_attention)} attention`} healthy={metaHealthy} icon={<Send size={16} />} />
        <HealthCard label="Active Leads" value={integer(leads.active_leads)} helper={`Last call ${timeAgo(leads.last_call_at)}`} healthy icon={<Users size={16} />} />
        <HealthCard label="Warehouse" value="BigQuery" helper="growthos_call_commerce · asia-south1" healthy icon={<Database size={16} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-[11px] font-semibold text-slate-950">Calling connection health</h3>
          <div className="mt-4 space-y-3">
            <Row label="Configured connections" value={integer(calling.total)} />
            <Row label="Active connections" value={integer(calling.active)} />
            <Row label="Last provider event" value={formatDateTime(calling.last_event_at)} />
            <Row label="Last successful processing" value={formatDateTime(calling.last_success_at)} />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-[11px] font-semibold text-slate-950">Meta delivery queue</h3>
          <div className="mt-4 space-y-3">
            <Row label="Pending" value={integer(meta.pending)} />
            <Row label="Retry" value={integer(meta.retry)} />
            <Row label="Needs attention" value={integer(meta.needs_attention)} />
            <Row label="Queue state" value={metaHealthy ? 'Healthy' : 'Needs attention'} />
          </div>
        </section>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-slate-400" />
          <h3 className="text-[11px] font-semibold text-slate-950">Runtime architecture</h3>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[9px] font-medium text-slate-600">
          {['Calling Provider', 'Vercel Webhook', 'Pub/Sub', 'Cloud Run Worker', 'BigQuery'].map((item, index, all) => (
            <span key={item} className="flex items-center gap-2">
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">{item}</span>
              {index < all.length - 1 && <span className="text-slate-300">→</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function HealthCard({
  label,
  value,
  helper,
  healthy,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  healthy: boolean;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
          <div className="mt-2 text-[17px] font-semibold text-slate-950">{value}</div>
          <div className="mt-1 text-[8px] text-slate-400">{helper}</div>
        </div>
        <div className={healthy ? 'text-emerald-600' : 'text-amber-600'}>{icon}</div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[8px] font-semibold">
        <CheckCircle2 size={11} className={healthy ? 'text-emerald-600' : 'text-amber-600'} />
        <span className={healthy ? 'text-emerald-700' : 'text-amber-700'}>
          {healthy ? 'Healthy' : 'Needs attention'}
        </span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
      <span className="text-[9px] text-slate-500">{label}</span>
      <span className="text-[9px] font-semibold text-slate-800">{value}</span>
    </div>
  );
}
