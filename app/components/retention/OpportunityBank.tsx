'use client';

import { useEffect, useMemo, useState } from 'react';

type OpportunityRow = {
  opportunity_type: string;
  best_action: string;
  message_theme: string;
  recommended_product: string | null;
  recommended_sku: string | null;
  routine: string | null;
  journey_stage: string | null;
  journey_state: string | null;
  strategic_segment: string | null;
  estimated_revenue: number;
  estimated_profit: number;
  success_probability: number;
  expected_business_value: number;
  confidence: number;
  reason: string;
};

const money = (value: number) =>
  `INR ${Math.round(value || 0).toLocaleString('en-IN')}`;

export default function OpportunityBank() {
  const [rows, setRows] = useState<OpportunityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    async function loadOpportunities() {
      setLoading(true);

      try {
        const res = await fetch('/api/retention-os/opportunities', {
          cache: 'no-store',
        });

        const json = await res.json();
        setRows(Array.isArray(json) ? json : []);
      } catch (error) {
        console.error('Opportunity bank fetch error', error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    loadOpportunities();
  }, []);

  const opportunityTypes = useMemo(() => {
    return ['All', ...Array.from(new Set(rows.map((row) => row.opportunity_type)))];
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (filter === 'All') return rows;
    return rows.filter((row) => row.opportunity_type === filter);
  }, [rows, filter]);

  const summary = useMemo(() => {
    return {
      opportunities: filteredRows.length,
      revenue: filteredRows.reduce(
        (sum, row) => sum + Number(row.estimated_revenue || 0),
        0
      ),
      profit: filteredRows.reduce(
        (sum, row) => sum + Number(row.estimated_profit || 0),
        0
      ),
      ebv: filteredRows.reduce(
        (sum, row) => sum + Number(row.expected_business_value || 0),
        0
      ),
    };
  }, [filteredRows]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-600">
            Opportunity Bank
          </p>

          <h2 className="mt-2 text-[15px] font-semibold tracking-[-0.04em] text-slate-950">
            Ranked Retention Opportunities
          </h2>

          <p className="mt-2 max-w-3xl text-[11px] text-slate-500">
            Powered by opportunity scoring v5: expected profit × journey-state
            probability × pattern probability × strategic importance.
          </p>
        </div>

        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700"
        >
          {opportunityTypes.map((type) => (
            <option key={type} value={type}>
              {type.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <p className="mt-3 text-[10px] font-bold text-blue-600">
          Loading opportunity bank...
        </p>
      )}

      <div className="mt-3 grid gap-2.5 md:grid-cols-4">
        <Card label="Opportunities" value={summary.opportunities.toString()} />
        <Card label="Revenue" value={money(summary.revenue)} />
        <Card label="Profit" value={money(summary.profit)} />
        <Card label="EBV" value={money(summary.ebv)} />
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[1500px] text-left">
          <thead className="bg-slate-100 text-[10px] uppercase tracking-widest text-slate-500">
            <tr>
              <th className="p-4">Opportunity</th>
              <th className="p-4">Action</th>
              <th className="p-4">Product / Segment</th>
              <th className="p-4">Journey State</th>
              <th className="p-4">Theme</th>
              <th className="p-4">Revenue</th>
              <th className="p-4">Profit</th>
              <th className="p-4">Success</th>
              <th className="p-4">EBV</th>
              <th className="p-4">Confidence</th>
              <th className="p-4">Reason</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((row, index) => {
              const productOrSegment =
                row.recommended_product ||
                row.routine ||
                row.strategic_segment ||
                '-';

              return (
                <tr
                  key={`${row.opportunity_type}-${row.best_action}-${index}`}
                  className="border-t border-slate-100 align-top"
                >
                  <td className="p-4 font-semibold text-slate-950">
                    {row.opportunity_type?.replaceAll('_', ' ')}
                  </td>

                  <td className="p-4 font-bold text-slate-800">
                    {row.best_action}
                  </td>

                  <td className="p-4">
                    <div className="font-bold text-slate-900">
                      {productOrSegment}
                    </div>

                    {row.recommended_sku && (
                      <div className="mt-1 text-[10px] font-bold text-slate-400">
                        SKU: {row.recommended_sku}
                      </div>
                    )}
                  </td>

                  <td className="p-4">
                    <div className="font-bold">{row.journey_state || '-'}</div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {row.journey_stage || '-'}
                    </div>
                  </td>

                  <td className="p-4">{row.message_theme || '-'}</td>

                  <td className="p-4 font-bold">
                    {money(Number(row.estimated_revenue || 0))}
                  </td>

                  <td className="p-4 font-bold">
                    {money(Number(row.estimated_profit || 0))}
                  </td>

                  <td className="p-4">
                    {Math.round(Number(row.success_probability || 0) * 100)}%
                  </td>

                  <td className="p-4 font-semibold text-blue-700">
                    {money(Number(row.expected_business_value || 0))}
                  </td>

                  <td className="p-4">
                    {Math.round(Number(row.confidence || 0))}%
                  </td>

                  <td className="p-4 text-[11px] leading-6 text-slate-600">
                    {row.reason || '-'}
                  </td>
                </tr>
              );
            })}

            {filteredRows.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="p-4 text-center text-[11px] font-bold text-slate-500"
                >
                  No opportunities found.
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
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-[14px] font-semibold text-slate-950">{value}</p>
    </div>
  );
}
