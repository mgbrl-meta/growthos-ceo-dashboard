'use client';

import { useEffect, useMemo, useState } from 'react';

const money = (value: number) =>
  `INR ${Math.round(value || 0).toLocaleString('en-IN')}`;

const formatDate = (value: any) => {
  if (!value) return '';
  if (typeof value === 'object') return value.value || '';
  return value;
};

export default function DailyPlanner() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingAction, setCreatingAction] = useState('');

  useEffect(() => {
    async function loadDailyPlanner() {
      setLoading(true);

      try {
        const res = await fetch('/api/retention-os/daily-planner', {
          cache: 'no-store',
        });

        const json = await res.json();

        setRows(Array.isArray(json) ? json : []);
      } catch (error) {
        console.error('Daily planner fetch error', error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    loadDailyPlanner();
  }, []);

  const summary = useMemo(() => {
    return {
      actions: rows.length,
      customers: rows.reduce((sum, row) => sum + Number(row.customers || 0), 0),
      revenue: rows.reduce(
        (sum, row) => sum + Number(row.expected_revenue || 0),
        0
      ),
      profit: rows.reduce(
        (sum, row) => sum + Number(row.expected_profit || 0),
        0
      ),
      weightedProfit: rows.reduce(
        (sum, row) => sum + Number(row.confidence_weighted_profit || 0),
        0
      ),
    };
  }, [rows]);

  const createAction = async (row: any) => {
    const key = `${row.priority_rank}-${row.best_action}`;

    setCreatingAction(key);

    try {
      const res = await fetch('/api/retention-os/action-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_type: row.opportunity_type,
          opportunity_group: row.best_action,
          action_title: row.recommended_execution,
          channel: 'WhatsApp',
          audience: row.message_theme,
          expected_revenue: row.expected_revenue,
          expected_profit: row.expected_profit,
          expected_customers: row.customers,
          status: 'Planned',
          planned_date: new Date().toISOString().slice(0, 10),
          notes: `Daily Planner v2 | ${row.reason || ''}`,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || 'Failed to create action');
      }

      alert('Action created in Action Tracker.');
    } catch (error) {
      console.error(error);
      alert('Failed to create action.');
    } finally {
      setCreatingAction('');
    }
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">
        Daily Planner
      </p>

      <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
        What Should We Do Today?
      </h2>

      <p className="mt-2 text-sm text-slate-500">
        Combines strategic opportunities, customer priority, next best action,
        learning accuracy and action suppression.
      </p>

      {loading && (
        <p className="mt-3 text-xs font-bold text-blue-600">
          Loading today's retention plan...
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-5">
        <Card label="Actions" value={summary.actions.toString()} />
        <Card
          label="Customers"
          value={summary.customers.toLocaleString('en-IN')}
        />
        <Card label="Expected Revenue" value={money(summary.revenue)} />
        <Card label="Expected Profit" value={money(summary.profit)} />
        <Card
          label="Weighted Profit"
          value={money(summary.weightedProfit)}
        />
      </div>

      <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-200">
        <table className="w-full min-w-[1800px] text-left">
          <thead className="bg-slate-100 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="p-4">Rank</th>
              <th className="p-4">Send Date</th>
              <th className="p-4">Action</th>
              <th className="p-4">Message Theme</th>
              <th className="p-4">Opportunity</th>
              <th className="p-4">Customers</th>
              <th className="p-4">Avg Priority</th>
              <th className="p-4">Confidence</th>
              <th className="p-4">Learning</th>
              <th className="p-4">Expected Revenue</th>
              <th className="p-4">Expected Profit</th>
              <th className="p-4">Weighted Profit</th>
              <th className="p-4">Reason</th>
              <th className="p-4">Execution</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const key = `${row.priority_rank}-${row.best_action}`;

              return (
                <tr key={key} className="border-t border-slate-100 align-top">
                  <td className="p-4 font-black">#{row.priority_rank}</td>

                  <td className="p-4">{formatDate(row.send_date)}</td>

                  <td className="p-4 font-black text-slate-950">
                    {row.best_action}
                  </td>

                  <td className="p-4">{row.message_theme}</td>

                  <td className="p-4">{row.opportunity_type}</td>

                  <td className="p-4">
                    {Number(row.customers || 0).toLocaleString('en-IN')}
                  </td>

                  <td className="p-4">
                    {Math.round(Number(row.avg_customer_priority || 0))}
                  </td>

                  <td className="p-4">
                    {Math.round(Number(row.avg_customer_confidence || 0))}%
                  </td>

                  <td className="p-4">
                    {Math.round(Number(row.learning_accuracy || 1) * 100)}%
                  </td>

                  <td className="p-4 font-bold">
                    {money(Number(row.expected_revenue || 0))}
                  </td>

                  <td className="p-4 font-bold">
                    {money(Number(row.expected_profit || 0))}
                  </td>

                  <td className="p-4 font-bold text-blue-700">
                    {money(Number(row.confidence_weighted_profit || 0))}
                  </td>

                  <td className="p-4 text-slate-600">{row.reason}</td>

                  <td className="p-4 font-semibold text-blue-700">
                    {row.recommended_execution}
                  </td>

                  <td className="p-4">
                    <button
                      onClick={() => createAction(row)}
                      disabled={creatingAction === key}
                      className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:opacity-40"
                    >
                      {creatingAction === key
                        ? 'Creating...'
                        : 'Create Action'}
                    </button>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={15}
                  className="p-8 text-center text-sm font-bold text-slate-500"
                >
                  No daily planner rows found.
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