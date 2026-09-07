'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';

type Props = {
  startDate: string;
  endDate: string;
  compareStartDate?: string;
  compareEndDate?: string;
};

const formatDate = (d: any) => d?.value || d;
const money = (v: number) => `₹${Math.round(v || 0).toLocaleString()}`;
const pct = (v: number) => `${((v || 0) * 100).toFixed(1)}%`;

export default function DemandTrends({
  startDate,
  endDate,
  compareStartDate,
  compareEndDate,
}: Props) {
  const [trendRows, setTrendRows] = useState<any[]>([]);
  const [topSkuRows, setTopSkuRows] = useState<any[]>([]);
  const [distributionRows, setDistributionRows] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const url = `/api/product-os/demand-trends?start=${startDate}&end=${endDate}&compareStart=${
      compareStartDate || startDate
    }&compareEnd=${compareEndDate || endDate}`;

    fetch(url)
      .then((res) => res.json())
      .then((res) => {
        setTrendRows(
          (res.trend_rows || []).map((d: any) => ({
            date: formatDate(d.date),
            revenue: Math.round(Number(d.revenue || 0)),
            units: Math.round(Number(d.units || 0)),
            compare_revenue: Math.round(Number(d.compare_revenue || 0)),
            compare_units: Math.round(Number(d.compare_units || 0)),
            revenue_ma7: Math.round(Number(d.revenue_ma7 || 0)),
            units_ma7: Math.round(Number(d.units_ma7 || 0)),
          }))
        );

        setTopSkuRows(
          (res.top_sku_rows || []).map((d: any) => ({
            date: formatDate(d.date),
            sku: d.sku,
            product_title: d.product_title,
            revenue: Math.round(Number(d.revenue || 0)),
            units: Math.round(Number(d.units || 0)),
          }))
        );

        setDistributionRows(
          (res.distribution_rows || []).map((d: any) => ({
            date: formatDate(d.date),
            top_sku_revenue: Math.round(Number(d.top_sku_revenue || 0)),
            rest_revenue: Math.round(Number(d.rest_revenue || 0)),
            top_sku_share: Number(d.top_sku_share || 0),
          }))
        );

        setInsights(res.insights || null);
      })
      .finally(() => setLoading(false));
  }, [startDate, endDate, compareStartDate, compareEndDate]);

  const skuList = Array.from(new Set(topSkuRows.map((d) => d.sku)));

  const topSkuChartData = trendRows.map((day) => {
    const row: any = { date: day.date };

    skuList.forEach((sku) => {
      const skuDay = topSkuRows.find(
        (d) => d.date === day.date && d.sku === sku
      );
      row[sku] = skuDay ? skuDay.revenue : 0;
    });

    return row;
  });

  if (loading) return <div className="p-4">Loading Demand Trends...</div>;

  return (
    <div className="space-y-3">
      <div className="bg-white p-4 rounded-lg border">
        <h2 className="text-[14px] font-semibold mb-1">Revenue Trend</h2>
        <p className="text-[10px] text-gray-500 mb-2.5">
          Current period vs compare period with 7-day moving average
        </p>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendRows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value: any) => money(Number(value))} />
            <Line type="monotone" dataKey="revenue" name="Revenue" dot={false} />
            <Line
              type="monotone"
              dataKey="compare_revenue"
              name="Compare Revenue"
              strokeDasharray="5 5"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="revenue_ma7"
              name="Revenue MA7"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-4 rounded-lg border">
        <h2 className="text-[14px] font-semibold mb-1">Units Trend</h2>
        <p className="text-[10px] text-gray-500 mb-2.5">
          Current period vs compare period with 7-day moving average
        </p>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendRows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="units" name="Units" dot={false} />
            <Line
              type="monotone"
              dataKey="compare_units"
              name="Compare Units"
              strokeDasharray="5 5"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="units_ma7"
              name="Units MA7"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-4 rounded-lg border">
        <h2 className="text-[14px] font-semibold mb-1">Top SKU Trends</h2>
        <p className="text-[10px] text-gray-500 mb-2.5">
          Top 5 SKUs by revenue in selected period
        </p>

        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={topSkuChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value: any) => money(Number(value))} />

            {skuList.map((sku) => (
              <Line
                key={sku}
                type="monotone"
                dataKey={sku}
                name={sku}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-4 rounded-lg border">
        <h2 className="text-[14px] font-semibold mb-1">
          Demand Distribution Shift
        </h2>
        <p className="text-[10px] text-gray-500 mb-2.5">
          Top 5 SKU revenue vs rest of portfolio
        </p>

        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={distributionRows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value: any) => money(Number(value))} />
            <Area
              type="monotone"
              dataKey="top_sku_revenue"
              name="Top 5 SKUs"
              stackId="1"
            />
            <Area
              type="monotone"
              dataKey="rest_revenue"
              name="Rest of Portfolio"
              stackId="1"
            />
          </AreaChart>
        </ResponsiveContainer>

        <div className="mt-2.5 rounded-lg border p-3">
          <p className="text-[10px] text-gray-500">Top SKU Share Movement</p>
          <p className="text-[14px] font-semibold">
            {pct(insights?.top_share_start)} → {pct(insights?.top_share_end)}
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border">
        <h2 className="text-[14px] font-semibold mb-2.5">Trend Insights</h2>

        <div className="space-y-3 text-[11px]">
          <div className="rounded-lg border p-3">
            Demand revenue is{' '}
            <span className="font-semibold">
              {pct(insights?.revenue_growth_pct)}
            </span>{' '}
            vs compare period.
          </div>

          <div className="rounded-lg border p-3">
            Units are{' '}
            <span className="font-semibold">
              {pct(insights?.units_growth_pct)}
            </span>{' '}
            vs compare period.
          </div>

          <div className="rounded-lg border p-3">
            Growth is primarily driven by{' '}
            <span className="font-semibold">
              {insights?.top_driver_sku || '-'}
            </span>{' '}
            contributing{' '}
            <span className="font-semibold">
              {pct(insights?.top_driver_contribution_pct)}
            </span>{' '}
            of selected-period revenue.
          </div>

          <div className="rounded-lg border p-3">
            Top SKU dependency moved from{' '}
            <span className="font-semibold">
              {pct(insights?.top_share_start)}
            </span>{' '}
            to{' '}
            <span className="font-semibold">
              {pct(insights?.top_share_end)}
            </span>
            .
          </div>
        </div>
      </div>
    </div>
  );
}
