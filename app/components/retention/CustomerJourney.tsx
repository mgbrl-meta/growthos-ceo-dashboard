'use client';

import { useEffect, useMemo, useState } from 'react';

const money = (value: number) =>
  `INR ${Math.round(value || 0).toLocaleString('en-IN')}`;

const formatDate = (value: any) => {
  if (!value) return '';
  if (typeof value === 'object') return value.value || '';
  return value;
};

export default function CustomerJourney() {
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [stageFilter, setStageFilter] = useState('All');
  const [healthFilter, setHealthFilter] = useState('All');
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

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const matchesStage =
        stageFilter === 'All' || row.journey_stage === stageFilter;

      const matchesHealth =
        healthFilter === 'All' || row.journey_health === healthFilter;

      const matchesSearch = `${row.customer_key || ''} ${row.journey_stage || ''} ${row.journey_health || ''} ${row.blocker || ''} ${row.revenue_tier || ''}`
        .toLowerCase()
        .includes(search.toLowerCase());

      return matchesStage && matchesHealth && matchesSearch;
    });
  }, [rows, stageFilter, healthFilter, search]);

  const totalCustomers = filtered.length;
  const totalRevenue = filtered.reduce(
    (sum, row) => sum + Number(row.qualified_revenue || 0),
    0
  );

  const avgOrders =
    filtered.reduce((sum, row) => sum + Number(row.qualified_orders || 0), 0) /
    Math.max(filtered.length, 1);

  const criticalCustomers = filtered.filter(
    (row) => row.journey_health === 'Critical'
  ).length;

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">
        Customer Journey
      </p>

      <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
        Journey Stage & Health Engine
      </h2>

      <p className="mt-2 text-sm text-slate-500">
        Shows where each customer is in the brand journey, how healthy that journey is, and what is blocking progression.
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
        <Card label="Critical" value={criticalCustomers.toLocaleString('en-IN')} />
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
          Journey Summary
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3">Stage</th>
                <th className="p-3">Health</th>
                <th className="p-3">Customers</th>
                <th className="p-3">Revenue</th>
                <th className="p-3">Avg Orders</th>
                <th className="p-3">Avg Days Since Last Order</th>
              </tr>
            </thead>

            <tbody>
              {summary.map((row) => (
                <tr
                  key={`${row.journey_stage}-${row.journey_health}`}
                  className="border-b"
                >
                  <td className="p-3 font-black">{row.journey_stage}</td>
                  <td className="p-3">{row.journey_health}</td>
                  <td className="p-3">
                    {Number(row.customers || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 font-bold">
                    {money(Number(row.revenue || 0))}
                  </td>
                  <td className="p-3">
                    {Number(row.avg_orders || 0).toFixed(2)}
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
          placeholder="Search customer, stage, blocker..."
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
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value)}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        >
          <option>All</option>
          <option>Excellent</option>
          <option>Good</option>
          <option>At Risk</option>
          <option>Critical</option>
        </select>
      </div>

      <div className="mt-5 overflow-x-auto rounded-3xl border border-slate-200">
        <table className="w-full min-w-[1600px] text-left">
          <thead className="bg-slate-100 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="p-4">Customer</th>
              <th className="p-4">Stage</th>
              <th className="p-4">Health</th>
              <th className="p-4">Blocker</th>
              <th className="p-4">Next Goal</th>
              <th className="p-4">Orders</th>
              <th className="p-4">Revenue</th>
              <th className="p-4">Revenue Tier</th>
              <th className="p-4">Age Days</th>
              <th className="p-4">Days Since Last</th>
              <th className="p-4">Orders / Month</th>
              <th className="p-4">First Month</th>
              <th className="p-4">First Order</th>
              <th className="p-4">Last Order</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((row) => (
              <tr key={row.customer_key} className="border-t border-slate-100">
                <td className="p-4 font-black">{row.customer_key}</td>
                <td className="p-4 font-bold text-blue-700">
                  {row.journey_stage}
                </td>
                <td className="p-4">{row.journey_health}</td>
                <td className="p-4">{row.blocker}</td>
                <td className="p-4 font-semibold">{row.next_goal}</td>
                <td className="p-4">{row.qualified_orders}</td>
                <td className="p-4 font-bold">
                  {money(Number(row.qualified_revenue || 0))}
                </td>
                <td className="p-4">{row.revenue_tier}</td>
                <td className="p-4">{row.customer_age_days}</td>
                <td className="p-4">{row.days_since_last_order}</td>
                <td className="p-4">
                  {Number(row.orders_per_month || 0).toFixed(2)}
                </td>
                <td className="p-4">{row.first_order_month}</td>
                <td className="p-4">{formatDate(row.first_order_date)}</td>
                <td className="p-4">{formatDate(row.last_order_date)}</td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td
                  className="p-8 text-center text-sm font-bold text-slate-500"
                  colSpan={14}
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