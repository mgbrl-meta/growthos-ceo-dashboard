'use client';

import { CheckCircle2, Phone, ShoppingCart, UserCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export default function CallCommerceSummary({ start, end }: { start: string; end: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ start, end });
      const response = await fetch(`/api/call-commerce/summary?${query.toString()}`, {
        cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || 'Unable to load Call Commerce summary');
      }
      setData(body.data || {});
    } catch (error: any) {
      setError(error?.message || 'Unable to load Call Commerce summary');
    } finally {
      setLoading(false);
    }
  }, [start, end]);

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

  const metrics = [
    ['Calls', data?.calls || 0, Phone],
    ['Connected', data?.connected || 0, CheckCircle2],
    ['Qualified', data?.qualified || 0, UserCheck],
    ['Purchased', data?.purchased || 0, ShoppingCart],
    ['Revenue', `₹${Number(data?.revenue || 0).toLocaleString('en-IN')}`, ShoppingCart],
    ['Qualification Rate', `${Number(data?.qualification_rate || 0).toFixed(1)}%`, UserCheck],
    [
      'Qualified → Purchase',
      `${Number(data?.qualified_purchase_rate || 0).toFixed(1)}%`,
      CheckCircle2,
    ],
  ];

  return (
    <>
      {loading && <div className="text-[9px] text-slate-400">Refreshing…</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label, value, Icon]: any) => (
          <div key={label} className="gos-panel !p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                {label}
              </span>
              <Icon size={14} className="text-slate-400" />
            </div>
            <div className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950">
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="gos-panel !p-4">
        <h3 className="text-[11px] font-semibold text-slate-950">Call Commerce operating model</h3>
        <p className="mt-1 text-[10px] leading-5 text-slate-500">
          Incoming calls create or attach to a lead thread. Agents qualify, follow up,
          mark purchase manually, or close the lead. Product remains free text and
          purchase reference/value remain agent-entered.
        </p>
      </div>
    </>
  );
}
