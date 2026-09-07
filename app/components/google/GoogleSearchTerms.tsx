'use client';

import { useEffect, useState } from 'react';

type Props = {
  startDate?: string;
  endDate?: string;
  settings: any;
};

const money = (v: number) => `₹${Math.round(v || 0).toLocaleString()}`;

export default function GoogleSearchTerms({ startDate, endDate, settings }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [campaign, setCampaign] = useState('');
  const [adGroup, setAdGroup] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const [selected, setSelected] = useState<any>({});

  useEffect(() => {
    if (!startDate || !endDate) return;

    const fetchData = async () => {
      setLoading(true);

      const params = new URLSearchParams({
        start: startDate || '',
        end: endDate || '',
        campaign,
        adGroup,
        targetRoas: String(settings.targetRoas),
        minSpend: String(settings.minSpend),
        minClicks: String(settings.minClicks),
        negativeSpend: String(settings.negativeKeywordSpend),
        negativeClicks: String(settings.negativeKeywordClicks),
        positiveConversions: String(settings.positiveKeywordConversions),
      });

      const res = await fetch(`/api/google-os/search-terms?${params.toString()}`);
      const json = await res.json();

      console.log('Search Terms API:', json);

      setData(json);
      setLoading(false);
    };

    fetchData();
  }, [startDate, endDate, campaign, adGroup, settings]);

  const rows = data?.rows || [];

  const filteredRows = actionFilter
    ? rows.filter((r: any) => r.suggested_action === actionFilter)
    : rows;

  const toggle = (key: string) => {
    setSelected((prev: any) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const selectedRows = filteredRows.filter((r: any) =>
    selected[`${r.search_term}-${r.campaign_name}`]
  );

  return (
    <div className="space-y-3">

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
        <Card title="Total Spend" value={money(data?.summary?.spend)} />
        <Card title="Wasted Spend" value={money(data?.summary?.wasted_spend)} />
        <Card title="Negatives" value={data?.summary?.negative_candidates} />
        <Card title="Positives" value={data?.summary?.positive_candidates} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Campaign"
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
          className="border px-3 py-2 rounded"
        />
        <input
          placeholder="Ad Group"
          value={adGroup}
          onChange={(e) => setAdGroup(e.target.value)}
          className="border px-3 py-2 rounded"
        />

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="border px-3 py-2 rounded"
        >
          <option value="">All Actions</option>
          <option value="ADD_NEGATIVE">Negative</option>
          <option value="SCALE_EXACT">Scale</option>
          <option value="FIX_FUNNEL">Fix Funnel</option>
          <option value="TEST_MORE">Test</option>
          <option value="MONITOR">Monitor</option>
        </select>
      </div>

      {/* Bulk Bar */}
      {selectedRows.length > 0 && (
        <div className="rounded-lg bg-black text-white p-3 flex justify-between">
          <span>
            {selectedRows.length} selected · Spend {money(
              selectedRows.reduce((s: number, r: any) => s + r.spend, 0)
            )}
          </span>

          <div className="flex gap-2">
            <button className="bg-red-500 px-3 py-1 rounded">Mark Negative</button>
            <button className="bg-emerald-500 px-3 py-1 rounded">Mark Exact</button>
            <button className="bg-blue-500 px-3 py-1 rounded">Mark Reviewed</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-white p-4 overflow-auto">
        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="w-full text-[11px] min-w-[1200px]">
            <thead>
              <tr className="border-b text-[10px] uppercase text-slate-500">
                <th></th>
                <th>Search Term</th>
                <th>Campaign</th>
                <th>Spend</th>
                <th>Conv</th>
                <th>Revenue</th>
                <th>ROAS</th>
                <th>Action</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((r: any) => {
                const key = `${r.search_term}-${r.campaign_name}`;

                return (
                  <tr key={key} className="border-b">
                    <td>
                      <input
                        type="checkbox"
                        checked={!!selected[key]}
                        onChange={() => toggle(key)}
                      />
                    </td>

                    <td className="font-bold">{r.search_term}</td>
                    <td>{r.campaign_name}</td>
                    <td>{money(r.spend)}</td>
                    <td>{r.conversions?.toFixed(1)}</td>
                    <td>{money(r.revenue)}</td>
                    <td>{r.roas?.toFixed(2)}</td>

                    <td className={color(r.suggested_action)}>
                      {r.suggested_action}
                    </td>

                    <td>{r.review_bucket}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Card({ title, value }: any) {
  return (
    <div className="border rounded-lg p-4 bg-white">
      <p className="text-[10px] text-slate-500">{title}</p>
      <p className="text-[15px] font-bold">{value}</p>
    </div>
  );
}

function color(action: string) {
  if (action === 'ADD_NEGATIVE') return 'text-red-600 font-bold';
  if (action === 'SCALE_EXACT') return 'text-emerald-600 font-bold';
  if (action === 'FIX_FUNNEL') return 'text-amber-600 font-bold';
  return 'text-slate-500';
}
