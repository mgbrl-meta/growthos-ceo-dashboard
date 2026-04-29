"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

export default function Dashboard() {
  const [data, setData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("ceo");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [compareStartDate, setCompareStartDate] = useState("");
  const [compareEndDate, setCompareEndDate] = useState("");

  useEffect(() => {
    fetch("/api/ceo-summary")
      .then((res) => res.json())
      .then((rows) => {
        setData(rows);

        if (rows.length > 0) {
          const sorted = [...rows].reverse();
          const latest = sorted[sorted.length - 1]?.date;
          const start = sorted[Math.max(sorted.length - 30, 0)]?.date;

          setStartDate(start);
          setEndDate(latest);

          const compareEnd = sorted[Math.max(sorted.length - 31, 0)]?.date;
          const compareStart = sorted[Math.max(sorted.length - 60, 0)]?.date;

          setCompareStartDate(compareStart);
          setCompareEndDate(compareEnd);
        }
      });
  }, []);

  const filteredRows = useMemo(() => {
    return filterByDate(data, startDate, endDate).reverse();
  }, [data, startDate, endDate]);

  const compareRows = useMemo(() => {
    return filterByDate(data, compareStartDate, compareEndDate);
  }, [data, compareStartDate, compareEndDate]);

  const current = getSummary(filteredRows);
  const compare = getSummary(compareRows);

  const latest = filteredRows[filteredRows.length - 1];

  if (!latest) {
    return <main className="p-8">Loading GrowthOS...</main>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-900">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">GrowthOS Dashboard</h1>
        <p className="text-gray-500">
          CEO summary, channel economics, customer quality and alerts
        </p>
      </div>

      <div className="mb-6 flex gap-3 border-b">
        <Tab active={activeTab === "ceo"} onClick={() => setActiveTab("ceo")}>
          CEO Summary
        </Tab>
        <Tab active={activeTab === "meta"} onClick={() => setActiveTab("meta")}>
          Meta OS
        </Tab>
        <Tab active={activeTab === "google"} onClick={() => setActiveTab("google")}>
          Google OS
        </Tab>
        <Tab active={activeTab === "retention"} onClick={() => setActiveTab("retention")}>
          Retention OS
        </Tab>
        <Tab active={activeTab === "product"} onClick={() => setActiveTab("product")}>
          Product OS
        </Tab>
      </div>

      <div className="mb-8 rounded-2xl bg-white p-5 border shadow-sm">
        <h2 className="text-lg font-bold mb-4">Date Filters</h2>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <DateInput label="Start Date" value={startDate} onChange={setStartDate} />
          <DateInput label="End Date" value={endDate} onChange={setEndDate} />
          <DateInput
            label="Compare Start Date"
            value={compareStartDate}
            onChange={setCompareStartDate}
          />
          <DateInput
            label="Compare End Date"
            value={compareEndDate}
            onChange={setCompareEndDate}
          />
        </div>

        <div className="flex gap-3">
          <QuickButton
            label="Last 7 Days"
            onClick={() => applyQuickRange(data, 7, setStartDate, setEndDate)}
          />
          <QuickButton
            label="Last 30 Days"
            onClick={() => applyQuickRange(data, 30, setStartDate, setEndDate)}
          />
          <QuickButton
            label="Last 60 Days"
            onClick={() => applyQuickRange(data, 60, setStartDate, setEndDate)}
          />
        </div>
      </div>

      {activeTab === "ceo" && (
        <CeoSummary
          rows={filteredRows}
          latest={latest}
          current={current}
          compare={compare}
        />
      )}

      {activeTab !== "ceo" && (
        <div className="rounded-2xl bg-white p-8 border shadow-sm">
          <h2 className="text-xl font-bold mb-2">
            {activeTab.toUpperCase()} coming next
          </h2>
          <p className="text-gray-500">
            This tab is reserved for the next GrowthOS module.
          </p>
        </div>
      )}
    </main>
  );
}

function CeoSummary({ rows, latest, current, compare }: any) {
  const channelData = [
    {
      channel: "Meta",
      spend: current.metaSpend,
      revenue: current.metaRevenue,
      roas: safeDivide(current.metaRevenue, current.metaSpend),
      contribution: safeDivide(current.metaRevenue, current.revenue),
    },
    {
      channel: "Google",
      spend: current.googleSpend,
      revenue: current.googleRevenue,
      roas: safeDivide(current.googleRevenue, current.googleSpend),
      contribution: safeDivide(current.googleRevenue, current.revenue),
    },
  ];

  const alerts = getAlerts(current);

  return (
    <>
      <Section title="1. North Star — 5 Second CEO View">
        <div className="grid grid-cols-5 gap-4">
          <Card
            title="Revenue"
            value={current.revenue}
            compareValue={compare.revenue}
            prefix="₹"
          />
          <Card
            title="Total Spend"
            value={current.spend}
            compareValue={compare.spend}
            prefix="₹"
          />
          <Card
            title="Contribution After Ads"
            value={current.revenue - current.spend}
            compareValue={compare.revenue - compare.spend}
            prefix="₹"
          />
          <Card
            title="Blended ROAS"
            value={safeDivide(current.revenue, current.spend)}
            compareValue={safeDivide(compare.revenue, compare.spend)}
          />
          <Card
            title="New CAC"
            value={safeDivide(current.spend, current.newCustomers)}
            compareValue={safeDivide(compare.spend, compare.newCustomers)}
            prefix="₹"
          />
        </div>
      </Section>

      <Section title="2. Channel Efficiency">
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-2xl bg-white p-5 border shadow-sm">
            <h3 className="font-semibold mb-4">Channel Split</h3>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2">Channel</th>
                  <th>Spend</th>
                  <th>Revenue</th>
                  <th>ROAS</th>
                  <th>% Revenue</th>
                </tr>
              </thead>
              <tbody>
                {channelData.map((c) => (
                  <tr key={c.channel} className="border-b">
                    <td className="py-3 font-medium">{c.channel}</td>
                    <td>₹{format(c.spend)}</td>
                    <td>₹{format(c.revenue)}</td>
                    <td>{format(c.roas)}</td>
                    <td>{format(c.contribution * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ChartCard title="Meta vs Google Spend">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={channelData}>
                <XAxis dataKey="channel" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="spend" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>

      <Section title="3. Customer Economics">
        <div className="grid grid-cols-4 gap-4">
          <Card title="New Customers" value={current.newCustomers} />
          <Card title="Repeat Customers" value={current.repeatCustomers} />
          <Card title="New Revenue" value={current.newRevenue} prefix="₹" />
          <Card title="Repeat Revenue" value={current.repeatRevenue} prefix="₹" />
          <Card
            title="Repeat Revenue %"
            value={safeDivide(current.repeatRevenue, current.revenue) * 100}
            suffix="%"
          />
          <Card title="AOV" value={safeDivide(current.revenue, current.orders)} prefix="₹" />
          <Card title="Blended CAC" value={safeDivide(current.spend, current.customers)} prefix="₹" />
          <Card title="New CAC" value={safeDivide(current.spend, current.newCustomers)} prefix="₹" />
        </div>
      </Section>

      <Section title="4. Business Trend">
        <div className="grid grid-cols-2 gap-6">
          <ChartCard title="Revenue vs Spend">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={rows}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="total_spend" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="ROAS Trend">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={rows}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="blended_roas" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>

      <Section title="5. Efficiency Alerts">
        <div className="grid grid-cols-1 gap-3">
          {alerts.map((alert: any, index: number) => (
            <div key={index} className="rounded-xl border bg-white p-4 shadow-sm">
              <p
                className={
                  alert.type === "danger"
                    ? "text-red-600 font-semibold"
                    : alert.type === "warning"
                    ? "text-yellow-600 font-semibold"
                    : "text-green-600 font-semibold"
                }
              >
                {alert.message}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

function Tab({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "border-b-2 border-black px-4 py-3 font-semibold"
          : "px-4 py-3 text-gray-500"
      }
    >
      {children}
    </button>
  );
}

function DateInput({ label, value, onChange }: any) {
  return (
    <div>
      <label className="text-sm text-gray-500">{label}</label>
      <input
        type="date"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border px-3 py-2"
      />
    </div>
  );
}

function QuickButton({ label, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
    >
      {label}
    </button>
  );
}

function Section({ title, children }: any) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Card({ title, value, compareValue, prefix = "", suffix = "" }: any) {
  const change =
    compareValue !== undefined && Number(compareValue) !== 0
      ? ((Number(value || 0) - Number(compareValue || 0)) /
          Number(compareValue || 0)) *
        100
      : null;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border">
      <p className="text-sm text-gray-500">{title}</p>
      <h2 className="text-2xl font-bold mt-2">
        {prefix}
        {format(value)}
        {suffix}
      </h2>

      {change !== null && (
        <p className={change >= 0 ? "text-green-600 text-sm mt-2" : "text-red-600 text-sm mt-2"}>
          {change >= 0 ? "▲" : "▼"} {format(Math.abs(change))}% vs compare
        </p>
      )}
    </div>
  );
}

function ChartCard({ title, children }: any) {
  return (
    <div className="rounded-2xl bg-white p-5 border shadow-sm">
      <h3 className="font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function filterByDate(rows: any[], start: string, end: string) {
  return rows.filter((row) => {
    const date = normalizeDate(row.date);
    if (!date) return false;
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  });
}

function normalizeDate(date: any) {
  if (!date) return "";
  if (typeof date === "string") return date.slice(0, 10);
  if (date.value) return date.value.slice(0, 10);
  return "";
}

function applyQuickRange(
  data: any[],
  days: number,
  setStartDate: any,
  setEndDate: any
) {
  const sorted = [...data].reverse();
  const end = sorted[sorted.length - 1]?.date;
  const start = sorted[Math.max(sorted.length - days, 0)]?.date;

  setStartDate(normalizeDate(start));
  setEndDate(normalizeDate(end));
}

function getSummary(rows: any[]) {
  return {
    revenue: sum(rows, "revenue"),
    spend: sum(rows, "total_spend"),
    orders: sum(rows, "orders"),
    customers: sum(rows, "customers"),
    newCustomers: sum(rows, "new_customers"),
    repeatCustomers: sum(rows, "repeat_customers"),
    newRevenue: sum(rows, "new_customer_revenue"),
    repeatRevenue: sum(rows, "repeat_customer_revenue"),
    metaSpend: sum(rows, "meta_spend"),
    metaRevenue: sum(rows, "meta_revenue"),
    googleSpend: sum(rows, "google_spend"),
    googleRevenue: sum(rows, "google_revenue"),
  };
}

function sum(rows: any[], key: string) {
  return rows.reduce((acc, row) => acc + Number(row[key] || 0), 0);
}

function safeDivide(a: any, b: any) {
  const numerator = Number(a || 0);
  const denominator = Number(b || 0);
  if (denominator === 0) return 0;
  return numerator / denominator;
}

function format(value: any) {
  return Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

function getAlerts(current: any) {
  const alerts = [];

  const roas = safeDivide(current.revenue, current.spend);
  const newCac = safeDivide(current.spend, current.newCustomers);
  const repeatPct = safeDivide(current.repeatRevenue, current.revenue);

  if (roas < 1) {
    alerts.push({
      type: "danger",
      message: "🔴 Blended ROAS is below 1. Business is spending more than it is recovering.",
    });
  }

  if (newCac > 2000) {
    alerts.push({
      type: "danger",
      message: "🔴 New CAC is above ₹2,000. Acquisition efficiency needs immediate review.",
    });
  }

  if (repeatPct < 0.25) {
    alerts.push({
      type: "warning",
      message: "🟡 Repeat revenue is below 25%. Retention contribution is weak.",
    });
  }

  if (current.metaSpend > current.googleSpend * 3) {
    alerts.push({
      type: "warning",
      message: "🟡 High Meta dependency. If Meta efficiency drops, business revenue is exposed.",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      type: "good",
      message: "✅ No major efficiency alerts today.",
    });
  }

  return alerts;
}