'use client';

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  IndianRupee,
  Phone,
  PhoneMissed,
  RefreshCw,
  Repeat2,
  ShoppingCart,
  Timer,
  TrendingUp,
  UserCheck,
  UserRoundX,
  Users,
  XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  currency,
  duration,
  initials,
  integer,
  n,
  percent,
  shortDate,
  timeAgo,
} from './utils';

type SummaryData = {
  total_calls?: number;
  unique_leads?: number;
  repeat_leads?: number;
  answered?: number;
  no_answer?: number;
  caller_dropped?: number;
  unknown?: number;
  ringing?: number;
  failed?: number;
  answer_rate?: number;
  no_answer_rate?: number;
  caller_drop_rate?: number;
  avg_talk_time_seconds?: number;
  median_talk_time_seconds?: number;
  total_talk_time_seconds?: number;
  longest_answered_seconds?: number;
  quality_connected?: number;
  short_connected?: number;
  customer_disconnected?: number;
  agent_disconnected?: number;
  business_routing_unanswered?: number;
  user_unreachable?: number;
  network_failure?: number;
  last_call_at?: string | null;
  calls?: number;
  connected?: number;
  qualified?: number;
  follow_up?: number;
  purchased?: number;
  unqualified?: number;
  closed_lost?: number;
  revenue?: number;
  avg_order_value?: number;
  qualification_rate?: number;
  qualified_purchase_rate?: number;
  call_purchase_rate?: number;
  trend?: any[];
  hourly?: any[];
  agent_performance?: any[];
  lead_statuses?: any[];
  business_numbers?: any[];
};

