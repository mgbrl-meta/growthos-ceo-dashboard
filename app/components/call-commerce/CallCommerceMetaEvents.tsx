'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCallCommerceDate } from './utils';

export default function CallCommerceMetaEvents() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/call-commerce/meta-events?limit=100', {
        cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || 'Unable to load Meta events');
      }
      setRows(Array.isArray(body.data) ? body.data : []);
    } catch (error: any) {
      setError(error?.message || 'Unable to load Meta events');
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

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-left text-[9px]">
        <thead className="bg-slate-50">
          <tr>
            {['Event', 'Lead', 'Event ID', 'Status', 'Attempts', 'Created'].map(label => (
              <th key={label} className="px-3 py-2 font-semibold text-slate-500">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={6} className="p-8 text-center">
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-8 text-center text-slate-400">
                No Meta events yet.
              </td>
            </tr>
          ) : (
            rows.map(row => (
              <tr key={row.queue_id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold">{row.event_name}</td>
                <td className="px-3 py-2">{row.lead_id}</td>
                <td className="px-3 py-2 font-mono">{row.event_id}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">{row.attempts}</td>
                <td className="px-3 py-2">{formatCallCommerceDate(row.created_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
