'use client';

import { useState } from 'react';
import StatusPill from './StatusPill';
import { formatCallCommerceDate } from './utils';

const TERMINAL = new Set(['PURCHASED', 'UNQUALIFIED', 'CLOSED_LOST']);

export default function LeadDrawer({
  lead,
  history,
  onClose,
  onAction,
}: {
  lead: any;
  history: any;
  onClose: () => void;
  onAction: (action: string, payload?: any) => void;
}) {
  const locked = TERMINAL.has(String(lead.status));
  const [name, setName] = useState(lead.customer_name || '');
  const [email, setEmail] = useState(lead.email || '');
  const [product, setProduct] = useState(lead.product || '');
  const [notes, setNotes] = useState(lead.notes || '');

  return (
    <div className="fixed inset-0 z-[210] flex justify-end bg-slate-950/30">
      <div className="h-full w-full max-w-[720px] overflow-y-auto bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-4">
          <div>
            <div className="text-[13px] font-semibold text-slate-950">
              {lead.customer_name || lead.phone}
            </div>
            <div className="mt-1">
              <StatusPill status={lead.status} />
            </div>
          </div>
          <button onClick={onClose} className="text-xl text-slate-400">
            ×
          </button>
        </div>

        <div className="space-y-4 p-4">
          {locked && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[10px] font-semibold text-slate-600">
              This lead is finalized. Purchase/status workflow fields are locked.
            </div>
          )}

          <div className="grid gap-2 md:grid-cols-2">
            {[
              ['Customer name', name, setName],
              ['Email', email, setEmail],
              ['Product', product, setProduct],
            ].map(([label, value, setter]: any) => (
              <label key={label} className="text-[9px] font-semibold text-slate-500">
                {label}
                <input
                  disabled={locked}
                  value={value}
                  onChange={event => setter(event.target.value)}
                  className="mt-1 h-8 w-full rounded border border-slate-200 px-2 text-[10px] disabled:bg-slate-50"
                />
              </label>
            ))}

            <label className="text-[9px] font-semibold text-slate-500">
              Phone
              <input
                value={lead.phone}
                disabled
                className="mt-1 h-8 w-full rounded border border-slate-200 bg-slate-50 px-2 text-[10px]"
              />
            </label>
          </div>

          <label className="block text-[9px] font-semibold text-slate-500">
            Notes
            <textarea
              disabled={locked}
              value={notes}
              onChange={event => setNotes(event.target.value)}
              className="mt-1 min-h-20 w-full rounded border border-slate-200 p-2 text-[10px] disabled:bg-slate-50"
            />
          </label>

          {!locked && (
            <button
              onClick={() =>
                onAction('update_details', {
                  customerName: name,
                  email,
                  product,
                  notes,
                })
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-[9px] font-semibold"
            >
              Save Details
            </button>
          )}

          {!locked && <WorkflowButtons lead={lead} onAction={onAction} />}

          {lead.status === 'PURCHASED' && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[10px] text-emerald-800">
              <b>Purchase:</b> {lead.order_id || '—'} · ₹
              {Number(lead.order_amount || 0).toLocaleString('en-IN')}
            </div>
          )}

          <div>
            <h3 className="text-[10px] font-semibold text-slate-900">Call history</h3>
            <div className="mt-2 space-y-2">
              {!history ? (
                <div className="text-[9px] text-slate-400">Loading…</div>
              ) : (
                (history.attempts || []).map((attempt: any) => (
                  <div
                    key={attempt.attempt_id}
                    className="rounded-lg border border-slate-200 p-2.5 text-[9px]"
                  >
                    <div className="flex justify-between">
                      <b>{attempt.call_status}</b>
                      <span className="text-slate-400">
                        {formatCallCommerceDate(
                          attempt.call_started_at || attempt.created_at
                        )}
                      </span>
                    </div>
                    <div className="mt-1 text-slate-500">
                      {attempt.agent_name || 'No agent'} · {attempt.duration_seconds || 0}s ·{' '}
                      {attempt.direction || 'UNKNOWN'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowButtons({
  lead,
  onAction,
}: {
  lead: any;
  onAction: (action: string, payload?: any) => void;
}) {
  function promptAction(action: string) {
    if (action === 'purchase') {
      const orderId = prompt('Order ID / Reference');
      if (!orderId) return;
      const amount = prompt('Order Amount');
      if (amount === null) return;
      onAction('purchase', { orderId, orderAmount: Number(amount) });
      return;
    }

    if (action === 'unqualify' || action === 'close_lost') {
      const reason = prompt('Reason') || '';
      onAction(action, { reason });
      return;
    }

    if (action === 'follow_up') {
      const nextFollowUpAt = prompt('Next follow-up ISO date/time (optional)') || null;
      onAction(action, { nextFollowUpAt });
      return;
    }

    onAction(action, {});
  }

  const buttons =
    lead.status === 'NEW'
      ? [
          ['qualify', 'Qualify'],
          ['unqualify', 'Unqualify'],
        ]
      : lead.status === 'QUALIFIED'
        ? [
            ['follow_up', 'Follow-up'],
            ['purchase', 'Purchase'],
          ]
        : lead.status === 'FOLLOW_UP'
          ? [
              ['follow_up', 'Follow-up'],
              ['purchase', 'Purchase'],
              ['close_lost', 'Close Lost'],
            ]
          : [];

  return (
    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
      {buttons.map(([action, label]) => (
        <button
          key={action}
          onClick={() => promptAction(action)}
          className={`rounded-lg px-3 py-2 text-[9px] font-semibold ${
            action === 'purchase'
              ? 'bg-emerald-600 text-white'
              : action === 'unqualify' || action === 'close_lost'
                ? 'bg-red-50 text-red-700'
                : 'bg-slate-950 text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