function Card({
  label,
  value,
  helper,
  icon,
  tone = 'slate',
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  tone?: 'blue' | 'emerald' | 'rose' | 'amber' | 'violet' | 'slate';
}) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
    slate: 'bg-slate-100 text-slate-600',
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            {label}
          </div>
          <div className="mt-2 text-[24px] font-semibold tracking-[-0.045em] text-slate-950">
            {value}
          </div>
          <div className="mt-1 text-[9px] font-medium text-slate-500">{helper}</div>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneClass}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function Progress({
  label,
  count,
  rate,
  bar,
}: {
  label: string;
  count: number;
  rate: number;
  bar: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-medium text-slate-600">{label}</span>
        <div className="text-right">
          <span className="text-[11px] font-semibold text-slate-900">{integer(count)}</span>
          <span className="ml-2 text-[9px] text-slate-400">{rate.toFixed(1)}%</span>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${bar}`}
          style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
        />
      </div>
    </div>
  );
}

function Nuance({
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
    <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[9px] font-semibold text-slate-500">{label}</div>
          <div className="mt-1 text-[16px] font-semibold text-slate-950">{value}</div>
          <div className="mt-1 text-[8px] leading-4 text-slate-400">{helper}</div>
        </div>
        <div className="text-slate-400">{icon}</div>
      </div>
    </div>
  );
}

export default function CallCommerceSummary({
  start = '',
  end = '',
}: {
  start?: string;
  end?: string;
}) {
  const [data, setData] = useState<SummaryData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ start, end });
      const response = await fetch(`/api/call-commerce/summary?${query.toString()}`, {
        cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || 'Unable to load Call Commerce summary');
      }
      setData(body.data || {});
    } catch (error: any) {
      setError(error?.message || 'Unable to load Call Commerce summary');
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = n(data.total_calls);
  const answered = n(data.answered);
  const noAnswer = n(data.no_answer);
  const dropped = n(data.caller_dropped);
  const unknown = n(data.unknown);
  const unknownRate = total ? (unknown / total) * 100 : 0;

  const trend = Array.isArray(data.trend) ? data.trend : [];
  const hourly = Array.isArray(data.hourly) ? data.hourly : [];
  const agents = Array.isArray(data.agent_performance) ? data.agent_performance : [];
  const statuses = Array.isArray(data.lead_statuses) ? data.lead_statuses : [];
  const businessNumbers = Array.isArray(data.business_numbers) ? data.business_numbers : [];

  const maxDaily = Math.max(1, ...trend.map((row) => n(row.total_calls)));
  const maxHourly = Math.max(1, ...hourly.map((row) => n(row.calls)));

  const statusTotal = useMemo(
    () => statuses.reduce((sum, row) => sum + n(row.leads), 0),
    [statuses]
  );

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[10px] text-red-700">
        <div className="font-semibold">Unable to load Call Commerce summary</div>
        <div className="mt-1">{error}</div>
        <button onClick={load} className="mt-3 font-semibold underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loading && (
        <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
          <RefreshCw size={11} className="animate-spin" />
          Refreshing summary…
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card label="Total Calls" value={integer(data.total_calls)} helper={`${integer(data.unique_leads)} unique leads`} icon={<Phone size={17} />} tone="blue" />
        <Card label="Answered" value={integer(data.answered)} helper={`${percent(data.answer_rate)} answer rate`} icon={<CheckCircle2 size={17} />} tone="emerald" />
        <Card label="No Answer" value={integer(data.no_answer)} helper={`${percent(data.no_answer_rate)} of calls`} icon={<PhoneMissed size={17} />} tone="rose" />
        <Card label="Caller Dropped" value={integer(data.caller_dropped)} helper={`${percent(data.caller_drop_rate)} before connection`} icon={<XCircle size={17} />} tone="amber" />
        <Card label="Avg Talk Time" value={duration(data.avg_talk_time_seconds)} helper={`${duration(data.total_talk_time_seconds)} total`} icon={<Clock3 size={17} />} tone="violet" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[12px] font-semibold text-slate-950">Call outcomes</h3>
              <p className="mt-1 text-[9px] text-slate-400">Final outcome classification for the selected period</p>
            </div>
            <Activity size={16} className="text-slate-300" />
          </div>

          <div className="mt-5 space-y-5">
            <Progress label="Answered" count={answered} rate={n(data.answer_rate)} bar="bg-emerald-500" />
            <Progress label="No Answer" count={noAnswer} rate={n(data.no_answer_rate)} bar="bg-rose-500" />
            <Progress label="Caller Dropped" count={dropped} rate={n(data.caller_drop_rate)} bar="bg-amber-500" />
            <Progress label="Unknown" count={unknown} rate={unknownRate} bar="bg-slate-400" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
            <Nuance label="Ringing" value={integer(data.ringing)} helper="Calls with no terminal event yet" icon={<Phone size={14} />} />
            <Nuance label="Provider failed" value={integer(data.failed)} helper="Failed call attempts" icon={<AlertTriangle size={14} />} />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
            <div>
              <div className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Last processed call</div>
              <div className="mt-1 text-[10px] font-semibold text-slate-800">{timeAgo(data.last_call_at)}</div>
            </div>
            <CheckCircle2 size={15} className="text-emerald-600" />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[12px] font-semibold text-slate-950">Calls trend</h3>
              <p className="mt-1 text-[9px] text-slate-400">Daily volume and outcome mix</p>
            </div>
            <TrendingUp size={16} className="text-slate-300" />
          </div>

          {trend.length ? (
            <>
              <div className="mt-5 flex h-[190px] items-end gap-2">
                {trend.map((point) => {
                  const pointTotal = Math.max(1, n(point.total_calls));
                  const height = Math.max(8, (n(point.total_calls) / maxDaily) * 160);
                  const answeredPct = (n(point.answered) / pointTotal) * 100;
                  const noAnswerPct = (n(point.no_answer) / pointTotal) * 100;
                  const droppedPct = (n(point.caller_dropped) / pointTotal) * 100;
                  const unknownPct = Math.max(0, 100 - answeredPct - noAnswerPct - droppedPct);

                  return (
                    <div key={String(point.date)} className="flex min-w-0 flex-1 flex-col items-center justify-end" title={`${point.date}: ${point.total_calls} calls`}>
                      <div className="flex w-full max-w-[28px] flex-col-reverse overflow-hidden rounded-md bg-slate-100" style={{ height: `${height}px` }}>
                        <div className="bg-emerald-500" style={{ height: `${answeredPct}%` }} />
                        <div className="bg-rose-400" style={{ height: `${noAnswerPct}%` }} />
                        <div className="bg-amber-400" style={{ height: `${droppedPct}%` }} />
                        <div className="bg-slate-300" style={{ height: `${unknownPct}%` }} />
                      </div>
                      <div className="mt-2 truncate text-[8px] text-slate-400">{shortDate(point.date)}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-[8px] text-slate-500">
                {[
                  ['bg-emerald-500', 'Answered'],
                  ['bg-rose-400', 'No Answer'],
                  ['bg-amber-400', 'Caller Dropped'],
                  ['bg-slate-300', 'Unknown'],
                ].map(([dot, label]) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${dot}`} />
                    {label}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-[10px] text-slate-400">No calls in this period</div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-[12px] font-semibold text-slate-950">Operational nuances</h3>
            <p className="mt-1 text-[9px] text-slate-400">
              Detailed reasons behind Answered and No Answer — useful for routing, staffing and call quality.
            </p>
          </div>
          <AlertTriangle size={16} className="text-slate-300" />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Nuance label="Customer ended connected call" value={integer(data.customer_disconnected)} helper="Answered calls where the caller/customer disconnected" icon={<UserRoundX size={14} />} />
          <Nuance label="Agent ended connected call" value={integer(data.agent_disconnected)} helper="Answered calls where the destination/agent disconnected" icon={<UserCheck size={14} />} />
          <Nuance label="Caller dropped before answer" value={integer(data.caller_dropped)} helper="Customer disconnected before positive connection evidence" icon={<XCircle size={14} />} />
          <Nuance label="Business routing unanswered" value={integer(data.business_routing_unanswered)} helper="Provider reached routing/team but no agent answered" icon={<PhoneMissed size={14} />} />
          <Nuance label="User unreachable" value={integer(data.user_unreachable)} helper="Provider explicitly reported the customer as unreachable" icon={<UserRoundX size={14} />} />
          <Nuance label="Network failure" value={integer(data.network_failure)} helper="Provider/network evidence indicates a transport failure" icon={<AlertTriangle size={14} />} />
          <Nuance label="Connected ≥ 20s" value={integer(data.quality_connected)} helper="Connected calls at or above the current contact-quality threshold" icon={<CheckCircle2 size={14} />} />
          <Nuance label="Short connected calls" value={integer(data.short_connected)} helper="Answered calls below the contact-quality threshold" icon={<Timer size={14} />} />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h3 className="text-[12px] font-semibold text-slate-950">Lead funnel</h3>
            <p className="mt-1 text-[9px] text-slate-400">Commercial progression for leads created in the selected period</p>
          </div>

          <div className="mt-4 space-y-4">
            {[
              ['Call Leads', n(data.calls), 100, 'bg-blue-500'],
              ['Connected', n(data.connected), n(data.calls) ? (n(data.connected) / n(data.calls)) * 100 : 0, 'bg-emerald-500'],
              ['Qualified', n(data.qualified), n(data.qualification_rate), 'bg-violet-500'],
              ['Purchased', n(data.purchased), n(data.call_purchase_rate), 'bg-amber-500'],
            ].map(([label, value, rate, bar]: any) => (
              <Progress key={label} label={label} count={value} rate={rate} bar={bar} />
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            <Nuance label="Qualified → Purchase" value={percent(data.qualified_purchase_rate)} helper="Conversion among commercially qualified leads" icon={<ShoppingCart size={14} />} />
            <Nuance label="Revenue" value={currency(data.revenue)} helper={`${currency(data.avg_order_value)} average purchased order`} icon={<IndianRupee size={14} />} />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <Nuance label="Follow-up" value={integer(data.follow_up)} helper="Active follow-up leads" icon={<Repeat2 size={14} />} />
            <Nuance label="Unqualified" value={integer(data.unqualified)} helper="Final unqualified leads" icon={<UserRoundX size={14} />} />
            <Nuance label="Closed Lost" value={integer(data.closed_lost)} helper="Qualified leads later closed lost" icon={<XCircle size={14} />} />
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start justify-between border-b border-slate-100 px-4 py-4">
            <div>
              <h3 className="text-[12px] font-semibold text-slate-950">Agent performance</h3>
              <p className="mt-1 text-[9px] text-slate-400">Volume, answer efficiency and connected-call talk time</p>
            </div>
            <Users size={16} className="text-slate-300" />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  {['Agent','Calls','Answered','No Answer','Dropped','Answer %','Avg Talk'].map((label, index) => (
                    <th key={label} className={`px-4 py-2.5 text-[8px] font-semibold uppercase tracking-wide text-slate-400 ${index ? 'text-right' : 'text-left'}`}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.length ? agents.map((agent, index) => (
                  <tr key={`${agent.agent_name}-${index}`} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[8px] font-bold text-slate-600">{initials(agent.agent_name)}</div>
                        <span className="text-[10px] font-semibold text-slate-800">{agent.agent_name}</span>
                      </div>
                    </td>
                    {[integer(agent.calls),integer(agent.answered),integer(agent.no_answer),integer(agent.caller_dropped),percent(agent.answer_rate),duration(agent.avg_talk_time_seconds)].map((value, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-3 text-right text-[10px] text-slate-600">{value}</td>
                    ))}
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-[10px] text-slate-400">No agent call data for this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[12px] font-semibold text-slate-950">Hour-of-day performance</h3>
              <p className="mt-1 text-[9px] text-slate-400">Call volume and answer rate by India local hour</p>
            </div>
            <Clock3 size={16} className="text-slate-300" />
          </div>

          <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-8 xl:grid-cols-12">
            {Array.from({ length: 24 }).map((_, hour) => {
              const row = hourly.find((item) => n(item.hour) === hour) || {};
              const calls = n(row.calls);
              const intensity = calls ? 0.16 + 0.74 * (calls / maxHourly) : 0.04;
              return (
                <div
                  key={hour}
                  className="rounded-lg border border-slate-100 p-2 text-center"
                  style={{ backgroundColor: `rgba(59,130,246,${intensity})` }}
                  title={`${hour}:00 — ${calls} calls, ${percent(row.answer_rate)}`}
                >
                  <div className="text-[8px] font-semibold text-slate-600">{String(hour).padStart(2, '0')}</div>
                  <div className="mt-1 text-[11px] font-bold text-slate-900">{integer(calls)}</div>
                  <div className="mt-0.5 text-[7px] text-slate-600">{percent(row.answer_rate, 0)}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h3 className="text-[12px] font-semibold text-slate-950">Call quality & repeat behaviour</h3>
            <p className="mt-1 text-[9px] text-slate-400">Signals that explain operational load</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Nuance label="Repeat leads" value={integer(data.repeat_leads)} helper="Leads with more than one call attempt" icon={<Repeat2 size={14} />} />
            <Nuance label="Median talk time" value={duration(data.median_talk_time_seconds)} helper="Median duration across answered calls" icon={<Timer size={14} />} />
            <Nuance label="Longest answered" value={duration(data.longest_answered_seconds)} helper="Longest answered call in the period" icon={<Clock3 size={14} />} />
            <Nuance label="Unknown outcomes" value={integer(data.unknown)} helper="Calls where provider evidence is insufficient" icon={<AlertTriangle size={14} />} />
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-[12px] font-semibold text-slate-950">Lead status distribution</h3>
          <div className="mt-4 space-y-3">
            {statuses.length ? statuses.map((row) => (
              <Progress
                key={String(row.status)}
                label={String(row.status || 'UNKNOWN').replaceAll('_', ' ')}
                count={n(row.leads)}
                rate={statusTotal ? (n(row.leads) / statusTotal) * 100 : 0}
                bar={row.status === 'PURCHASED' ? 'bg-emerald-500' : row.status === 'QUALIFIED' ? 'bg-violet-500' : row.status === 'FOLLOW_UP' ? 'bg-amber-500' : row.status === 'UNQUALIFIED' || row.status === 'CLOSED_LOST' ? 'bg-rose-400' : 'bg-blue-400'}
              />
            )) : <div className="py-8 text-center text-[10px] text-slate-400">No lead status data</div>}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-[12px] font-semibold text-slate-950">Business numbers</h3>
          <p className="mt-1 text-[9px] text-slate-400">Distribution across brand-side calling numbers</p>
          <div className="mt-4 space-y-3">
            {businessNumbers.length ? businessNumbers.map((row) => (
              <div key={String(row.business_number)} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                <div className="text-[10px] font-semibold text-slate-700">{row.business_number}</div>
                <div className="text-[10px] text-slate-500">{integer(row.calls)} calls</div>
              </div>
            )) : <div className="py-8 text-center text-[10px] text-slate-400">No business-number data in this period</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
