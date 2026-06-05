'use client';

import { useEffect, useMemo, useState } from 'react';

const money = (value: number) =>
  `INR ${Math.round(value || 0).toLocaleString('en-IN')}`;

export default function PatternDiscovery() {
  const [patterns, setPatterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [patternType, setPatternType] = useState('All');
  const [sortBy, setSortBy] = useState('Avg LTV');

  useEffect(() => {
    async function loadPatterns() {
      setLoading(true);

      try {
        const res = await fetch('/api/retention-os/patterns', {
          cache: 'no-store',
        });

        const json = await res.json();

        setPatterns(Array.isArray(json) ? json : []);
      } catch (error) {
        console.error('Pattern fetch error', error);
        setPatterns([]);
      } finally {
        setLoading(false);
      }
    }

    loadPatterns();
  }, []);

  const rows = useMemo(() => {
    const transformed = patterns.map((row) => ({
      patternType: row.pattern_type || '',
      sku: row.sku || '',
      productTitle: row.product_title || '',
      routine: row.routine || 'Unmapped',
      role: row.role || 'Unmapped',
      customers: Number(row.customers || 0),
      avgOrders: Number(row.avg_orders || 0),
      avgLtv: Number(row.avg_ltv || 0),
      successCustomers: Number(row.success_customers || 0),
      successRate: Number(row.success_rate || 0),
      detectedDate:
        typeof row.detected_date === 'object'
          ? row.detected_date?.value || ''
          : row.detected_date || '',
    }));

    const filtered = transformed.filter((row) => {
      const matchesSearch = `${row.patternType} ${row.sku} ${row.productTitle} ${row.routine} ${row.role}`
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesType =
        patternType === 'All' || row.patternType === patternType;

      return matchesSearch && matchesType;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'Success Rate') return b.successRate - a.successRate;
      if (sortBy === 'Customers') return b.customers - a.customers;
      if (sortBy === 'Avg Orders') return b.avgOrders - a.avgOrders;
      return b.avgLtv - a.avgLtv;
    });
  }, [patterns, search, patternType, sortBy]);

  const avgLtv =
    rows.reduce((sum, row) => sum + row.avgLtv, 0) /
    Math.max(rows.length, 1);

  const bestSuccessRate = Math.max(
    ...rows.map((row) => row.successRate * 100),
    0
  );

  const uniqueProducts = new Set(rows.map((row) => row.sku)).size;

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">
        Pattern Discovery
      </p>

      <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
        What Customer Behavior Creates Retention?
      </h2>

      <p className="mt-2 text-sm text-slate-500">
        Live patterns from Shopify order history showing which products and
        purchase moments create higher LTV, repeat behavior and deeper customer value.
      </p>

      {loading && (
        <p className="mt-3 text-xs font-bold text-blue-600">
          Loading live retention patterns...
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Card label="Patterns" value={rows.length.toString()} />
        <Card label="Average LTV" value={money(avgLtv)} />
        <Card
          label="Best Success Rate"
          value={`${Math.round(bestSuccessRate)}%`}
        />
        <Card label="Products" value={uniqueProducts.toString()} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patterns..."
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />

        <select
          value={patternType}
          onChange={(e) => setPatternType(e.target.value)}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        >
          <option>All</option>
          <option>FIRST_PRODUCT_LTV</option>
          <option>SECOND_PRODUCT_LTV</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        >
          <option>Avg LTV</option>
          <option>Success Rate</option>
          <option>Customers</option>
          <option>Avg Orders</option>
        </select>
      </div>

      <div className="mt-5 overflow-x-auto rounded-3xl border border-slate-200">
        <table className="w-full min-w-[1400px] text-left">
          <thead className="bg-slate-100 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="p-4">Pattern Type</th>
              <th className="p-4">SKU</th>
              <th className="p-4">Product</th>
              <th className="p-4">Routine</th>
              <th className="p-4">Role</th>
              <th className="p-4">Customers</th>
              <th className="p-4">Avg Orders</th>
              <th className="p-4">Avg LTV</th>
              <th className="p-4">Success Customers</th>
              <th className="p-4">Success Rate</th>
              <th className="p-4">Detected</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.patternType}-${row.sku}-${row.productTitle}`}
                className="border-t border-slate-100"
              >
                <td className="p-4 font-black text-blue-700">
                  {row.patternType}
                </td>

                <td className="p-4 font-black text-slate-950">
                  {row.sku}
                </td>

                <td className="p-4 font-bold text-slate-800">
                  {row.productTitle}
                </td>

                <td className="p-4">
                  {row.routine}
                </td>

                <td className="p-4">
                  {row.role}
                </td>

                <td className="p-4">
                  {row.customers.toLocaleString('en-IN')}
                </td>

                <td className="p-4">
                  {row.avgOrders.toFixed(2)}
                </td>

                <td className="p-4 font-bold">
                  {money(row.avgLtv)}
                </td>

                <td className="p-4">
                  {row.successCustomers.toLocaleString('en-IN')}
                </td>

                <td className="p-4 font-bold">
                  {(row.successRate * 100).toFixed(1)}%
                </td>

                <td className="p-4">
                  {row.detectedDate}
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="p-8 text-center text-sm font-bold text-slate-500"
                >
                  No patterns found. Map products and complete order backfill to activate pattern discovery.
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