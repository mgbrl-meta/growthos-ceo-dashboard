'use client';

import { useEffect, useMemo, useState } from 'react';

import type {
  PatternWorkflowAction,
  PatternWorkflowApiResponse,
} from './types';

const money = (value: number) =>
  `INR ${Math.round(value || 0).toLocaleString('en-IN')}`;

export default function ActionTracker() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadActions() {
      setLoading(true);

      try {
        const [actionResponse, patternResponse] = await Promise.all([
          fetch('/api/retention-os/action-log', {
            cache: 'no-store',
          }),
          fetch('/api/retention-os/pattern-actions', {
            cache: 'no-store',
          }),
        ]);

        const actionJson = await actionResponse.json();
        const patternJson =
          (await patternResponse.json()) as PatternWorkflowApiResponse;

        const actionRows = Array.isArray(actionJson) ? actionJson : [];
        const patternRows: PatternWorkflowAction[] =
          patternJson.ok && Array.isArray(patternJson.data)
            ? patternJson.data
            : [];

        const merged = new Map<string, any>();

        actionRows.forEach((row: any) => {
          if (row.action_id) merged.set(row.action_id, row);
        });

        patternRows.forEach((row) => {
          merged.set(row.action_id, row);
        });

        setRows([...merged.values()]);
      } catch (error) {
        console.error('Action log fetch error', error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    loadActions();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const matchesStatus =
        statusFilter === 'All' || row.status === statusFilter;

      const matchesSearch = `${row.action_title || ''} ${
        row.opportunity_type || ''
      } ${row.opportunity_group || ''} ${row.workflow_type || ''} ${
        row.source_sku || ''
      } ${row.target_sku || ''}`
        .toLowerCase()
        .includes(search.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [rows, statusFilter, search]);

  const totalExpectedRevenue = filtered.reduce(
    (sum, row) => sum + Number(row.expected_revenue || 0),
    0
  );

  const totalExpectedProfit = filtered.reduce(
    (sum, row) => sum + Number(row.expected_profit || 0),
    0
  );

  const patternOriginCount = filtered.filter(
    (row) => row.source_system === 'PATTERN_DISCOVERY'
  ).length;

  const recordLearning = async (row: any) => {
    const actualRevenue = prompt(
      'Enter actual revenue generated',
      String(row.expected_revenue || 0)
    );

    if (actualRevenue === null) return;

    const actualProfit = prompt(
      'Enter actual profit generated',
      String(row.expected_profit || 0)
    );

    if (actualProfit === null) return;

    const learningNote = prompt('Key learning?', '');
    const nextRecommendation = prompt('Next recommendation?', '');

    try {
      const response = await fetch('/api/retention-os/learning-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_id: row.action_id,
          opportunity_type: row.opportunity_type,
          opportunity_group: row.opportunity_group,
          expected_revenue: row.expected_revenue,
          expected_profit: row.expected_profit,
          actual_revenue: Number(actualRevenue || 0),
          actual_profit: Number(actualProfit || 0),
          result: 'Completed',
          learning_note: learningNote || '',
          next_recommendation: nextRecommendation || '',
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || 'Failed');
      }

      alert('Learning recorded.');
    } catch (error) {
      console.error(error);
      alert('Failed to record learning.');
    }
  };

  const updateActionStatus = async (actionId: string, status: string) => {
    try {
      const response = await fetch('/api/retention-os/action-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: actionId, status }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || 'Update failed');
      }

      setRows((previous) =>
        previous.map((row) =>
          row.action_id === actionId ? { ...row, status } : row
        )
      );
    } catch (error) {
      console.error(error);
      alert('Failed to update action status.');
    }
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">
        Action Tracker
      </p>

      <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
        Retention Execution Queue
      </h2>

      <p className="mt-2 text-sm text-slate-500">
        Track planned, running and completed retention actions with Pattern
        Discovery lineage.
      </p>

      {loading && (
        <p className="mt-3 text-xs font-bold text-blue-600">
          Loading action log...
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-5">
        <Card label="Actions" value={filtered.length.toString()} />
        <Card label="Pattern-Origin" value={patternOriginCount.toString()} />
        <Card label="Expected Revenue" value={money(totalExpectedRevenue)} />
        <Card label="Expected Profit" value={money(totalExpectedProfit)} />
        <Card
          label="Running"
          value={filtered
            .filter((row) => row.status === 'Running')
            .length.toString()}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search actions, pattern or SKU..."
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        >
          <option>All</option>
          <option>Planned</option>
          <option>Running</option>
          <option>Completed</option>
          <option>Cancelled</option>
        </select>
      </div>

      <div className="mt-5 overflow-x-auto rounded-3xl border border-slate-200">
        <table className="w-full min-w-[1750px] text-left">
          <thead className="bg-slate-100 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="p-4">Action</th>
              <th className="p-4">Source</th>
              <th className="p-4">Opportunity</th>
              <th className="p-4">Source → Target</th>
              <th className="p-4">Channel</th>
              <th className="p-4">Customers</th>
              <th className="p-4">Revenue</th>
              <th className="p-4">Profit</th>
              <th className="p-4">Status</th>
              <th className="p-4">Planned Date</th>
              <th className="p-4">Notes</th>
              <th className="p-4">Learning</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.action_id}
                className="border-t border-slate-100 align-top"
              >
                <td className="p-4">
                  <p className="max-w-[300px] font-black text-slate-950">
                    {row.action_title}
                  </p>
                  {row.priority_band && (
                    <p className="mt-1 text-xs font-black text-blue-700">
                      {row.priority_band} · Score{' '}
                      {Number(row.operator_priority_score || 0).toFixed(1)}
                    </p>
                  )}
                </td>

                <td className="p-4">
                  {row.source_system === 'PATTERN_DISCOVERY' ? (
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black text-blue-700">
                      Pattern Discovery
                    </span>
                  ) : (
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600">
                      Existing Planner
                    </span>
                  )}
                </td>

                <td className="p-4">
                  <p className="font-bold">{row.opportunity_type}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.workflow_type || row.opportunity_group}
                  </p>
                </td>

                <td className="p-4">
                  <p className="font-bold">{row.source_sku || '—'}</p>
                  {row.target_sku && (
                    <p className="mt-1 text-blue-700">→ {row.target_sku}</p>
                  )}
                </td>

                <td className="p-4">{row.channel}</td>

                <td className="p-4">
                  {Number(row.expected_customers || 0).toLocaleString('en-IN')}
                  {row.evidence_support ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Evidence:{' '}
                      {Number(row.evidence_support).toLocaleString('en-IN')}
                    </p>
                  ) : null}
                </td>

                <td className="p-4 font-bold">
                  {money(Number(row.expected_revenue || 0))}
                </td>

                <td className="p-4 font-bold">
                  {money(Number(row.expected_profit || 0))}
                </td>

                <td className="p-4">
                  <select
                    value={row.status || 'Planned'}
                    onChange={(event) =>
                      updateActionStatus(row.action_id, event.target.value)
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black"
                  >
                    <option>Planned</option>
                    <option>Running</option>
                    <option>Completed</option>
                    <option>Cancelled</option>
                  </select>
                </td>

                <td className="p-4">
                  {typeof row.planned_date === 'object'
                    ? row.planned_date?.value || ''
                    : row.planned_date || ''}
                </td>

                <td className="p-4">
                  <p className="max-w-[330px] text-sm leading-5 text-slate-500">
                    {row.notes}
                  </p>
                </td>

                <td className="p-4">
                  <button
                    type="button"
                    onClick={() => recordLearning(row)}
                    className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white"
                  >
                    Record Learning
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  className="p-8 text-center text-sm font-bold text-slate-500"
                >
                  No actions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}
