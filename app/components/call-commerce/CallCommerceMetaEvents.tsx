'use client';

import { RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDateTime, integer } from './utils';

export default function CallCommerceMetaEvents() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/call-commerce/meta-events?limit=200', {
        cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || 'Unable to load Meta events');
      }
      const data = body.data;
      setRows(Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : []);
    } catch (error: any) {
      setError(error?.message || 'Unable to load Meta events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const success = rows.filter((row) => String(row.status).toUpperCase() === 'SUCCESS').length;
    const pending = rows.filter((row) => String(row.status).toUpperCase() === 'PENDING').length;
    const retry = rows.filter((row) => String(row.status).toUpperCase() === 'RETRY').length;
    const attention = rows.filter((row) => String(row.status).toUpperCase() === 'NEEDS_ATTENTION').length;
    return {
      total: rows.length,
      success,
      pending,
      retry,
      attention,
      rate: rows.length ? (success / rows.length) * 100 : 0,
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Events', summary.total, 'text-slate-900'],
          ['Success', summary.success, 'text-emerald-600'],
          ['Pending', summary.pending, 'text-blue-600'],
          ['Retry', summary.retry, 'text-amber-600'],
          ['Needs Attention', summary.attention, 'text-rose-600'],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
            <div className={`mt-2 text-[22px] font-semibold ${color}`}>{integer(value)}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold text-slate-950">Meta delivery health</div>
            <div className="mt-1 text-[9px] text-slate-400">
              Success rate across the latest {integer(rows.length)} queued Call Commerce events
            </div>
          </div>
          <div className="text-right">
            <div className="text-[20px] font-semibold text-slate-950">{summary.rate.toFixed(1)}%</div>
            <div className="text-[8px] text-slate-400">success rate</div>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${summary.rate}%` }} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="text-[11px] font-semibold text-slate-950">Event delivery log</h3>
            <p className="mt-1 text-[8px] text-slate-400">Call-derived events queued for Meta delivery</p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[9px] font-semibold text-slate-600"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="p-4 text-[9px] text-red-700">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[940px] w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  {['Created', 'Event', 'Lead', 'Status', 'Attempts', 'Event ID', 'Action'].map((label) => (
                    <th key={label} className="px-4 py-3 text-left text-[8px] font-semibold uppercase tracking-wide text-slate-400">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((row) => (
                    <tr key={row.queue_id || row.event_id} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-4 py-3 text-[9px] text-slate-500">{formatDateTime(row.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="text-[9px] font-semibold text-slate-800">{row.event_name || row.event_key || '—'}</div>
                        <div className="mt-0.5 text-[8px] text-slate-400">{row.event_key || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-[9px] text-slate-600">{row.lead_id || '—'}</td>
                      <td className="px-4 py-3"><MetaStatus status={row.status} /></td>
                      <td className="px-4 py-3 text-[9px] text-slate-600">{integer(row.attempts)}</td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-[8px] text-slate-400">{row.event_id || '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelected(row)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[8px] font-semibold text-slate-600">
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-[10px] text-slate-400">
                      {loading ? 'Loading Meta events…' : 'No Meta events queued yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/20">
          <div className="h-full w-full max-w-[480px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <div className="text-[12px] font-semibold text-slate-950">Meta event detail</div>
                <div className="mt-1 text-[8px] text-slate-400">{selected.event_id}</div>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-400">
                <X size={15} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <Detail label="Event" value={selected.event_name || selected.event_key} />
                <Detail label="Status" value={selected.status} />
                <Detail label="Lead" value={selected.lead_id} />
                <Detail label="Call" value={selected.call_id} />
                <Detail label="Attempts" value={selected.attempts} />
                <Detail label="Next Attempt" value={formatDateTime(selected.next_attempt_at)} />
                <Detail label="Created" value={formatDateTime(selected.created_at)} />
                <Detail label="Updated" value={formatDateTime(selected.updated_at)} />
              </div>

              {selected.last_error && (
                <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-[9px] text-red-700">
                  {selected.last_error}
                </div>
              )}

              <details className="rounded-xl border border-slate-200">
                <summary className="cursor-pointer px-4 py-3 text-[9px] font-semibold text-slate-700">
                  Advanced payload
                </summary>
                <pre className="max-h-[420px] overflow-auto border-t border-slate-100 bg-slate-50 p-4 text-[8px] leading-4 text-slate-600">
                  {JSON.stringify(selected.payload ?? {}, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaStatus({ status }: { status: unknown }) {
  const value = String(status || 'UNKNOWN').toUpperCase();
  const cls =
    value === 'SUCCESS'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : value === 'PENDING'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : value === 'RETRY'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-rose-200 bg-rose-50 text-rose-700';

  return <span className={`rounded-full border px-2 py-1 text-[8px] font-semibold ${cls}`}>{value}</span>;
}

function Detail({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-[7px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 break-words text-[9px] font-medium text-slate-700">
        {value === null || value === undefined || value === '' ? '—' : String(value)}
      </div>
    </div>
  );
}
