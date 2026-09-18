'use client';

import { Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import LeadDrawer from './LeadDrawer';
import LeadTable from './LeadTable';
import ManualCallModal from './ManualCallModal';

type Props = {
  endpoint: '/api/call-commerce/calls' | '/api/call-commerce/archive' | '/api/call-commerce/reports';
  allowManualCall?: boolean;
};

export default function LeadListWorkspace({ endpoint, allowManualCall = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>({ rows: [], total: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [manualOpen, setManualOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const query = new URLSearchParams({
        search,
        status,
        page: String(page),
        limit: String(pageSize),
      });
      const response = await fetch(`${endpoint}?${query.toString()}`, {
        cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || 'Unable to load Call Commerce');
      }
      setData(body.data || { rows: [], total: 0 });
    } catch (error: any) {
      setError(error?.message || 'Unable to load Call Commerce');
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, pageSize, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openLead(lead: any) {
    setSelected(lead);
    setHistory(null);
    const response = await fetch(
      `/api/call-commerce/calls/${encodeURIComponent(lead.lead_id)}`,
      { cache: 'no-store' }
    );
    const body = await response.json();
    if (body?.ok) setHistory(body.data);
  }

  async function action(actionName: string, payload: any = {}) {
    if (!selected) return;

    const response = await fetch(
      `/api/call-commerce/calls/${encodeURIComponent(selected.lead_id)}/workflow`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: actionName,
          data: payload,
        }),
      }
    );
    const body = await response.json();
    if (!response.ok || !body?.ok) {
      alert(body?.error || 'Action failed');
      return;
    }

    setSelected(null);
    await load();
  }

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
    <div className="space-y-3">
      <div className="gos-panel !p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && void load()}
                placeholder="Search phone, customer, product, order"
                className="h-8 w-72 rounded-lg border border-slate-200 pl-8 pr-2 text-[10px]"
              />
            </div>

            <select
              value={status}
              onChange={event => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[10px]"
            >
              <option value="">All stages</option>
              {['NEW', 'QUALIFIED', 'FOLLOW_UP', 'PURCHASED', 'UNQUALIFIED', 'CLOSED_LOST'].map(
                item => (
                  <option key={item}>{item}</option>
                )
              )}
            </select>

            <button
              onClick={load}
              className="h-8 rounded-lg border border-slate-200 px-3 text-[9px] font-semibold"
            >
              Search
            </button>
          </div>

          {allowManualCall && (
            <button
              onClick={() => setManualOpen(true)}
              className="h-8 rounded-lg bg-slate-950 px-3 text-[9px] font-semibold text-white"
            >
              + Manual Call
            </button>
          )}
        </div>
      </div>

      <LeadTable rows={data?.rows || []} onOpen={openLead} loading={loading} />

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
        <span className="text-[9px] text-slate-500">{data?.total || 0} records</span>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={event => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="h-7 rounded border border-slate-200 text-[9px]"
          >
            {[20, 50, 100, 200, 500].map(size => (
              <option key={size}>{size}</option>
            ))}
          </select>

          <button
            disabled={page <= 1}
            onClick={() => setPage(value => Math.max(1, value - 1))}
            className="rounded border border-slate-200 px-2 py-1 text-[9px] disabled:opacity-40"
          >
            Previous
          </button>

          <span className="text-[9px]">Page {page}</span>

          <button
            disabled={page * pageSize >= (data?.total || 0)}
            onClick={() => setPage(value => value + 1)}
            className="rounded border border-slate-200 px-2 py-1 text-[9px] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {selected && (
        <LeadDrawer
          lead={selected}
          history={history}
          onClose={() => setSelected(null)}
          onAction={action}
        />
      )}

      {manualOpen && (
        <ManualCallModal
          onClose={() => setManualOpen(false)}
          onSaved={async () => {
            setManualOpen(false);
            await load();
          }}
        />
      )}
    </div>
  );
}
