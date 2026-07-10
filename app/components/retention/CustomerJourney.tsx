'use client';

import { useEffect, useMemo, useState } from 'react';

const money = (value: number) =>
  `INR ${Math.round(value || 0).toLocaleString('en-IN')}`;

export default function CustomerJourney() {
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [stageFilter, setStageFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadJourney() {
      setLoading(true);

      try {
        const journeyRes = await fetch('/api/retention-os/customer-journey', {
          cache: 'no-store',
        });

        const journeyJson = await journeyRes.json();
        setRows(Array.isArray(journeyJson) ? journeyJson : []);

        const summaryRes = await fetch(
          '/api/retention-os/customer-journey-summary',
          { cache: 'no-store' }
        );

        const summaryJson = await summaryRes.json();
        setSummary(Array.isArray(summaryJson) ? summaryJson : []);
      } catch (error) {
        console.error('Customer journey fetch error', error);
        setRows([]);
        setSummary([]);
      } finally {
        setLoading(false);
      }
    }

    loadJourney();
  }, []);

  const journeyStates = useMemo(() => {
    return ['All', ...Array.from(new Set(rows.map((row) => row.journey_state).filter(Boolean)))];
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const matchesStage =
        stageFilter === 'All' || row.journey_stage === stageFilter;

      const matchesState =
        stateFilter === 'All' || row.journey_state === stateFilter;

      const matchesSearch = `${row.customer_key || ''} ${row.journey_stage || ''} ${row.journey_state || ''}`
        .toLowerCase()
        .includes(search.toLowerCase());

      return matchesStage && matchesState && matchesSearch;
    });
  }, [rows, stageFilter, stateFilter, search]);

  const totalCustomers = filtered.length;

  const totalRevenue = filtered.reduce(
    (sum, row) => sum + Number(row.qualified_revenue || 0),
    0
  );

  const avgOrders =
    filtered.reduce((sum, row) => sum + Number(row.qualified_orders || 0), 0) /
    Math.max(filtered.length, 1);

  const avgStateScore =
    filtered.reduce((sum, row) => sum + Number(row.state_score || 0), 0) /
    Math.max(filtered.length, 1);

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">
        Customer Journey
      </p>

      <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
        Journey State Engine
      </h2>

      <p className="mt-2 text-sm text-slate-500">
        Shows journey stage, timing state, base probability, multiplier and state score.
      </p>

      {loading && (
        <p className="mt-3 text-xs font-bold text-blue-600">
          Loading customer journey...
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Card label="Customers" value={totalCustomers.toLocaleString('en-IN')} />
        <Card label="Revenue" value={money(totalRevenue)} />
        <Card label="Avg Orders" value={avgOrders.toFixed(2)} />
        <Card label="Avg State Score" value={avgStateScore.toFixed(3)} />
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
          Journey State Summary
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3">Stage</th>
                <th className="p-3">State</th>
                <th className="p-3">Customers</th>
                <th className="p-3">Revenue</th>
                <th className="p-3">Avg State Score</th>
                <th className="p-3">Avg Days Since Last</th>
              </tr>
            </thead>

            <tbody>
              {summary.map((row) => (
                <tr
                  key={`${row.journey_stage}-${row.journey_state}`}
                  className="border-b"
                >
                  <td className="p-3 font-black">{row.journey_stage}</td>
                  <td className="p-3">{row.journey_state}</td>
                  <td className="p-3">
                    {Number(row.customers || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 font-bold">
                    {money(Number(row.revenue || 0))}
                  </td>
                  <td className="p-3">
                    {Number(row.avg_state_score || 0).toFixed(3)}
                  </td>
                  <td className="p-3">
                    {Math.round(Number(row.avg_days_since_last_order || 0))}
                  </td>
                </tr>
              ))}

              {summary.length === 0 && (
                <tr>
                  <td className="p-6 text-sm font-bold text-slate-500" colSpan={6}>
                    No journey summary found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer, stage, state..."
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        >
          <option>All</option>
          <option>First Purchase</option>
          <option>Early Repeat</option>
          <option>Building Habit</option>
          <option>Loyal</option>
          <option>Advocate</option>
        </select>

        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        >
          {journeyStates.map((state) => (
            <option key={state}>{state}</option>
          ))}
        </select>
      </div>

      <div className="mt-5 overflow-x-auto rounded-3xl border border-slate-200">
        <table className="w-full min-w-[1300px] text-left">
          <thead className="bg-slate-100 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="p-4">Customer</th>
              <th className="p-4">Stage</th>
              <th className="p-4">State</th>
              <th className="p-4">Orders</th>
              <th className="p-4">Revenue</th>
              <th className="p-4">Days Since Last</th>
              <th className="p-4">Base Probability</th>
              <th className="p-4">Multiplier</th>
              <th className="p-4">State Score</th>
              <th className="p-4">Calculated</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((row) => (
              <tr key={row.customer_key} className="border-t border-slate-100">
                <td className="p-4 font-black">{row.customer_key}</td>

                <td className="p-4 font-bold text-blue-700">
                  {row.journey_stage}
                </td>

                <td className="p-4">{row.journey_state}</td>

                <td className="p-4">{row.qualified_orders}</td>

                <td className="p-4 font-bold">
                  {money(Number(row.qualified_revenue || 0))}
                </td>

                <td className="p-4">{row.days_since_last_order}</td>

                <td className="p-4">
                  {(Number(row.base_probability || 0) * 100).toFixed(1)}%
                </td>

                <td className="p-4">
                  {Number(row.priority_multiplier || 0).toFixed(2)}
                </td>

                <td className="p-4 font-bold text-blue-700">
                  {Number(row.state_score || 0).toFixed(4)}
                </td>

                <td className="p-4">{String(row.calculated_date || '')}</td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td
                  className="p-8 text-center text-sm font-bold text-slate-500"
                  colSpan={10}
                >
                  No customer journey rows found.
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