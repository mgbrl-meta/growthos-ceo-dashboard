'use client';

import { useEffect, useMemo, useState } from 'react';
import { getScoreLabel } from './engine/scoring';

type OpportunityRow = {
  opportunity_type: string;
  opportunity_group: string;
  customers: number;
  historical_routine_revenue: number;
  estimated_revenue: number;
  estimated_profit: number;
  reason: string;
  recommended_action: string;
  action_type: string;
  difficulty: string;
  confidence: number;
  detected_date: any;
};

const money = (value: number) =>
  `INR ${Math.round(value || 0).toLocaleString('en-IN')}`;

function ScorePill({ score }: { score: number }) {
  return (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
      {score} {getScoreLabel(score)}
    </span>
  );
}

function StatusPill({ value }: { value: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
      {value}
    </span>
  );
}

export default function OpportunityBank() {
  const [rows, setRows] = useState<OpportunityRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState('All');
  const [status, setStatus] = useState('All');
  const [minimumScore, setMinimumScore] = useState(0);
  const [sortBy, setSortBy] = useState('Score');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function loadOpportunities() {
      setLoading(true);

      try {
        const res = await fetch('/api/retention-os/opportunities');
        const json = await res.json();

        setRows(Array.isArray(json) ? json : []);
      } catch (error) {
        console.error('Retention opportunities fetch error', error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    loadOpportunities();
  }, []);

  const allRows = rows.map((row) => {
    const easeScore =
      row.difficulty === 'Low'
        ? 90
        : row.difficulty === 'Medium'
          ? 70
          : 45;

    const score = Math.round(
      Math.min(100, Number(row.estimated_profit || 0) / 10000) * 0.7 +
        Number(row.confidence || 0) * 0.2 +
        easeScore * 0.1
    );

    return {
      id: `${row.opportunity_type}-${row.opportunity_group}`,
      title: `${String(row.opportunity_type || '').replaceAll('_', ' ')} - ${
        row.opportunity_group
      }`,
      reason: row.reason,
      segment: row.opportunity_group,
      customers: Number(row.customers || 0),
      potentialRevenue: Number(row.estimated_revenue || 0),
      potentialProfit: Number(row.estimated_profit || 0),
      confidence: Number(row.confidence || 0),
      difficulty: row.difficulty,
      recommendedAction: row.recommended_action,
      actionType: row.action_type,
      expectedImpact: `${money(Number(row.estimated_profit || 0))} profit potential`,
      executionEffort: row.difficulty,
      source: row.opportunity_type,
      detectedAt:
        typeof row.detected_date === 'object'
          ? row.detected_date?.value || ''
          : row.detected_date || '',
      status: 'New',
      score,
    };
  });

  const createAction = async (row: any) => {
    try {
      const res = await fetch('/api/retention-os/action-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_type: row.source,
          opportunity_group: row.segment,
          action_title: row.recommendedAction,
          channel: row.actionType,
          audience: row.segment,
          expected_revenue: row.potentialRevenue,
          expected_profit: row.potentialProfit,
          expected_customers: row.customers,
          status: 'Planned',
          planned_date: new Date().toISOString().slice(0, 10),
          notes: row.reason,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || 'Save failed');
      }

      alert('Action created in Action Log.');
    } catch (error) {
      console.error(error);
      alert('Failed to create action.');
    }
  };

  const filtered = useMemo(() => {
    const filteredRows = allRows.filter((row) => {
      const matchesSearch = `${row.title} ${row.reason} ${row.segment} ${row.status} ${row.recommendedAction} ${row.actionType}`
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesActionType =
        actionType === 'All' || row.actionType === actionType;

      const matchesStatus = status === 'All' || row.status === status;

      const matchesScore = row.score >= minimumScore;

      return matchesSearch && matchesActionType && matchesStatus && matchesScore;
    });

    return [...filteredRows].sort((a, b) => {
      if (sortBy === 'Potential Profit') {
        return b.potentialProfit - a.potentialProfit;
      }

      if (sortBy === 'Confidence') {
        return b.confidence - a.confidence;
      }

      if (sortBy === 'Customers') {
        return b.customers - a.customers;
      }

      return b.score - a.score;
    });
  }, [allRows, search, actionType, status, minimumScore, sortBy]);

  const totalProfit = filtered.reduce(
    (sum, row) => sum + row.potentialProfit,
    0
  );

  const highScoreCount = filtered.filter((row) => row.score >= 85).length;

  const lowEffortCount = filtered.filter(
    (row) => row.executionEffort === 'Low'
  ).length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">
        Opportunity Bank
      </p>

      <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
        Retention Opportunity Work Queue
      </h2>

      <p className="mt-2 text-sm text-slate-500">
        Ranked by priority, potential profit, confidence, action type and execution effort.
      </p>

      {loading && (
        <p className="mt-3 text-xs font-bold text-blue-600">
          Loading live retention opportunities...
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <SummaryCard label="Opportunities" value={filtered.length.toString()} />
        <SummaryCard label="Potential Profit" value={money(totalProfit)} />
        <SummaryCard label="High Score" value={highScoreCount.toString()} />
        <SummaryCard label="Low Effort" value={lowEffortCount.toString()} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search opportunities..."
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />

        <select
          value={actionType}
          onChange={(e) => {
            setActionType(e.target.value);
            setPage(1);
          }}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        >
          <option>All</option>
          <option>WhatsApp</option>
          <option>Email</option>
          <option>SMS/RCS</option>
          <option>Cross Sell</option>
          <option>Replenishment</option>
          <option>Winback</option>
          <option>Retention</option>
          <option>Repeat Purchase</option>
          <option>Subscription</option>
          <option>Bundle</option>
          <option>Journey</option>
          <option>Support</option>
        </select>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        >
          <option>All</option>
          <option>New</option>
          <option>Investigating</option>
          <option>Testing</option>
          <option>Running</option>
          <option>Validated</option>
          <option>Failed</option>
          <option>Archived</option>
        </select>

        <select
          value={minimumScore}
          onChange={(e) => {
            setMinimumScore(Number(e.target.value));
            setPage(1);
          }}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        >
          <option value={0}>Any Score</option>
          <option value={95}>Elite 95+</option>
          <option value={85}>High 85+</option>
          <option value={70}>Medium 70+</option>
          <option value={50}>Low 50+</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value);
            setPage(1);
          }}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        >
          <option>Score</option>
          <option>Potential Profit</option>
          <option>Confidence</option>
          <option>Customers</option>
        </select>

        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        >
          <option value={20}>20 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
      </div>

      <div className="mt-5 overflow-x-auto rounded-3xl border border-slate-200">
        <table className="w-full min-w-[1900px] text-left">
          <thead className="bg-slate-100 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="p-4">Rank</th>
              <th className="p-4">Score</th>
              <th className="p-4">Opportunity</th>
              <th className="p-4">Reason</th>
              <th className="p-4">Segment</th>
              <th className="p-4">Customers</th>
              <th className="p-4">Revenue</th>
              <th className="p-4">Profit</th>
              <th className="p-4">Confidence</th>
              <th className="p-4">Difficulty</th>
              <th className="p-4">Recommended Action</th>
              <th className="p-4">Action Type</th>
              <th className="p-4">Expected Impact</th>
              <th className="p-4">Effort</th>
              <th className="p-4">Source</th>
              <th className="p-4">Detected</th>
              <th className="p-4">Status</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>

          <tbody>
            {paginated.map((row, index) => (
              <tr key={row.id} className="border-t border-slate-100 align-top">
                <td className="p-4 font-black text-slate-950">
                  #{(page - 1) * pageSize + index + 1}
                </td>

                <td className="p-4">
                  <ScorePill score={row.score} />
                </td>

                <td className="p-4 font-black text-slate-950">{row.title}</td>

                <td className="p-4 text-slate-600">{row.reason}</td>

                <td className="p-4">{row.segment}</td>

                <td className="p-4">
                  {row.customers.toLocaleString('en-IN')}
                </td>

                <td className="p-4 font-bold">
                  {money(row.potentialRevenue)}
                </td>

                <td className="p-4 font-bold">
                  {money(row.potentialProfit)}
                </td>

                <td className="p-4">{row.confidence}%</td>

                <td className="p-4">{row.difficulty}</td>

                <td className="p-4 font-semibold text-blue-700">
                  {row.recommendedAction}
                </td>

                <td className="p-4">{row.actionType}</td>

                <td className="p-4 font-bold text-slate-700">
                  {row.expectedImpact}
                </td>

                <td className="p-4">{row.executionEffort}</td>

                <td className="p-4">{row.source}</td>

                <td className="p-4">{row.detectedAt}</td>

                <td className="p-4">
                  <StatusPill value={row.status} />
                </td>

                <td className="p-4">
                  <div className="flex flex-col gap-2">
                    <button className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">
                      Investigate
                    </button>

                    <button
                      onClick={() => createAction(row)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700"
                    >
                      Create Action
                    </button>

                    <button className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-black text-red-700">
                      Ignore
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {paginated.length === 0 && (
              <tr>
                <td
                  colSpan={18}
                  className="p-8 text-center text-sm font-bold text-slate-500"
                >
                  No opportunities found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs font-bold text-slate-400">
        <p>
          Showing {paginated.length} of {filtered.length} opportunities
        </p>

        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-xl border border-slate-200 px-3 py-2 disabled:opacity-40"
          >
            Previous
          </button>

          <span>
            Page {page} of {totalPages}
          </span>

          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-xl border border-slate-200 px-3 py-2 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}