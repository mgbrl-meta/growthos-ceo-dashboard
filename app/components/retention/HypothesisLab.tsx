'use client';

import { useEffect, useMemo, useState } from 'react';

const money = (value: number) =>
  `INR ${Math.round(value || 0).toLocaleString('en-IN')}`;

export default function HypothesisLab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState('All');

  useEffect(() => {
    async function loadHypotheses() {
      setLoading(true);

      try {
        const res = await fetch('/api/retention-os/hypotheses', {
          cache: 'no-store',
        });

        const json = await res.json();

        setRows(Array.isArray(json) ? json : []);
      } catch (error) {
        console.error('Hypothesis fetch error', error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    loadHypotheses();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch = `${row.hypothesis || ''} ${row.product_title || ''} ${row.routine || ''} ${row.action_type || ''}`
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesType =
        actionType === 'All' || row.action_type === actionType;

      return matchesSearch && matchesType;
    });
  }, [rows, search, actionType]);

  const totalExpectedProfit = filtered.reduce(
    (sum, row) => sum + Number(row.expected_profit || 0),
    0
  );

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">
        Hypothesis Lab
      </p>

      <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
        What Should We Test?
      </h2>

      <p className="mt-2 text-sm text-slate-500">
        Live hypotheses generated from product, purchase-sequence and LTV patterns.
      </p>

      {loading && (
        <p className="mt-3 text-xs font-bold text-blue-600">
          Loading hypotheses...
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Card label="Hypotheses" value={filtered.length.toString()} />
        <Card label="Expected Profit" value={money(totalExpectedProfit)} />
        <Card
          label="Avg Confidence"
          value={`${Math.round(
            filtered.reduce((s, r) => s + Number(r.confidence || 0), 0) /
              Math.max(filtered.length, 1)
          )}%`}
        />
        <Card
          label="Products"
          value={new Set(filtered.map((r) => r.sku)).size.toString()}
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search hypotheses..."
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />

        <select
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        >
          <option>All</option>
          <option>Acquisition Mix</option>
          <option>Second Purchase</option>
          <option>Retention Test</option>
        </select>
      </div>

      <div className="mt-5 overflow-x-auto rounded-3xl border border-slate-200">
        <table className="w-full min-w-[1500px] text-left">
          <thead className="bg-slate-100 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="p-4">Hypothesis</th>
              <th className="p-4">Pattern</th>
              <th className="p-4">Product</th>
              <th className="p-4">Routine</th>
              <th className="p-4">Role</th>
              <th className="p-4">Customers</th>
              <th className="p-4">Avg LTV</th>
              <th className="p-4">Success Rate</th>
              <th className="p-4">Expected Revenue</th>
              <th className="p-4">Expected Profit</th>
              <th className="p-4">Confidence</th>
              <th className="p-4">Action Type</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((row) => (
              <tr
                key={`${row.pattern_type}-${row.sku}-${row.hypothesis}`}
                className="border-t border-slate-100"
              >
                <td className="p-4 font-black text-slate-950">
                  {row.hypothesis}
                </td>

                <td className="p-4 text-blue-700 font-bold">
                  {row.pattern_type}
                </td>

                <td className="p-4 font-bold">
                  {row.product_title}
                </td>

                <td className="p-4">
                  {row.routine || 'Unmapped'}
                </td>

                <td className="p-4">
                  {row.role || 'Unmapped'}
                </td>

                <td className="p-4">
                  {Number(row.customers || 0).toLocaleString('en-IN')}
                </td>

                <td className="p-4 font-bold">
                  {money(Number(row.avg_ltv || 0))}
                </td>

                <td className="p-4">
                  {(Number(row.success_rate || 0) * 100).toFixed(1)}%
                </td>

                <td className="p-4 font-bold">
                  {money(Number(row.expected_revenue || 0))}
                </td>

                <td className="p-4 font-bold">
                  {money(Number(row.expected_profit || 0))}
                </td>

                <td className="p-4">
                  {Number(row.confidence || 0)}%
                </td>

                <td className="p-4">
                  {row.action_type}
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  className="p-8 text-center text-sm font-bold text-slate-500"
                >
                  No hypotheses found. Pattern data or mapped product data may still be incomplete.
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

      <p className="mt-2 text-2xl font-black text-slate-950">
        {value}
      </p>
    </div>
  );
}