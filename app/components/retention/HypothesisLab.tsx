'use client';

import { useEffect, useMemo, useState } from 'react';

import type {
  PatternWorkflowAction,
  PatternWorkflowApiResponse,
} from './types';

const money = (value: number) =>
  `INR ${Math.round(value || 0).toLocaleString('en-IN')}`;

export default function HypothesisLab() {
  const [rows, setRows] = useState<any[]>([]);
  const [patternTests, setPatternTests] =
    useState<PatternWorkflowAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState('All');

  useEffect(() => {
    async function loadHypotheses() {
      setLoading(true);

      try {
        const [hypothesisResponse, patternResponse] = await Promise.all([
          fetch('/api/retention-os/hypotheses', {
            cache: 'no-store',
          }),
          fetch('/api/retention-os/pattern-actions?workflowType=TEST', {
            cache: 'no-store',
          }),
        ]);

        const hypothesisJson = await hypothesisResponse.json();
        const patternJson =
          (await patternResponse.json()) as PatternWorkflowApiResponse;

        setRows(Array.isArray(hypothesisJson) ? hypothesisJson : []);
        setPatternTests(
          patternJson.ok && Array.isArray(patternJson.data)
            ? patternJson.data
            : []
        );
      } catch (error) {
        console.error('Hypothesis fetch error', error);
        setRows([]);
        setPatternTests([]);
      } finally {
        setLoading(false);
      }
    }

    loadHypotheses();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch = `${row.hypothesis || ''} ${
        row.product_title || ''
      } ${row.routine || ''} ${row.action_type || ''}`
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
    <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-600">
        Hypothesis Lab
      </p>

      <h2 className="mt-2 text-[15px] font-semibold tracking-[-0.04em] text-slate-950">
        What Should We Test?
      </h2>

      <p className="mt-2 text-[11px] text-slate-500">
        Generated hypotheses plus operator-selected controlled tests from Pattern
        Discovery.
      </p>

      {loading && (
        <p className="mt-3 text-[10px] font-bold text-blue-600">
          Loading hypotheses...
        </p>
      )}

      <div className="mt-3 grid gap-2.5 md:grid-cols-5">
        <Card label="Generated Hypotheses" value={filtered.length.toString()} />
        <Card label="Pattern Test Briefs" value={patternTests.length.toString()} />
        <Card label="Expected Profit" value={money(totalExpectedProfit)} />
        <Card
          label="Avg Confidence"
          value={`${Math.round(
            filtered.reduce(
              (sum, row) => sum + Number(row.confidence || 0),
              0
            ) / Math.max(filtered.length, 1)
          )}%`}
        />
        <Card
          label="Products"
          value={new Set(filtered.map((row) => row.sku)).size.toString()}
        />
      </div>

      {patternTests.length > 0 && (
        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700">
            Operator-created test briefs
          </p>

          <p className="mt-1 text-[11px] text-slate-600">
            Tests selected from validated Pattern Discovery evidence.
          </p>

          <div className="mt-2.5 overflow-x-auto rounded-lg border border-blue-100 bg-white">
            <table className="w-full min-w-[1250px] text-left">
              <thead className="bg-blue-50 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Test Brief</th>
                  <th className="p-3">Source → Target</th>
                  <th className="p-3">Evidence</th>
                  <th className="p-3">Expected Impact</th>
                  <th className="p-3">Window</th>
                  <th className="p-3">Holdout</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>

              <tbody>
                {patternTests.map((test) => (
                  <tr
                    key={test.action_id}
                    className="border-t border-blue-100 align-top"
                  >
                    <td className="p-3 font-semibold">
                      {test.priority_band || '—'}
                    </td>

                    <td className="p-3">
                      <p className="max-w-[330px] font-semibold text-slate-950">
                        {test.action_title}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {test.pattern_family}
                      </p>
                    </td>

                    <td className="p-3 text-[11px]">
                      <p className="font-bold">{test.source_sku || '—'}</p>
                      {test.target_sku && (
                        <p className="mt-1 text-blue-700">→ {test.target_sku}</p>
                      )}
                    </td>

                    <td className="p-3 text-[11px]">
                      <p className="font-semibold">
                        {Number(test.evidence_support || 0).toLocaleString(
                          'en-IN'
                        )}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {Math.round(Number(test.confidence_score || 0) * 100)}%
                        confidence
                      </p>
                    </td>

                    <td className="p-3 text-[11px]">
                      <p>
                        Primary:{' '}
                        {test.expected_primary_lift === null
                          ? '—'
                          : `${(test.expected_primary_lift * 100).toFixed(
                              2
                            )} pp`}
                      </p>
                      <p className="mt-1">
                        Revenue/customer:{' '}
                        {test.expected_revenue_lift_per_customer === null
                          ? '—'
                          : money(test.expected_revenue_lift_per_customer)}
                      </p>
                    </td>

                    <td className="p-3 text-[11px] font-bold">
                      {test.recommended_window_start_day !== null &&
                      test.recommended_window_end_day !== null
                        ? `Day ${test.recommended_window_start_day}–${test.recommended_window_end_day}`
                        : '—'}
                    </td>

                    <td className="p-3 text-[11px]">
                      {test.requires_holdout
                        ? test.recommended_test_split || 'Required'
                        : 'Not required'}
                    </td>

                    <td className="p-3 text-[11px] font-semibold">{test.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search hypotheses..."
          className="rounded-lg border border-slate-200 px-3 py-2 text-[11px]"
        />

        <select
          value={actionType}
          onChange={(event) => setActionType(event.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-[11px]"
        >
          <option>All</option>
          <option>Acquisition Mix</option>
          <option>Second Purchase</option>
          <option>Retention Test</option>
        </select>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[1500px] text-left">
          <thead className="bg-slate-100 text-[10px] uppercase tracking-widest text-slate-500">
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
                <td className="p-4 font-semibold text-slate-950">
                  {row.hypothesis}
                </td>
                <td className="p-4 font-bold text-blue-700">
                  {row.pattern_type}
                </td>
                <td className="p-4 font-bold">{row.product_title}</td>
                <td className="p-4">{row.routine || 'Unmapped'}</td>
                <td className="p-4">{row.role || 'Unmapped'}</td>
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
                <td className="p-4">{Number(row.confidence || 0)}%</td>
                <td className="p-4">{row.action_type}</td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  className="p-4 text-center text-[11px] font-bold text-slate-500"
                >
                  No hypotheses found. Pattern data or mapped product data may
                  still be incomplete.
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
