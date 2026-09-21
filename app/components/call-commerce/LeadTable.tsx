'use client';

import StatusPill from './StatusPill';
import { formatCallCommerceDate } from './utils';

export default function LeadTable({
  rows,
  onOpen,
  loading,
}: {
  rows: any[];
  onOpen: (row: any) => void;
  loading: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[9px]">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {[
                'Lead',
                'Phone',
                'Status',
                'Product',
                'Latest call',
                'Attempts',
                'Agent',
                'Order',
                'Updated',
              ].map(label => (
                <th key={label} className="px-3 py-2 font-semibold">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                  No call leads found.
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr
                  key={row.lead_id}
                  onClick={() => onOpen(row)}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 py-2 font-semibold text-slate-900">
                    {row.customer_name || row.lead_id}
                  </td>
                  <td className="px-3 py-2">{row.phone}</td>
                  <td className="px-3 py-2">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="px-3 py-2">{row.product || '—'}</td>
                  <td className="px-3 py-2">
                    <div>{row.latest_call_status || '—'}</div>
                    {(row.latest_business_number || row.latest_duration_seconds != null) && (
                      <div className="mt-0.5 text-[8px] text-slate-400">
                        {row.latest_business_number || '—'}
                        {row.latest_duration_seconds != null
                          ? ` · ${Number(row.latest_duration_seconds || 0)}s`
                          : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">{row.call_attempt_count || 0}</td>
                  <td className="px-3 py-2">{row.latest_agent_name || '—'}</td>
                  <td className="px-3 py-2">
                    {row.order_id
                      ? `${row.order_id} · ₹${Number(row.order_amount || 0).toLocaleString('en-IN')}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {formatCallCommerceDate(row.updated_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
