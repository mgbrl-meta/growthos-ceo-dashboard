'use client';

import { useEffect, useMemo, useState } from 'react';

const money = (value: number) =>
  `INR ${Math.round(value || 0).toLocaleString('en-IN')}`;

export default function LearningLoop() {
  const [rows, setRows] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [summaryRows, setSummaryRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadLearningData() {
      setLoading(true);

      try {
        const learningRes = await fetch('/api/retention-os/learning-log', {
          cache: 'no-store',
        });
        const learningJson = await learningRes.json();
        setRows(Array.isArray(learningJson) ? learningJson : []);

        const candidateRes = await fetch(
          '/api/retention-os/learning-candidates',
          { cache: 'no-store' }
        );
        const candidateJson = await candidateRes.json();
        setCandidates(Array.isArray(candidateJson) ? candidateJson : []);

        const summaryRes = await fetch('/api/retention-os/learning-summary', {
          cache: 'no-store',
        });
        const summaryJson = await summaryRes.json();
        setSummaryRows(Array.isArray(summaryJson) ? summaryJson : []);
      } catch (error) {
        console.error('Learning loop fetch error', error);
        setRows([]);
        setCandidates([]);
        setSummaryRows([]);
      } finally {
        setLoading(false);
      }
    }

    loadLearningData();
  }, []);

  const summary = useMemo(() => {
    const expectedProfit = rows.reduce(
      (sum, row) => sum + Number(row.expected_profit || 0),
      0
    );

    const actualProfit = rows.reduce(
      (sum, row) => sum + Number(row.actual_profit || 0),
      0
    );

    const avgAccuracy =
      rows.reduce((sum, row) => sum + Number(row.profit_accuracy || 0), 0) /
      Math.max(rows.length, 1);

    return {
      expectedProfit,
      actualProfit,
      avgAccuracy,
    };
  }, [rows]);

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">
        Learning Loop
      </p>

      <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
        Expected vs Actual Memory
      </h2>

      <p className="mt-2 text-sm text-slate-500">
        Stores what worked, what failed, how accurate the engine was, and what
        should change next.
      </p>

      {loading && (
        <p className="mt-3 text-xs font-bold text-blue-600">
          Loading learning data...
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Card label="Learnings" value={rows.length.toString()} />
        <Card label="Awaiting Review" value={candidates.length.toString()} />
        <Card label="Expected Profit" value={money(summary.expectedProfit)} />
        <Card
          label="Avg Accuracy"
          value={`${Math.round(summary.avgAccuracy * 100)}%`}
        />
      </div>

      <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">
          Actions Awaiting Learning
        </p>

        <h3 className="mt-2 text-xl font-black text-slate-950">
          {candidates.length} Completed Actions Need Review
        </h3>

        <p className="mt-2 text-sm text-slate-600">
          These actions are completed but do not have a learning recorded yet.
        </p>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-amber-200 bg-white">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="bg-amber-100 text-xs uppercase tracking-widest text-amber-800">
              <tr>
                <th className="p-4">Action</th>
                <th className="p-4">Opportunity</th>
                <th className="p-4">Expected Revenue</th>
                <th className="p-4">Expected Profit</th>
                <th className="p-4">Completed</th>
              </tr>
            </thead>

            <tbody>
              {candidates.map((row) => (
                <tr key={row.action_id} className="border-t border-amber-100">
                  <td className="p-4 font-black">{row.action_title}</td>

                  <td className="p-4">
                    {row.opportunity_type} - {row.opportunity_group}
                  </td>

                  <td className="p-4 font-bold">
                    {money(row.expected_revenue)}
                  </td>

                  <td className="p-4 font-bold">
                    {money(row.expected_profit)}
                  </td>

                  <td className="p-4">
                    {formatDate(row.completed_date)}
                  </td>
                </tr>
              ))}

              {candidates.length === 0 && (
                <tr>
                  <td
                    className="p-6 text-sm font-bold text-slate-500"
                    colSpan={5}
                  >
                    No completed actions waiting for learning.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
          Engine Learning Summary
        </p>

        <h3 className="mt-2 text-xl font-black text-slate-950">
          Opportunity Type Performance
        </h3>

        <p className="mt-2 text-sm text-slate-500">
          Shows whether each opportunity type is over-performing or
          under-performing against expected profit.
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3">Opportunity Type</th>
                <th className="p-3">Learnings</th>
                <th className="p-3">Expected Profit</th>
                <th className="p-3">Actual Profit</th>
                <th className="p-3">Accuracy</th>
                <th className="p-3">Recommendation</th>
              </tr>
            </thead>

            <tbody>
              {summaryRows.map((row) => (
                <tr key={row.opportunity_type} className="border-b">
                  <td className="p-3 font-black">{row.opportunity_type}</td>
                  <td className="p-3">{row.learnings}</td>
                  <td className="p-3 font-bold">
                    {money(row.total_expected_profit)}
                  </td>
                  <td className="p-3 font-bold">
                    {money(row.total_actual_profit)}
                  </td>
                  <td className="p-3">
                    {Math.round(Number(row.avg_profit_accuracy || 0) * 100)}%
                  </td>
                  <td className="p-3 font-semibold text-blue-700">
                    {row.recommended_confidence_action}
                  </td>
                </tr>
              ))}

              {summaryRows.length === 0 && (
                <tr>
                  <td
                    className="p-6 text-sm font-bold text-slate-500"
                    colSpan={6}
                  >
                    No learning summary yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-200">
        <table className="w-full min-w-[1500px] text-left">
          <thead className="bg-slate-100 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="p-4">Opportunity</th>
              <th className="p-4">Expected Revenue</th>
              <th className="p-4">Actual Revenue</th>
              <th className="p-4">Expected Profit</th>
              <th className="p-4">Actual Profit</th>
              <th className="p-4">Profit Accuracy</th>
              <th className="p-4">Result</th>
              <th className="p-4">Learning</th>
              <th className="p-4">Next Recommendation</th>
              <th className="p-4">Created</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.learning_id} className="border-t border-slate-100">
                <td className="p-4 font-black text-slate-950">
                  {row.opportunity_type} - {row.opportunity_group}
                </td>

                <td className="p-4">{money(row.expected_revenue)}</td>
                <td className="p-4">{money(row.actual_revenue)}</td>
                <td className="p-4 font-bold">
                  {money(row.expected_profit)}
                </td>
                <td className="p-4 font-bold">{money(row.actual_profit)}</td>

                <td className="p-4">
                  {Math.round(Number(row.profit_accuracy || 0) * 100)}%
                </td>

                <td className="p-4">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                    {row.result}
                  </span>
                </td>

                <td className="p-4 text-slate-600">{row.learning_note}</td>

                <td className="p-4 font-semibold text-blue-700">
                  {row.next_recommendation}
                </td>

                <td className="p-4">{formatDate(row.created_at)}</td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="p-8 text-center text-sm font-bold text-slate-500"
                >
                  No learnings recorded yet. Complete an action and record
                  actual results to activate the learning loop.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatDate(value: any) {
  if (!value) return '';

  if (typeof value === 'object') {
    return value.value || '';
  }

  return value;
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