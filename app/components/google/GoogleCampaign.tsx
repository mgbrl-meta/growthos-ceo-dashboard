'use client';

import { useEffect, useState } from 'react';

type Props = {
  startDate?: string;
  endDate?: string;
};

const money = (v: number) => `₹${Math.round(v || 0).toLocaleString()}`;
const pct = (v: number) => `${((v || 0) * 100).toFixed(1)}%`;

export default function GoogleCampaign({ startDate, endDate }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!startDate || !endDate) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/google-os/campaign?start=${startDate}&end=${endDate}`
        );
        const json = await res.json();
        setData(json);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-white/90 p-3 text-center">
        Loading Campaign Data...
      </div>
    );
  }

  const campaigns = data?.campaigns || [];

  const scale = campaigns.filter((c: any) => c.action === 'SCALE');
  const reduce = campaigns.filter((c: any) => c.action === 'REDUCE');
  const hold = campaigns.filter((c: any) => c.action === 'HOLD');
  const watch = campaigns.filter((c: any) => c.action === 'WATCH');

  return (
    <div className="space-y-3">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-4">
        <Card title="Total Spend" value={money(data?.totals?.spend)} />
        <Card title="Revenue" value={money(data?.totals?.revenue)} />
        <Card
          title="ROAS"
          value={(data?.totals?.account_roas || 0).toFixed(2)}
        />
        <Card
          title="CPA"
          value={money(data?.totals?.account_cpa)}
        />
      </div>

      {/* Decision Buckets */}
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-4">
        <Bucket title="Scale" data={scale} color="emerald" />
        <Bucket title="Reduce" data={reduce} color="red" />
        <Bucket title="Hold" data={hold} color="blue" />
        <Bucket title="Watch" data={watch} color="amber" />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white/90 p-3.5 shadow-sm">
        <h3 className="mb-2.5 text-[15px] font-semibold">Campaign Decision Table</h3>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-[11px]">
            <thead>
              <tr className="border-b text-[10px] uppercase text-slate-500">
                <th className="py-2 text-left">Campaign</th>
                <th className="text-right">Spend</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">ROAS</th>
                <th className="text-right">CPA</th>
                <th className="text-right">Conv</th>
                <th className="text-right">ROAS vs Acc</th>
                <th className="text-right">ROAS vs Channel</th>
                <th className="text-right">Gap</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {campaigns.map((c: any) => (
                <tr key={c.campaign_name} className="border-b">
                  <td className="py-2 font-bold">{c.campaign_name}</td>
                  <td className="text-right">{money(c.spend)}</td>
                  <td className="text-right">{money(c.revenue)}</td>
                  <td className="text-right font-bold">
                    {c.roas?.toFixed(2)}
                  </td>
                  <td className="text-right">{money(c.cpa)}</td>
                  <td className="text-right">
                    {c.conversions?.toFixed(1)}
                  </td>
                  <td className="text-right">
                    {c.roas_index_account?.toFixed(2)}
                  </td>
                  <td className="text-right">
                    {c.roas_index_channel?.toFixed(2)}
                  </td>
                  <td
                    className={`text-right font-bold ${
                      c.efficiency_gap >= 0
                        ? 'text-emerald-700'
                        : 'text-red-700'
                    }`}
                  >
                    {pct(c.efficiency_gap)}
                  </td>
                  <td className={`text-right font-semibold ${color(c.action)}`}>
                    {c.action}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }: any) {
  return (
    <div className="rounded-xl border bg-white/90 p-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase text-slate-500">{title}</p>
      <p className="mt-1 text-[14px] font-semibold">{value}</p>
    </div>
  );
}

function Bucket({ title, data, color }: any) {
  const styles: any = {
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
  };

  return (
    <div className={`rounded-xl border p-4 ${styles[color]}`}>
      <p className="text-[10px] font-semibold uppercase">{title}</p>
      <div className="mt-2 space-y-1">
        {data.slice(0, 5).map((c: any) => (
          <p key={c.campaign_name} className="text-[11px] font-bold truncate">
            {c.campaign_name}
          </p>
        ))}
      </div>
    </div>
  );
}

function color(action: string) {
  if (action === 'SCALE') return 'text-emerald-700';
  if (action === 'REDUCE') return 'text-red-700';
  if (action === 'HOLD') return 'text-blue-700';
  return 'text-amber-700';
}
