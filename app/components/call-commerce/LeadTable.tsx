'use client';

import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import StatusPill, { WorkflowStatusPill } from './StatusPill';
import {
  callOutcome,
  duration,
  formatDateTime,
  integer,
  normalizeDisplayPhone,
} from './utils';

export default function LeadTable({
  rows,
  page,
  pageSize,
  total,
  onOpen,
  onPageChange,
  loading,
}: {
  rows: any[];
  page: number;
  pageSize: number;
  total: number;
  onOpen: (lead: any) => void;
  onPageChange: (page: number) => void;
  loading: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[900px] w-full table-fixed">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[16%]" />
            <col className="w-[13%]" />
            <col className="w-[16%]" />
            <col className="w-[13%]" />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
            <col className="w-[7%]" />
          </colgroup>

          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              {[
                ['Customer', 'left'],
                ['Latest Outcome', 'left'],
                ['Agent', 'left'],
                ['Last Call', 'left'],
                ['Attempts', 'left'],
                ['Duration', 'right'],
                ['Lead Status', 'left'],
                ['', 'right'],
              ].map(([label, align], index) => (
                <th
                  key={`${label}-${index}`}
                  className={`px-3 py-2.5 text-[8px] font-semibold uppercase tracking-[0.06em] text-slate-400 ${
                    align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length ? (
              rows.map((lead) => {
                const outcome = callOutcome(lead);
                const hasName = Boolean(String(lead.customer_name || '').trim());

                return (
                  <tr
                    key={lead.lead_id}
                    onDoubleClick={() => onOpen(lead)}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                  >
                    <td className="px-3 py-2.5">
                      <div className="truncate text-[10px] font-semibold text-slate-900">
                        {hasName
                          ? lead.customer_name
                          : normalizeDisplayPhone(lead.phone)}
                      </div>
                      {hasName && (
                        <div className="mt-0.5 truncate text-[8px] text-slate-400">
                          {normalizeDisplayPhone(lead.phone)}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2.5">
                      <StatusPill value={lead} />
                      <div className="mt-1 truncate text-[8px] text-slate-400">
                        {outcome.detail}
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="truncate text-[9px] font-medium text-slate-700">
                        {lead.latest_agent_name || 'Unassigned'}
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="text-[8px] font-medium leading-4 text-slate-700">
                        {formatDateTime(lead.latest_call_at)}
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 whitespace-nowrap text-[8px]">
                        <span className="font-semibold text-slate-800">
                          T {integer(lead.call_attempt_count)}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-emerald-600">
                          A {integer(lead.answered_attempt_count)}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-rose-500">
                          U {integer(lead.unanswered_attempt_count)}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-2.5 text-right text-[9px] text-slate-600">
                      {duration(lead.latest_duration_seconds)}
                    </td>

                    <td className="px-3 py-2.5">
                      <WorkflowStatusPill status={lead.status} />
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onOpen(lead)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                        title="Open lead"
                      >
                        <ExternalLink size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-[10px] text-slate-400"
                >
                  {loading
                    ? 'Loading calls…'
                    : 'No leads match the current filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
        <div className="text-[9px] text-slate-400">
          Showing {from}–{to} of {integer(total)} leads
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 disabled:opacity-30"
          >
            <ChevronLeft size={13} />
          </button>

          <span className="min-w-[80px] text-center text-[9px] font-medium text-slate-500">
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 disabled:opacity-30"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
