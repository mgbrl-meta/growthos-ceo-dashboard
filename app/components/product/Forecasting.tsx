'use client';

import { useEffect, useState } from 'react';

type Props = {
  startDate: string;
  endDate: string;
};

type Row = {
  sku: string;
  item_name: string;
  last_calendar_month: number;
  last_calendar_month_revenue: number;
  growth_rate: number;
  seasonality_index: number;
  months_history: number;
};

const money = (v: number) => `₹${Math.round(v || 0).toLocaleString()}`;
const pct = (v: number) => `${((v || 0) * 100).toFixed(1)}%`;

const clampSeasonality = (v: number) => {
  if (!v || isNaN(v)) return 1;
  return Math.min(1.2, Math.max(0.8, v));
};

export default function Forecasting({ endDate }: Props) {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    fetch(`/api/product-os/forecasting?end=${endDate}`)
      .then((res) => res.json())
      .then((res) => setData(res.rows || []))
      .finally(() => setLoading(false));
  }, [endDate]);

  if (loading) return <div className="p-4">Loading Forecast...</div>;

  return (
    <div className="bg-white p-4 rounded-lg border">
      <h2 className="text-[14px] font-semibold mb-1">SKU Forecast</h2>
      <p className="text-[10px] text-gray-500 mb-2.5">
        Forecast based on last calendar month, growth rate, and capped seasonality index.
      </p>

      <div className="overflow-x-auto max-h-[650px]">
        <table className="min-w-full text-[11px]">
          <thead className="sticky top-0 bg-white border-b">
            <tr>
              <th className="p-2 text-left">SKU</th>
              <th className="p-2 text-left">Item Name</th>
              <th className="p-2 text-right">Last Month</th>
              <th className="p-2 text-right">Growth Rate</th>
              <th className="p-2 text-right">Seasonality</th>
              <th className="p-2 text-right">M1 Units</th>
              <th className="p-2 text-right">M2 Units</th>
              <th className="p-2 text-right">M3 Units</th>
              <th className="p-2 text-right">M1 Revenue</th>
              <th className="p-2 text-right">M2 Revenue</th>
              <th className="p-2 text-right">M3 Revenue</th>
              <th className="p-2 text-right">History</th>
            </tr>
          </thead>

          <tbody>
            {data.map((row) => {
              const base = row.last_calendar_month || 0;
              const growth = row.growth_rate || 0;
              const seasonality = clampSeasonality(row.seasonality_index);
              const asp =
                base > 0 ? (row.last_calendar_month_revenue || 0) / base : 0;

              const m1Units = base * (1 + growth) * seasonality;
              const m2Units = m1Units * (1 + growth) * seasonality;
              const m3Units = m2Units * (1 + growth) * seasonality;

              return (
                <tr key={row.sku} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-mono">{row.sku}</td>
                  <td className="p-2 min-w-[260px]">{row.item_name}</td>
                  <td className="p-2 text-right">
                    {Math.round(base).toLocaleString()}
                  </td>
                  <td className="p-2 text-right">{pct(growth)}</td>
                  <td className="p-2 text-right">{seasonality.toFixed(2)}</td>
                  <td className="p-2 text-right">
                    {Math.round(m1Units).toLocaleString()}
                  </td>
                  <td className="p-2 text-right">
                    {Math.round(m2Units).toLocaleString()}
                  </td>
                  <td className="p-2 text-right">
                    {Math.round(m3Units).toLocaleString()}
                  </td>
                  <td className="p-2 text-right">{money(m1Units * asp)}</td>
                  <td className="p-2 text-right">{money(m2Units * asp)}</td>
                  <td className="p-2 text-right">{money(m3Units * asp)}</td>
                  <td className="p-2 text-right">{row.months_history} mo</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
