'use client';

import { useEffect, useMemo, useState } from 'react';

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
        const res = await fetch('/api/retention-os/action-log');
        const json = await res.json();

        setRows(Array.isArray(json) ? json : []);
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

      const matchesSearch = `${row.action_title || ''} ${row.opportunity_type || ''} ${row.opportunity_group || ''}`
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

    const learningNote = prompt(
      'Key learning?',
      ''
    );

    const nextRecommendation = prompt(
      'Next recommendation?',
      ''
    );

    try {
      const res = await fetch('/api/retention-os/learning-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      const json = await res.json();

      if (!res.ok) {
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
      const res = await fetch('/api/retention-os/action-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_id: actionId,
          status,
        }),
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json?.error || 'Update failed');

      setRows((prev) =>
        prev.map((row) =>
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
        Track planned, running and completed retention actions.
      </p>

      {loading && (
        <p className="mt-3 text-xs font-bold text-blue-600">
          Loading action log...
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Card
          label="Actions"
          value={filtered.length.toString()}
        />

        <Card
          label="Expected Revenue"
          value={money(totalExpectedRevenue)}
        />

        <Card
          label="Expected Profit"
          value={money(totalExpectedProfit)}
        />

        <Card
          label="Running"
          value={
            filtered.filter((r) => r.status === 'Running').length.toString()
          }
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search actions..."
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
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
        <table className="w-full min-w-[1500px] text-left">
          <thead className="bg-slate-100 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="p-4">Action</th>
              <th className="p-4">Opportunity</th>
              <th className="p-4">Segment</th>
              <th className="p-4">Channel</th>
              <th className="p-4">Customers</th>
              <th className="p-4">Revenue</th>
              <th className="p-4">Profit</th>
              <th className="p-4">Status</th>
              <th className="p-4">Planned Date</th>
              <th className="p-4">Notes</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.action_id}
                className="border-t border-slate-100"
              >
                <td className="p-4 font-black">
                  {row.action_title}
                </td>

                <td className="p-4">
                  {row.opportunity_type}
                </td>

                <td className="p-4">
                  {row.opportunity_group}
                </td>

                <td className="p-4">
                  {row.channel}
                </td>

                <td className="p-4">
                  {Number(row.expected_customers || 0).toLocaleString('en-IN')}
                </td>

                <td className="p-4 font-bold">
                  {money(row.expected_revenue)}
                </td>

                <td className="p-4 font-bold">
                  {money(row.expected_profit)}
                </td>

                <td className="p-4">
                  <select
                    value={row.status || 'Planned'}
                    onChange={(e) => updateActionStatus(row.action_id, e.target.value)}
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

                <td className="p-4 text-slate-500">
                  {row.notes}
                </td>

                <td className="p-4">
                  <button
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
                  colSpan={10}
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

function Card({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-slate-950">
        {value}
      </p>
    </div>
  );
}