'use client';

import {
  BarChart3,
  ChevronDown,
  Download,
  FileSpreadsheet,
  IndianRupee,
  RefreshCw,
  ShoppingCart,
  UserCheck,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { currency, duration, integer, percent } from './utils';

export default function CallCommerceReports({
  start = '',
  end = '',
}: {
  start?: string;
  end?: string;
}) {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ start, end });
      const response = await fetch(
        `/api/call-commerce/summary?${query.toString()}`,
        { cache: 'no-store' }
      );
      const body = await response.json();
      if (response.ok && body?.ok) setData(body.data || {});
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (
        exportRef.current &&
        !exportRef.current.contains(event.target as Node)
      ) {
        setExportOpen(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  function exportUrl(type: string, format: 'csv' | 'xlsx') {
    const query = new URLSearchParams({
      type,
      format,
      start,
      end,
    });

    return `/api/call-commerce/reports/export?${query.toString()}`;
  }

  function triggerExport(type: string, format: 'csv' | 'xlsx') {
    setExportOpen(false);
    window.location.href = exportUrl(type, format);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h3 className="text-[12px] font-semibold text-slate-950">
            Call Commerce reports
          </h3>
          <p className="mt-1 text-[9px] text-slate-400">
            Commercial, operational and downloadable Call Commerce reporting
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw
              size={12}
              className={loading ? 'animate-spin' : ''}
            />
            Refresh
          </button>

          <div ref={exportRef} className="relative">
            <button
              onClick={() => setExportOpen((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-semibold text-white"
            >
              <Download size={12} />
              Export
              <ChevronDown size={11} />
            </button>

            {exportOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[330px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 px-3 py-2.5">
                  <div className="text-[9px] font-semibold text-slate-800">
                    Export Call Commerce
                  </div>
                  <div className="mt-0.5 text-[8px] text-slate-400">
                    Uses the current brand and selected date range
                  </div>
                </div>

                <div className="p-2">
                  {[
                    ['call-attempts', 'Call Attempts', 'One row per CA_* attempt'],
                    ['leads', 'Lead Report', 'One row per CL_* lead'],
                    ['agent-performance', 'Agent Performance', 'Agent operational metrics'],
                    ['commercial', 'Commercial Report', 'Lead funnel and revenue'],
                    ['meta-events', 'Meta Events', 'Delivery and error log'],
                  ].map(([type, label, helper]) => (
                    <div
                      key={type}
                      className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="text-[9px] font-semibold text-slate-700">
                          {label}
                        </div>
                        <div className="mt-0.5 text-[7px] text-slate-400">
                          {helper}
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => triggerExport(type, 'csv')}
                          className="rounded-md border border-slate-200 px-2 py-1 text-[7px] font-semibold text-slate-500 hover:bg-white"
                        >
                          CSV
                        </button>
                        <button
                          onClick={() => triggerExport(type, 'xlsx')}
                          className="rounded-md border border-slate-200 px-2 py-1 text-[7px] font-semibold text-slate-500 hover:bg-white"
                        >
                          XLSX
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 p-2">
                  <button
                    onClick={() => triggerExport('full', 'xlsx')}
                    className="flex w-full items-center justify-between rounded-lg bg-slate-950 px-3 py-2.5 text-left text-white"
                  >
                    <div>
                      <div className="text-[9px] font-semibold">
                        Full Call Commerce Workbook
                      </div>
                      <div className="mt-0.5 text-[7px] text-slate-300">
                        Summary + Leads + Attempts + Agents + Meta + nuances
                      </div>
                    </div>
                    <FileSpreadsheet size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Qualified Leads"
          value={integer(data.qualified)}
          helper={percent(data.qualification_rate)}
          icon={<UserCheck size={15} />}
        />
        <Metric
          label="Purchases"
          value={integer(data.purchased)}
          helper={percent(data.call_purchase_rate)}
          icon={<ShoppingCart size={15} />}
        />
        <Metric
          label="Revenue"
          value={currency(data.revenue)}
          helper={`${currency(data.avg_order_value)} avg order`}
          icon={<IndianRupee size={15} />}
        />
        <Metric
          label="Total Talk Time"
          value={duration(data.total_talk_time_seconds)}
          helper={`${duration(data.avg_talk_time_seconds)} avg answered`}
          icon={<BarChart3 size={15} />}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-[11px] font-semibold text-slate-950">
            Agent performance report
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[850px] w-full">
            <thead>
              <tr className="bg-slate-50/70">
                {[
                  'Agent',
                  'Calls',
                  'Answered',
                  'No Answer',
                  'Caller Dropped',
                  'Answer Rate',
                  'Avg Talk',
                  'Total Talk',
                ].map((label) => (
                  <th
                    key={label}
                    className="px-4 py-3 text-left text-[8px] font-semibold uppercase tracking-wide text-slate-400"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {(Array.isArray(data.agent_performance)
                ? data.agent_performance
                : []
              ).map((row: any) => (
                <tr key={row.agent_name} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-[9px] font-semibold text-slate-800">
                    {row.agent_name}
                  </td>
                  <td className="px-4 py-3 text-[9px] text-slate-600">
                    {integer(row.calls)}
                  </td>
                  <td className="px-4 py-3 text-[9px] text-slate-600">
                    {integer(row.answered)}
                  </td>
                  <td className="px-4 py-3 text-[9px] text-slate-600">
                    {integer(row.no_answer)}
                  </td>
                  <td className="px-4 py-3 text-[9px] text-slate-600">
                    {integer(row.caller_dropped)}
                  </td>
                  <td className="px-4 py-3 text-[9px] text-slate-600">
                    {percent(row.answer_rate)}
                  </td>
                  <td className="px-4 py-3 text-[9px] text-slate-600">
                    {duration(row.avg_talk_time_seconds)}
                  </td>
                  <td className="px-4 py-3 text-[9px] text-slate-600">
                    {duration(row.total_talk_time_seconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </div>
          <div className="mt-2 text-[20px] font-semibold text-slate-950">
            {value}
          </div>
          <div className="mt-1 text-[8px] text-slate-400">{helper}</div>
        </div>
        <div className="text-slate-400">{icon}</div>
      </div>
    </div>
  );
}
