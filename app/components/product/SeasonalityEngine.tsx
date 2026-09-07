'use client';

import { useEffect, useState } from 'react';

type Props = {
  startDate: string;
  endDate: string;
};

type Row = {
  sku: string;
  item_name: string;
  months_history: number;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
  seasonality_strength: number;
  peak_index: number;
  low_index: number;
  confidence: string;
  seasonality_type: string;
};

const months = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

export default function SeasonalityEngine({}: Props) {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/product-os/seasonality')
      .then((res) => res.json())
      .then((res) => setData(res.rows || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4">Loading Seasonality...</div>;

  return (
    <div className="bg-white p-4 rounded-lg border">
      <h2 className="text-[14px] font-semibold mb-1">Seasonality Engine</h2>
      <p className="text-[10px] text-gray-500 mb-2.5">
        Monthly SKU demand index. 1.00 = average month, above 1 = stronger demand.
      </p>

      <div className="overflow-x-auto max-h-[650px]">
        <table className="min-w-full text-[11px]">
          <thead className="sticky top-0 bg-white border-b">
            <tr>
              <th className="p-2 text-left">SKU</th>
              <th className="p-2 text-left">Item Name</th>
              <th className="p-2 text-right">History</th>
              {months.map((m) => (
                <th key={m} className="p-2 text-right uppercase">
                  {m}
                </th>
              ))}
              <th className="p-2 text-right">Strength</th>
              <th className="p-2 text-right">Type</th>
              <th className="p-2 text-right">Confidence</th>
            </tr>
          </thead>

          <tbody>
            {data.map((row) => (
              <tr key={row.sku} className="border-b hover:bg-gray-50">
                <td className="p-2 font-mono">{row.sku}</td>
                <td className="p-2 min-w-[260px]">{row.item_name}</td>
                <td className="p-2 text-right">{row.months_history} mo</td>

                {months.map((m) => {
                  const value = row[m] || 0;

                  return (
                    <td
                      key={m}
                      className={`p-2 text-right ${
                        value >= 1.2
                          ? 'font-semibold text-green-700'
                          : value <= 0.8
                          ? 'font-semibold text-red-700'
                          : ''
                      }`}
                    >
                      {value ? value.toFixed(2) : '-'}
                    </td>
                  );
                })}

                <td className="p-2 text-right">
                  {(row.seasonality_strength || 0).toFixed(2)}
                </td>

                <td className="p-2 text-right">{row.seasonality_type}</td>

                <td className="p-2 text-right">
                  <span
                    className={`px-2 py-1 rounded text-[10px] ${
                      row.confidence === 'High'
                        ? 'bg-green-100 text-green-700'
                        : row.confidence === 'Medium'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {row.confidence}
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
