'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCallCommerceDate } from './utils';

export default function CallCommerceSystemStatus() {
  const [data, setData] = useState<any>(null);
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

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-[11px] text-red-700">
        {error}
        <button onClick={load} className="ml-3 font-semibold underline">
          Retry
        </button>
      </div>
    );
  }

  if (loading || !data) {
    return <div className="text-[10px] text-slate-400">Loading…</div>;
  }

  const cards = [
    ['Calling Connections', `${data?.calling?.active || 0}/${data?.calling?.total || 0} active`],
    ['Last Calling Event', formatCallCommerceDate(data?.calling?.last_event_at)],
    ['Active Leads', data?.leads?.active_leads || 0],
    ['Last Call', formatCallCommerceDate(data?.leads?.last_call_at)],
    ['Meta Pending', data?.meta?.pending || 0],
    ['Meta Retry', data?.meta?.retry || 0],
    ['Meta Needs Attention', data?.meta?.needs_attention || 0],
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value]) => (
        <div key={String(label)} className="gos-panel !p-3.5">
          <div className="text-[9px] uppercase text-slate-400">{label}</div>
          <div className="mt-2 text-[14px] font-semibold text-slate-900">{String(value)}</div>
        </div>
      ))}
    </div>
  );
}
