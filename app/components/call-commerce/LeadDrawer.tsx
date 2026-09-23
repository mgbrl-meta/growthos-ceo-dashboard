'use client';

import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  Phone,
  Save,
  UserRound,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import StatusPill, { WorkflowStatusPill } from './StatusPill';
import {
  callOutcome,
  duration,
  formatDateTime,
  initials,
  normalizeDisplayPhone,
} from './utils';

export default function LeadDrawer({
  lead,
  history,
  loading,
  onClose,
  onAction,
}: {
  lead: any;
  history: any;
  loading: boolean;
  onClose: () => void;
  onAction: (
    action: string,
    data?: Record<string, unknown>,
    keepOpen?: boolean
  ) => Promise<void>;
}) {
  const [details, setDetails] = useState({
    customerName: '',
    email: '',
    product: '',
    notes: '',
    nextFollowUpAt: '',
  });
  const [workflow, setWorkflow] = useState('');
  const [workflowReason, setWorkflowReason] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orderAmount, setOrderAmount] = useState('');

  useEffect(() => {
    setDetails({
      customerName: lead?.customer_name || '',
      email: lead?.email || '',
      product: lead?.product || '',
      notes: lead?.notes || '',
      nextFollowUpAt: lead?.next_follow_up_at
        ? String((lead.next_follow_up_at as any)?.value ?? lead.next_follow_up_at).slice(0, 16)
        : '',
    });
    setWorkflow('');
    setWorkflowReason('');
    setOrderId('');
    setOrderAmount('');
  }, [lead]);

  const attempts = Array.isArray(history?.attempts) ? history.attempts : [];
  const activity = Array.isArray(history?.activity) ? history.activity : [];

  const attemptSummary = useMemo(() => {
    const answered = attempts.filter(
      (item: any) => String(item.call_status).toUpperCase() === 'ANSWERED'
    ).length;
    const unanswered = attempts.filter((item: any) =>
      ['NO_ANSWER', 'MISSED', 'BUSY', 'REJECTED', 'FAILED'].includes(
        String(item.call_status).toUpperCase()
      )
    ).length;
    const talk = attempts
      .filter((item: any) => String(item.call_status).toUpperCase() === 'ANSWERED')
      .reduce(
        (sum: number, item: any) => sum + Number(item.duration_seconds || 0),
        0
      );

    return {
      total: attempts.length,
      answered,
      unanswered,
      avgTalk: answered ? talk / answered : 0,
    };
  }, [attempts]);

  const status = String(lead?.status || 'NEW').toUpperCase();
  const allowed =
    status === 'NEW'
      ? [
          ['qualify', 'Qualify'],
          ['unqualify', 'Unqualify'],
        ]
      : status === 'QUALIFIED'
        ? [
            ['follow_up', 'Follow Up'],
            ['purchase', 'Purchased'],
          ]
        : status === 'FOLLOW_UP'
          ? [
              ['follow_up', 'Update Follow Up'],
              ['purchase', 'Purchased'],
              ['close_lost', 'Close Lost'],
            ]
          : [];

  async function saveDetails() {
    await onAction(
      'update_details',
      {
        customerName: details.customerName || null,
        email: details.email || null,
        product: details.product || null,
        notes: details.notes || null,
        nextFollowUpAt: details.nextFollowUpAt || null,
      },
      true
    );
  }

  async function runWorkflow() {
    if (!workflow) return;

    const payload: Record<string, unknown> = {};

    if (workflow === 'follow_up') {
      payload.nextFollowUpAt = details.nextFollowUpAt || null;
    }
    if (workflow === 'unqualify' || workflow === 'close_lost') {
      payload.reason = workflowReason || null;
    }
    if (workflow === 'purchase') {
      payload.orderId = orderId || null;
      payload.orderAmount = orderAmount ? Number(orderAmount) : null;
    }

    await onAction(workflow, payload);
  }

  const latestOutcome = callOutcome(lead);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/20 backdrop-blur-[1px]">
      <div className="h-full w-full max-w-[560px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                {initials(lead?.customer_name || lead?.phone)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold text-slate-950">
                  {lead?.customer_name || normalizeDisplayPhone(lead?.phone)}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[9px] text-slate-400">
                  <span>{normalizeDisplayPhone(lead?.phone)}</span>
                  <span>•</span>
                  <span>{lead?.lead_id}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <WorkflowStatusPill status={lead?.status} />
                  <StatusPill value={lead} />
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <section className="grid grid-cols-4 gap-2">
            {[
              ['Total Calls', attemptSummary.total],
              ['Answered', attemptSummary.answered],
              ['Unanswered', attemptSummary.unanswered],
              ['Avg Talk', duration(attemptSummary.avgTalk)],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"
              >
                <div className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">
                  {label}
                </div>
                <div className="mt-1 text-[14px] font-semibold text-slate-950">
                  {value}
                </div>
              </div>
            ))}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info
                label="Business Number"
                value={lead?.latest_business_number || '—'}
                icon={<Phone size={13} />}
              />
              <Info
                label="Assigned Agent"
                value={lead?.latest_agent_name || 'Unassigned'}
                icon={<UserRound size={13} />}
              />
              <Info
                label="Latest Outcome"
                value={`${latestOutcome.label} — ${latestOutcome.detail}`}
                icon={<CheckCircle2 size={13} />}
              />
              <Info
                label="Last Call"
                value={formatDateTime(lead?.latest_call_at)}
                icon={<Clock3 size={13} />}
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[11px] font-semibold text-slate-950">
                  Lead details
                </h3>
                <p className="mt-1 text-[8px] text-slate-400">
                  Agent-managed customer and follow-up information
                </p>
              </div>
              <button
                onClick={saveDetails}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-semibold text-white"
              >
                <Save size={12} />
                Save
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field
                label="Customer name"
                value={details.customerName}
                onChange={(customerName) =>
                  setDetails((prev) => ({ ...prev, customerName }))
                }
              />
              <Field
                label="Email"
                value={details.email}
                onChange={(email) =>
                  setDetails((prev) => ({ ...prev, email }))
                }
              />
              <Field
                label="Product"
                value={details.product}
                onChange={(product) =>
                  setDetails((prev) => ({ ...prev, product }))
                }
              />
              <label>
                <span className="text-[8px] font-semibold text-slate-500">
                  Next follow-up
                </span>
                <input
                  type="datetime-local"
                  value={details.nextFollowUpAt}
                  onChange={(event) =>
                    setDetails((prev) => ({
                      ...prev,
                      nextFollowUpAt: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[9px] outline-none focus:border-slate-400"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="text-[8px] font-semibold text-slate-500">
                  Notes
                </span>
                <textarea
                  rows={3}
                  value={details.notes}
                  onChange={(event) =>
                    setDetails((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[9px] outline-none focus:border-slate-400"
                />
              </label>
            </div>
          </section>

          {allowed.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-[11px] font-semibold text-slate-950">
                Workflow
              </h3>

              <div className="mt-3 flex flex-wrap gap-2">
                {allowed.map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setWorkflow(key)}
                    className={`rounded-lg border px-3 py-2 text-[9px] font-semibold ${
                      workflow === key
                        ? 'border-slate-950 bg-slate-950 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {workflow && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3">
                  {(workflow === 'unqualify' ||
                    workflow === 'close_lost') && (
                    <Field
                      label="Reason"
                      value={workflowReason}
                      onChange={setWorkflowReason}
                    />
                  )}

                  {workflow === 'follow_up' && (
                    <div className="text-[9px] text-slate-500">
                      Follow-up uses the “Next follow-up” date saved above.
                    </div>
                  )}

                  {workflow === 'purchase' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        label="Order ID"
                        value={orderId}
                        onChange={setOrderId}
                      />
                      <Field
                        label="Order Amount"
                        value={orderAmount}
                        onChange={setOrderAmount}
                      />
                    </div>
                  )}

                  <button
                    onClick={runWorkflow}
                    className="mt-3 rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-semibold text-white"
                  >
                    Confirm{' '}
                    {allowed.find(([key]) => key === workflow)?.[1] ||
                      'Action'}
                  </button>
                </div>
              )}
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-[11px] font-semibold text-slate-950">
                Call history
              </h3>
              <p className="mt-1 text-[8px] text-slate-400">
                One timeline entry per Growth OS call attempt
              </p>
            </div>

            {loading ? (
              <div className="px-4 py-10 text-center text-[10px] text-slate-400">
                Loading history…
              </div>
            ) : attempts.length ? (
              <div className="divide-y divide-slate-100">
                {attempts.map((attempt: any) => {
                  const outcome = callOutcome(attempt);

                  return (
                    <div key={attempt.attempt_id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill value={attempt} />
                            <span className="text-[9px] font-semibold text-slate-700">
                              {outcome.detail}
                            </span>
                          </div>

                          <div className="mt-2 text-[9px] text-slate-500">
                            {formatDateTime(
                              attempt.call_started_at || attempt.created_at
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[8px] text-slate-400">
                            <span>
                              Agent: {attempt.agent_name || 'Unassigned'}
                            </span>
                            <span>
                              Duration: {duration(attempt.duration_seconds)}
                            </span>
                            <span>
                              Business: {attempt.business_number || '—'}
                            </span>
                          </div>
                        </div>

                        {attempt.recording_url && (
                          <a
                            href={attempt.recording_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[8px] font-semibold text-blue-600"
                          >
                            Recording
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>

                      <details className="mt-3 rounded-lg border border-slate-100 bg-slate-50/60">
                        <summary className="flex cursor-pointer items-center gap-1 px-3 py-2 text-[8px] font-semibold text-slate-500">
                          <ChevronDown size={11} />
                          Outcome evidence & provider detail
                        </summary>
                        <div className="grid gap-2 border-t border-slate-100 px-3 py-3 text-[8px] text-slate-500 sm:grid-cols-2">
                          <Evidence
                            label="Provider Call ID"
                            value={attempt.provider_call_id}
                          />
                          <Evidence
                            label="Event Type"
                            value={
                              attempt.raw_event_type || attempt.event_type
                            }
                          />
                          <Evidence
                            label="Raw Status"
                            value={attempt.raw_status}
                          />
                          <Evidence
                            label="Disconnected By"
                            value={attempt.disconnected_by}
                          />
                          <Evidence
                            label="Disconnect Party"
                            value={attempt.disconnect_party}
                          />
                          <Evidence
                            label="End Reason"
                            value={attempt.end_reason}
                          />
                          <Evidence
                            label="Outcome Source"
                            value={attempt.outcome_source}
                          />
                          <Evidence label="Reason" value={attempt.reason} />
                          <div className="sm:col-span-2">
                            <Evidence
                              label="IVR Inputs"
                              value={
                                typeof attempt.ivr_inputs === 'string'
                                  ? attempt.ivr_inputs
                                  : JSON.stringify(attempt.ivr_inputs ?? '')
                              }
                            />
                          </div>
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-10 text-center text-[10px] text-slate-400">
                No call attempts yet.
              </div>
            )}
          </section>

          {activity.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-[11px] font-semibold text-slate-950">
                  Lead activity
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {activity.slice(0, 20).map((item: any) => (
                  <div
                    key={item.activity_id}
                    className="flex items-start justify-between gap-4 px-4 py-3"
                  >
                    <div>
                      <div className="text-[9px] font-semibold text-slate-700">
                        {String(
                          item.activity_type || 'activity'
                        ).replaceAll('_', ' ')}
                      </div>
                      <div className="mt-1 text-[8px] text-slate-400">
                        {item.from_status
                          ? `${item.from_status} → ${
                              item.to_status || '—'
                            }`
                          : item.to_status || ''}
                      </div>
                    </div>
                    <div className="text-right text-[8px] text-slate-400">
                      {formatDateTime(item.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div>
        <div className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </div>
        <div className="mt-1 text-[9px] font-medium text-slate-700">
          {value}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-[8px] font-semibold text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[9px] outline-none focus:border-slate-400"
      />
    </label>
  );
}

function Evidence({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="text-[7px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 break-words text-[8px] text-slate-600">
        {value === null || value === undefined || value === ''
          ? '—'
          : String(value)}
      </div>
    </div>
  );
}
