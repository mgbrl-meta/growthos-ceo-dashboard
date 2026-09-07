'use client';

import { useEffect, useState } from 'react';

type Props = {
  startDate: string;
  endDate: string;
  compareStartDate?: string;
  compareEndDate?: string;
};

type Row = {
  sku: string;
  product_title: string;
  variant_title: string;
  units_l7: number;
  units_l30: number;
  revenue_l30: number;
  revenue_growth_pct: number;
  contribution_pct: number;
  sku_status: string;
};

export default function SkuPerformance({
  startDate,
  endDate,
  compareStartDate,
  compareEndDate,
}: Props) {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'revenue' | 'growth'>('revenue');
  const [filter, setFilter] = useState<
    'all' | 'Winner' | 'Declining' | 'Stable' | 'Dead'
  >('all');

  useEffect(() => {
    setLoading(true);

    const url = `/api/product-os/sku-performance?start=${startDate}&end=${endDate}&compareStart=${compareStartDate || startDate
      }&compareEnd=${compareEndDate || endDate}`;

    fetch(url)
      .then((res) => res.json())
      .then((res) => {
        setData(res.rows || []);
      })
      .catch(() => {
        setData([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [startDate, endDate, compareStartDate, compareEndDate]);

  if (loading) {
    return <div className="p-4">Loading SKU Performance...</div>;
  }

  const processedData = [...data]
    .filter((row) => {
      const status = String(row.sku_status || '').trim();

      if (filter === 'all') return true;
      return status === filter;
    })
    .sort((a, b) => {
      if (sortBy === 'revenue') {
        return Number(b.revenue_l30 || 0) - Number(a.revenue_l30 || 0);
      }

      return Number(b.revenue_growth_pct || 0) - Number(a.revenue_growth_pct || 0);
    });

  return (
    <div className="bg-white p-4 rounded-lg border">
      <h2 className="text-[14px] font-semibold mb-2.5">SKU Performance</h2>

      <p className="mb-3 text-[10px] text-gray-500">
        Showing {processedData.length} of {data.length} SKUs
      </p>

      <div className="flex gap-3 mb-2.5">
        <button
          onClick={() => setSortBy('revenue')}
          className={`px-3 py-1 rounded ${sortBy === 'revenue' ? 'bg-black text-white' : 'bg-gray-200'
            }`}
        >
          Sort: Revenue
        </button>

        <button
          onClick={() => setSortBy('growth')}
          className={`px-3 py-1 rounded ${sortBy === 'growth' ? 'bg-black text-white' : 'bg-gray-200'
            }`}
        >
          Sort: Growth
        </button>

        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded ${filter === 'all' ? 'bg-black text-white' : 'bg-gray-200'
            }`}
        >
          All
        </button>

        <button
          onClick={() => setFilter('Winner')}
          className={`px-3 py-1 rounded ${filter === 'Winner' ? 'bg-green-600 text-white' : 'bg-gray-200'
            }`}
        >
          Winners
        </button>

        <button
          onClick={() => setFilter('Declining')}
          className={`px-3 py-1 rounded ${filter === 'Declining' ? 'bg-red-600 text-white' : 'bg-gray-200'
            }`}
        >
          Declining
        </button>

        <button
          onClick={() => setFilter('Stable')}
          className={`px-3 py-1 rounded ${filter === 'Stable' ? 'bg-yellow-600 text-white' : 'bg-gray-200'
            }`}
        >
          Stable
        </button>

        <button
          onClick={() => setFilter('Dead')}
          className={`px-3 py-1 rounded ${filter === 'Dead' ? 'bg-gray-700 text-white' : 'bg-gray-200'
            }`}
        >
          Dead
        </button>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-[11px]">
          <thead className="text-left border-b">
            <tr>
              <th className="p-2">SKU</th>
              <th className="p-2">Product</th>
              <th className="p-2">Units</th>
              <th className="p-2">Revenue</th>
              <th className="p-2">Growth</th>
              <th className="p-2">Contribution</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>

          <tbody>
            {processedData.map((row) => (
              <tr key={row.sku} className="border-b hover:bg-gray-50">
                <td className="p-2 font-mono">{row.sku}</td>

                <td className="p-2">
                  {row.product_title}
                  <div className="text-[10px] text-gray-400">
                    {row.variant_title}
                  </div>
                </td>

                <td className="p-2">{row.units_l30}</td>

                <td className="p-2">
                  ₹{Math.round(row.revenue_l30).toLocaleString()}
                </td>

                <td className="p-2">
                  {(row.revenue_growth_pct * 100).toFixed(1)}%
                </td>

                <td className="p-2">
                  {(row.contribution_pct * 100).toFixed(1)}%
                </td>

                <td className="p-2">
                  <span
                    className={`px-2 py-1 rounded text-[10px] ${row.sku_status === 'Winner'
                      ? 'bg-green-100 text-green-700'
                      : row.sku_status === 'Declining'
                        ? 'bg-red-100 text-red-700'
                        : row.sku_status === 'Dead'
                          ? 'bg-gray-200 text-gray-600'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                  >
                    {row.sku_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
