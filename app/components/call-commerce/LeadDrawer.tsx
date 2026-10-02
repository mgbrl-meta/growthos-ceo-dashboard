'use client';



import {

  ArrowDownLeft,

  ArrowUpRight,

  CheckCircle2,

  ChevronDown,

  Clock3,

  ExternalLink,

  LoaderCircle,

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



function DirectionPill({ value }: { value: unknown }) {

  const direction = String(value || 'UNKNOWN').toUpperCase();



  if (direction === 'OUTBOUND') {

    return (

      <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[8px] font-semibold text-violet-700">

        <ArrowUpRight size={10} />

        Outbound

      </span>

    );

  }



  if (direction === 'INBOUND') {

    return (

      <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[8px] font-semibold text-sky-700">

        <ArrowDownLeft size={10} />

        Inbound

      </span>

    );

  }



  return (

    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[8px] font-semibold text-slate-500">

      Unknown

    </span>

  );

}



export default function LeadDrawer({

  lead,

  history,

  loading,

  canCorrectStatus,

  onClose,

  onAction,

}: {

  lead: any;

  history: any;

  loading: boolean;

  canCorrectStatus: boolean;

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

  const [workflowComment, setWorkflowComment] = useState('');

  const [orderId, setOrderId] = useState('');

  const [orderAmount, setOrderAmount] = useState('');

  const [actionBusy, setActionBusy] = useState(false);

  const [busyAction, setBusyAction] = useState('');

  const [actionError, setActionError] = useState('');

  const [adminTargetStatus, setAdminTargetStatus] = useState('');

  const [adminCorrectionReason, setAdminCorrectionReason] = useState('');

  const [adminStatusReason, setAdminStatusReason] = useState('');

  const [adminOrderId, setAdminOrderId] = useState('');

  const [adminOrderAmount, setAdminOrderAmount] = useState('');



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

    setWorkflowComment('');

    setOrderId('');

    setOrderAmount('');

    setActionBusy(false);

    setBusyAction('');

    setActionError('');

    setAdminTargetStatus('');

    setAdminCorrectionReason('');

    setAdminStatusReason('');

    setAdminOrderId('');

    setAdminOrderAmount('');

  }, [lead]);



  const attempts = Array.isArray(history?.attempts) ? history.attempts : [];

  const activity = Array.isArray(history?.activity) ? history.activity : [];

  const historyErrors = [

    ...(Array.isArray(history?.errors) ? history.errors : []),

    ...(history?.error ? [String(history.error)] : []),

  ].filter(Boolean);



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



    const fallbackTotal =

      Number(

        lead?.call_attempt_count

        ||

        0

      );



    const fallbackAnswered =

      Number(

        lead?.answered_attempt_count

        ||

        0

      );



    const fallbackUnanswered =

      Number(

        lead?.unanswered_attempt_count

        ||

        Math.max(

          fallbackTotal -

          fallbackAnswered,

          0

        )

      );



    return {

      total:

        attempts.length

        ||

        fallbackTotal,

      answered:

        attempts.length

        ?

          answered

        :

          fallbackAnswered,

      unanswered:

        attempts.length

        ?

          unanswered

        :

          fallbackUnanswered,

      avgTalk:

        answered

        ?

          talk / answered

        :

          0,

    };

  }, [

    attempts,

    lead?.call_attempt_count,

    lead?.answered_attempt_count,

    lead?.unanswered_attempt_count,

  ]);



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

  const adminCorrectionOptions = [
    ['NEW', 'New'],
    ['QUALIFIED', 'Qualified'],
    ['FOLLOW_UP', 'Follow Up'],
    ['PURCHASED', 'Purchased'],
    ['UNQUALIFIED', 'Unqualified'],
    ['CLOSED_LOST', 'Closed Lost'],
  ].filter(([value]) => value !== status);



  async function saveDetails() {

    if (actionBusy) return;



    try {

      setActionBusy(true);

      setBusyAction('update_details');

      setActionError('');



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

    } catch (error: any) {

      setActionError(

        error?.message

        ||

        'Unable to save lead details'

      );

    } finally {

      setActionBusy(false);

      setBusyAction('');

    }

  }



  async function runWorkflow() {

    if (

      !workflow

      ||

      actionBusy

    ) return;



    const payload: Record<string, unknown> = {
      agentComment:
        workflowComment.trim()
        ||
        null,
    };



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



    try {

      setActionBusy(true);

      setBusyAction(workflow);

      setActionError('');



      await onAction(

        workflow,

        payload

      );

    } catch (error: any) {

      setActionError(

        error?.message

        ||

        'Unable to update lead workflow'

      );

    } finally {

      setActionBusy(false);

      setBusyAction('');

    }

  }



  async function runAdminCorrection() {

    if (actionBusy) return;

    const correctionReason = adminCorrectionReason.trim();

    if (!adminTargetStatus) {
      setActionError('Select the corrected status.');
      return;
    }

    if (!correctionReason) {
      setActionError('Admin correction reason is required.');
      return;
    }

    const payload: Record<string, unknown> = {
      targetStatus: adminTargetStatus,
      correctionReason,
    };

    if (adminTargetStatus === 'FOLLOW_UP') {
      payload.nextFollowUpAt = details.nextFollowUpAt || null;
    }

    if (
      adminTargetStatus === 'UNQUALIFIED' ||
      adminTargetStatus === 'CLOSED_LOST'
    ) {
      payload.statusReason = adminStatusReason.trim() || null;
    }

    if (adminTargetStatus === 'PURCHASED') {
      payload.orderId = adminOrderId.trim() || null;
      payload.orderAmount = adminOrderAmount
        ? Number(adminOrderAmount)
        : null;
    }

    try {
      setActionBusy(true);
      setBusyAction('admin_correct_status');
      setActionError('');

      await onAction(
        'admin_correct_status',
        payload
      );
    } catch (error: any) {
      setActionError(
        error?.message || 'Unable to correct lead status'
      );
    } finally {
      setActionBusy(false);
      setBusyAction('');
    }
  }



  const latestOutcome = callOutcome(lead);

  const workflowBusyLabel =
    workflow === 'qualify'
      ? 'Qualifying...'
      : workflow === 'unqualify'
        ? 'Unqualifying...'
        : workflow === 'follow_up'
          ? 'Saving follow-up...'
          : workflow === 'purchase'
            ? 'Marking purchased...'
            : workflow === 'close_lost'
              ? 'Closing lead...'
              : 'Processing...';



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

          {actionError && (

            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[9px] font-medium text-rose-700">

              {actionError}

            </div>

          )}



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

                label="Latest Call Status"

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

                disabled={actionBusy}

                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"

              >

                {busyAction === 'update_details' ? (

                  <LoaderCircle
                    size={12}
                    className="animate-spin"
                  />

                ) : (

                  <Save size={12} />

                )}

                {busyAction === 'update_details'
                  ? 'Saving...'
                  : 'Save'}

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

                    disabled={actionBusy}

                    className={`rounded-lg border px-3 py-2 text-[9px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${

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



                  <label className="mt-3 block">

                    <span className="text-[8px] font-semibold text-slate-500">

                      Agent comment

                      <span className="ml-1 font-normal text-slate-400">

                        (optional)

                      </span>

                    </span>

                    <textarea

                      rows={3}

                      value={workflowComment}

                      onChange={(event) =>
                        setWorkflowComment(
                          event.target.value
                        )
                      }

                      disabled={actionBusy}

                      placeholder="Add context for this status change..."

                      className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[9px] text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70"

                    />

                  </label>



                  <button

                    onClick={runWorkflow}

                    disabled={actionBusy}

                    className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"

                  >

                    {busyAction === workflow ? (

                      <>

                        <LoaderCircle
                          size={12}
                          className="animate-spin"
                        />

                        {workflowBusyLabel}

                      </>

                    ) : (

                      `Confirm ${

                        allowed.find(

                          ([key]) =>

                            key === workflow

                        )?.[1]

                        ||

                        'Action'

                      }`

                    )}

                  </button>

                </div>

              )}

            </section>

          )}



          {canCorrectStatus && (

            <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">

              <h3 className="text-[11px] font-semibold text-amber-950">

                Admin status correction

              </h3>

              <p className="mt-1 text-[8px] leading-4 text-amber-700">

                Use only to correct an incorrect workflow status. The correction is audited and does not create a new Meta conversion event.

              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">

                <label>

                  <span className="text-[8px] font-semibold text-amber-800">

                    Correct status to

                  </span>

                  <select
                    value={adminTargetStatus}
                    onChange={(event) =>
                      setAdminTargetStatus(event.target.value)
                    }
                    disabled={actionBusy}
                    className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-[9px] text-slate-700 outline-none focus:border-amber-400 disabled:opacity-60"
                  >
                    <option value="">Select status</option>
                    {adminCorrectionOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>

                </label>

                {(adminTargetStatus === 'UNQUALIFIED' ||
                  adminTargetStatus === 'CLOSED_LOST') && (
                  <Field
                    label="Status reason"
                    value={adminStatusReason}
                    onChange={setAdminStatusReason}
                  />
                )}

                {adminTargetStatus === 'PURCHASED' && (
                  <>
                    <Field
                      label="Order ID"
                      value={adminOrderId}
                      onChange={setAdminOrderId}
                    />
                    <Field
                      label="Order Amount"
                      value={adminOrderAmount}
                      onChange={setAdminOrderAmount}
                    />
                  </>
                )}

              </div>

              {adminTargetStatus === 'FOLLOW_UP' && (
                <div className="mt-3 rounded-lg border border-amber-100 bg-white px-3 py-2 text-[8px] text-amber-800">
                  The corrected Follow Up status will use the “Next follow-up” value from Lead details above.
                </div>
              )}

              <label className="mt-3 block">

                <span className="text-[8px] font-semibold text-amber-800">

                  Admin correction reason

                </span>

                <textarea
                  rows={3}
                  value={adminCorrectionReason}
                  onChange={(event) =>
                    setAdminCorrectionReason(event.target.value)
                  }
                  disabled={actionBusy}
                  placeholder="Example: Agent selected Unqualified by mistake"
                  className="mt-1 w-full resize-none rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-[9px] text-slate-700 outline-none placeholder:text-slate-300 focus:border-amber-400 disabled:opacity-60"
                />

              </label>

              <button
                type="button"
                onClick={runAdminCorrection}
                disabled={actionBusy || !adminTargetStatus || !adminCorrectionReason.trim()}
                className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-900 px-3 py-2 text-[9px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyAction === 'admin_correct_status' ? (
                  <>
                    <LoaderCircle size={12} className="animate-spin" />
                    Correcting status...
                  </>
                ) : (
                  'Confirm admin correction'
                )}
              </button>

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



            {historyErrors.length > 0 && (

              <div className="border-b border-amber-100 bg-amber-50 px-4 py-3">

                <div className="text-[9px] font-semibold text-amber-800">

                  Some call history data could not be loaded.

                </div>

                <div className="mt-1 space-y-1 text-[8px] text-amber-700">

                  {historyErrors.map(

                    (

                      message,

                      index

                    ) => (

                      <div key={`${message}-${index}`}>

                        {message}

                      </div>

                    )

                  )}

                </div>

              </div>

            )}



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

                            <DirectionPill value={attempt.direction} />

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

                {activity.slice(0, 20).map((item: any) => {

                  const details =
                    parseActivityDetails(
                      item.details
                    );

                  const agentComment =
                    cleanActivityText(
                      details.agentComment
                    );

                  const reason =
                    cleanActivityText(
                      details.reason
                    );

                  const correctionReason =
                    cleanActivityText(
                      details.correction_reason
                    );

                  const statusReason =
                    cleanActivityText(
                      details.status_reason
                    );

                  const followUpAt =
                    cleanActivityText(
                      details.nextFollowUpAt
                      ||
                      details.next_follow_up_at
                    );

                  const activityOrderId =
                    cleanActivityText(
                      details.orderId
                      ||
                      details.order_id
                    );

                  const activityOrderAmount =
                    cleanActivityText(
                      details.orderAmount
                      ||
                      details.order_amount
                    );

                  return (

                    <div

                      key={item.activity_id}

                      className="px-4 py-3"

                    >

                      <div className="flex items-start justify-between gap-4">

                        <div className="min-w-0">

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

                        <div className="shrink-0 text-right text-[8px] text-slate-400">

                          {formatDateTime(item.created_at)}

                        </div>

                      </div>



                      {agentComment && (

                        <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">

                          <div className="text-[7px] font-semibold uppercase tracking-wide text-slate-400">

                            Agent comment

                          </div>

                          <div className="mt-1 whitespace-pre-wrap break-words text-[9px] leading-4 text-slate-700">

                            {agentComment}

                          </div>

                        </div>

                      )}



                      {(reason ||

                        followUpAt ||

                        activityOrderId ||

                        activityOrderAmount) && (

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[8px] text-slate-400">

                          {reason && (

                            <span>

                              Reason: {reason}

                            </span>

                          )}

                          {correctionReason && (

                            <span>

                              Admin correction: {correctionReason}

                            </span>

                          )}

                          {statusReason && (

                            <span>

                              Status reason: {statusReason}

                            </span>

                          )}

                          {followUpAt && (

                            <span>

                              Follow-up: {formatDateTime(followUpAt)}

                            </span>

                          )}

                          {activityOrderId && (

                            <span>

                              Order: {activityOrderId}

                            </span>

                          )}

                          {activityOrderAmount && (

                            <span>

                              Amount: {activityOrderAmount}

                            </span>

                          )}

                        </div>

                      )}



                      {item.actor_user_id && (

                        <div className="mt-2 text-[7px] text-slate-300">

                          Updated by {String(item.actor_user_id)}

                        </div>

                      )}

                    </div>

                  );

                })}

              </div>

            </section>

          )}

        </div>

      </div>

    </div>

  );

}



function parseActivityDetails(
  value: unknown
):
  Record<string, unknown> {

  if (
    !value
  ) {

    return {};

  }

  if (
    typeof value ===
      'object'
    &&
    !Array.isArray(
      value
    )
  ) {

    const maybeWrapped =
      value as
        Record<string, unknown>;

    if (
      typeof maybeWrapped.value ===
        'string'
    ) {

      try {

        const parsed =
          JSON.parse(
            maybeWrapped.value
          );

        if (
          parsed
          &&
          typeof parsed ===
            'object'
          &&
          !Array.isArray(
            parsed
          )
        ) {

          return parsed as
            Record<string, unknown>;

        }

      } catch {

        return maybeWrapped;

      }

    }

    return maybeWrapped;

  }

  if (
    typeof value ===
      'string'
  ) {

    try {

      const parsed =
        JSON.parse(
          value
        );

      if (
        parsed
        &&
        typeof parsed ===
          'object'
        &&
        !Array.isArray(
          parsed
        )
      ) {

        return parsed as
          Record<string, unknown>;

      }

    } catch {

      return {};

    }

  }

  return {};

}



function cleanActivityText(
  value: unknown
) {

  if (
    value ===
      null
    ||
    value ===
      undefined
    ||
    value ===
      ''
  ) {

    return '';

  }

  return String(
    value
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
