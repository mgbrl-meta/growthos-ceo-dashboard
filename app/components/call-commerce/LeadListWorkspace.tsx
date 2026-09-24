'use client';

import {
  Filter,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import LeadDrawer from './LeadDrawer';
import LeadTable from './LeadTable';
import ManualCallModal from './ManualCallModal';
import { duration, integer } from './utils';

export default function LeadListWorkspace({
  start = '',
  end = '',
  endpoint = '/api/call-commerce/calls',
  archived = false,
}: {
  start?: string;
  end?: string;
  endpoint?: string;
  archived?: boolean;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<any>({});
  const [archiveFacets, setArchiveFacets] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [callStatus, setCallStatus] = useState('');
  const [agent, setAgent] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');

  const [selected, setSelected] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');

      try {
        const query = new URLSearchParams({
          page: String(page),
          limit: String(pageSize),
          status,
          search,
          callStatus,
          agent,
          businessNumber,
        });

        const response = await fetch(`${endpoint}?${query.toString()}`, {
          cache: 'no-store',
        });
        const body = await response.json();

        if (!response.ok || !body?.ok) {
          throw new Error(body?.error || 'Unable to load Call Commerce');
        }

        setRows(Array.isArray(body.data?.rows) ? body.data.rows : []);
        setTotal(Number(body.data?.total || 0));

        if (archived) {
          setArchiveFacets(body.data?.facets || {});
        }
      } catch (error: any) {
        setError(error?.message || 'Unable to load Call Commerce');
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [
      endpoint,
      page,
      search,
      status,
      callStatus,
      agent,
      businessNumber,
      archived,
    ]
  );

  const loadSummary = useCallback(async () => {
    if (archived) return;
    try {
      const query = new URLSearchParams({ start, end });
      const response = await fetch(
        `/api/call-commerce/summary?${query.toString()}`,
        { cache: 'no-store' }
      );
      const body = await response.json();
      if (response.ok && body?.ok) setSummary(body.data || {});
    } catch {
      // Calls remain usable if summary enrichment is temporarily unavailable.
    }
  }, [start, end, archived]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load(true);
      }
    }, 30000);

    return () => window.clearInterval(timer);
  }, [load]);

  const agents = archived
    ? (
        Array.isArray(archiveFacets?.agents)
          ? archiveFacets.agents
              .map((item: any) => String(item.agent || ''))
              .filter(Boolean)
          : []
      )
    : (
        Array.isArray(summary?.agent_performance)
          ? summary.agent_performance
              .map((item: any) => String(item.agent_name || ''))
              .filter(Boolean)
          : []
      );

  const businessNumbers = archived
    ? (
        Array.isArray(archiveFacets?.business_numbers)
          ? archiveFacets.business_numbers
              .map((item: any) => String(item.business_number || ''))
              .filter(Boolean)
          : []
      )
    : (
        Array.isArray(summary?.business_numbers)
          ? summary.business_numbers
              .map((item: any) => String(item.business_number || ''))
              .filter(Boolean)
          : []
      );

  async function openLead(lead: any) {
    setSelected(lead);
    setHistory(null);
    setHistoryLoading(true);

    try {
      const response = await fetch(
        `/api/call-commerce/calls/${encodeURIComponent(lead.lead_id)}`,
        { cache: 'no-store' }
      );
      const body = await response.json();

      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || 'Unable to load call history');
      }
      setHistory(body.data || {});
    } catch (error: any) {
      setHistory({
        attempts: [],
        activity: [],
        error: error?.message || 'Unable to load history',
      });
    } finally {
      setHistoryLoading(false);
    }
  }

  async function action(
    actionName: string,
    payload: Record<string, unknown> = {},
    keepOpen = false
  ) {
    if (!selected) return;

    const response = await fetch(
      `/api/call-commerce/calls/${encodeURIComponent(
        selected.lead_id
      )}/workflow`,
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
      window.alert(body?.error || 'Action failed');
      return;
    }

    await Promise.all([load(), loadSummary()]);

    if (keepOpen) {
      setSelected((prev: any) => ({
        ...prev,
        ...(actionName === 'update_details'
          ? {
              customer_name: payload.customerName ?? prev.customer_name,
              email: payload.email ?? prev.email,
              product: payload.product ?? prev.product,
              notes: payload.notes ?? prev.notes,
              next_follow_up_at:
                payload.nextFollowUpAt ?? prev.next_follow_up_at,
            }
          : {}),
      }));
      return;
    }

    setSelected(null);
    setHistory(null);
  }

  const kpis = archived
    ? []
    : [
        ['Total Calls', integer(summary?.total_calls || 0), 'text-blue-600'],
        ['Answered', integer(summary?.answered || 0), 'text-emerald-600'],
        ['No Answer', integer(summary?.no_answer || 0), 'text-rose-600'],
        [
          'Caller Dropped',
          integer(summary?.caller_dropped || 0),
          'text-amber-600',
        ],
        [
          'Avg Talk',
          duration(summary?.avg_talk_time_seconds || 0),
          'text-violet-600',
        ],
      ];

  return (
    <div className="space-y-4">
      {kpis.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {kpis.map(([label, value, color]) => (
            <div
              key={label}
              className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm"
            >
              <div className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">
                {label}
              </div>
              <div className={`mt-1.5 text-[18px] font-semibold ${color}`}>
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by phone, customer, email, product or order ID…"
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-[10px] outline-none focus:border-slate-400"
            />
          </div>

          <Select
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              ['', 'All lead statuses'],
              ['NEW', 'New'],
              ['QUALIFIED', 'Qualified'],
              ['FOLLOW_UP', 'Follow Up'],
              ['PURCHASED', 'Purchased'],
              ['UNQUALIFIED', 'Unqualified'],
              ['CLOSED_LOST', 'Closed Lost'],
            ]}
          />

          <Select
            value={callStatus}
            onChange={(value) => {
              setCallStatus(value);
              setPage(1);
            }}
            options={[
              ['', 'All call outcomes'],
              ['ANSWERED', 'Answered'],
              ['NO_ANSWER', 'No Answer'],
              ['CALLER_DROPPED', 'Caller Dropped'],
              ['UNKNOWN', 'Unknown'],
              ['RINGING', 'Ringing'],
            ]}
          />

          <Select
            value={agent}
            onChange={(value) => {
              setAgent(value);
              setPage(1);
            }}
            options={[
              ['', 'All agents'],
              ...agents.map((value: string) => [value, value]),
            ]}
          />

          {businessNumbers.length > 0 && (
            <Select
              value={businessNumber}
              onChange={(value) => {
                setBusinessNumber(value);
                setPage(1);
              }}
              options={[
                ['', 'All business numbers'],
                ...businessNumbers.map((value: string) => [value, value]),
              ]}
            />
          )}

          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-[9px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={12} />
            Refresh
          </button>

          {!archived && (
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2.5 text-[9px] font-semibold text-white"
            >
              <Plus size={12} />
              Manual Call
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between text-[8px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Filter size={10} />
            {integer(total)} matching leads
          </div>
          {!archived && (
            <div className="flex items-center gap-1.5">
              <PhoneCall size={10} />
              Auto-refresh every 30s while this tab is visible
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[9px] text-red-700">
          {error}
        </div>
      )}

      <LeadTable
        rows={rows}
        page={page}
        pageSize={pageSize}
        total={total}
        loading={loading}
        onOpen={openLead}
        onPageChange={setPage}
      />

      {selected && (
        <LeadDrawer
          lead={selected}
          history={history}
          loading={historyLoading}
          onClose={() => {
            setSelected(null);
            setHistory(null);
          }}
          onAction={action}
        />
      )}

      <ManualCallModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={() => {
          setPage(1);
          void Promise.all([load(), loadSummary()]);
        }}
      />
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[9px] font-medium text-slate-600 outline-none focus:border-slate-400"
    >
      {options.map(([key, label]) => (
        <option key={`${key}-${label}`} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}
