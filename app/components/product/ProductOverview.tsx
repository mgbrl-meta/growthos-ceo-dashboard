'use client';

import { useEffect, useState } from 'react';

type Props = {
  startDate: string;
  endDate: string;
  compareStartDate?: string;
  compareEndDate?: string;
};

export default function ProductOverview({
  startDate,
  endDate,
  compareStartDate,
  compareEndDate,
}: Props) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const url = `/api/product-os/overview?start=${startDate}&end=${endDate}&compareStart=${
      compareStartDate || startDate
    }&compareEnd=${compareEndDate || endDate}`;

    fetch(url)
      .then((res) => res.json())
      .then((res) => setData(res));
  }, [startDate, endDate, compareStartDate, compareEndDate]);

  if (!data) return <div className="p-4">Loading Overview...</div>;

  return (
    <div className="space-y-3">
      {/* 1. TOP METRICS */}
      <div className="grid grid-cols-4 gap-2.5">
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-[10px] text-gray-500">Total Revenue</p>
          <h2 className="text-[15px] font-semibold">
            ₹{Math.round(data.total_revenue || 0).toLocaleString()}
          </h2>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <p className="text-[10px] text-gray-500">Total Units</p>
          <h2 className="text-[15px] font-semibold">
            {Math.round(data.total_units || 0).toLocaleString()}
          </h2>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <p className="text-[10px] text-gray-500">Active SKUs</p>
          <h2 className="text-[15px] font-semibold">
            {data.active_skus || 0}
          </h2>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <p className="text-[10px] text-gray-500">Avg Revenue / SKU</p>
          <h2 className="text-[15px] font-semibold">
            ₹{Math.round(data.avg_revenue_per_sku || 0).toLocaleString()}
          </h2>
        </div>
      </div>

      {/* 2. CONCENTRATION */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-[10px] text-gray-500">Top 3 SKU Share</p>
          <h2 className="text-[15px] font-semibold">
            {((data.top_3_share || 0) * 100).toFixed(1)}%
          </h2>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <p className="text-[10px] text-gray-500">Top 5 SKU Share</p>
          <h2 className="text-[15px] font-semibold">
            {((data.top_5_share || 0) * 100).toFixed(1)}%
          </h2>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <p className="text-[10px] text-gray-500">Concentration Risk</p>
          <h2 className="text-[15px] font-semibold">
            {data.concentration_risk}
          </h2>
        </div>
      </div>

      {/* 3. STATUS MIX */}
      <div className="grid grid-cols-4 gap-2.5">
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-[10px] text-gray-500">Winners</p>
          <h2 className="text-[15px] font-semibold">{data.winners}</h2>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <p className="text-[10px] text-gray-500">Stable</p>
          <h2 className="text-[15px] font-semibold">{data.stable}</h2>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <p className="text-[10px] text-gray-500">Declining</p>
          <h2 className="text-[15px] font-semibold">{data.declining}</h2>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <p className="text-[10px] text-gray-500">Dead</p>
          <h2 className="text-[15px] font-semibold">{data.dead}</h2>
        </div>
      </div>

      {/* 4. GROWTH SNAPSHOT */}
      <div className="grid grid-cols-4 gap-2.5">
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-[10px] text-gray-500">Revenue Growth</p>
          <h2 className="text-[15px] font-semibold">
            {((data.revenue_growth_pct || 0) * 100).toFixed(1)}%
          </h2>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <p className="text-[10px] text-gray-500">Units Growth</p>
          <h2 className="text-[15px] font-semibold">
            {((data.units_growth_pct || 0) * 100).toFixed(1)}%
          </h2>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <p className="text-[10px] text-gray-500">Growing SKUs</p>
          <h2 className="text-[15px] font-semibold">{data.growing_skus}</h2>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <p className="text-[10px] text-gray-500">Declining SKUs</p>
          <h2 className="text-[15px] font-semibold">{data.declining_skus}</h2>
        </div>
      </div>

      {/* 5. TOP SKUS */}
      <div className="bg-white p-4 rounded-lg border">
        <h2 className="text-[14px] font-semibold mb-2.5">Top SKUs</h2>

        <div className="space-y-3">
          {(data.top_skus || []).map((sku: any, i: number) => (
            <div
              key={sku.sku}
              className="flex justify-between border rounded p-3"
            >
              <div>
                <p className="text-[10px] text-gray-400">#{i + 1}</p>
                <p className="font-semibold">{sku.sku}</p>
                <p className="text-[11px] text-gray-600">{sku.product_title}</p>
              </div>

              <div className="text-right">
                <p className="font-semibold">
                  ₹{Math.round(sku.revenue || 0).toLocaleString()}
                </p>
                <p className="text-[11px]">
                  {Math.round(sku.units || 0)} units
                </p>
                <p className="text-[10px] text-gray-500">
                  {((sku.share_pct || 0) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. ALERTS */}
      <div className="bg-white p-4 rounded-lg border">
        <h2 className="text-[14px] font-semibold mb-2.5">Product Alerts</h2>

        <div className="space-y-3">
          {(data.product_alerts || []).map((alert: any, i: number) => (
            <div key={i} className="border rounded p-3">
              <p className="text-[10px] text-gray-400">{alert.alert_type}</p>
              <p className="font-semibold">{alert.sku}</p>
              <p className="text-[11px] text-gray-600">
                ₹{Math.round(alert.revenue || 0).toLocaleString()} |{' '}
                {((alert.revenue_growth_pct || 0) * 100).toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
