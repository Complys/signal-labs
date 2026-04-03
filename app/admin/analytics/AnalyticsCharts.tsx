"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import RangePicker from "./RangePicker";

type DailyRow = {
  day: string; // YYYY-MM-DD
  orders: number;
  revenuePennies: number;
};

type StatusCounts = {
  PAID: number;
  PROCESSING: number;
  SHIPPED: number;
  CANCELLED: number;
  REFUNDED: number;
  FAILED: number;
  PENDING: number;
};

type TopProduct = {
  name: string;
  qty: number;
};

function gbpFromPennies(p: number) {
  const safe = Number.isFinite(p) ? p : 0;
  return `£${(safe / 100).toFixed(2)}`;
}

function compactDayLabel(s: string) {
  return String(s ?? "").slice(5); // "YYYY-MM-DD" -> "MM-DD"
}

function penniesTickFormatter(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return gbpFromPennies(n);
}

const PIE_COLORS = [
  "#7c3aed",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#3b82f6",
  "#a3a3a3",
  "#f97316",
];

function hasOverride(currentDays: number, globalDays?: number) {
  if (!globalDays) return false;
  return currentDays !== globalDays;
}

function niceDomainMax(n: number) {
  if (!Number.isFinite(n) || n <= 0) return 1;
  const pad = Math.max(1, Math.ceil(n * 0.15));
  return n + pad;
}

export default function AnalyticsCharts({
  revDaily,
  ordersDaily,
  revDays,
  ordersDays,
  statusCounts,
  topProducts,
  topDays,
  globalDays,
}: {
  revDaily: DailyRow[];
  ordersDaily: DailyRow[];
  revDays: number;
  ordersDays: number;
  statusCounts: StatusCounts;
  topProducts: TopProduct[];
  topDays: number;
  globalDays?: number;
}) {
  const revData = useMemo(
    () => (revDaily ?? []).map((d) => ({ ...d, dayShort: compactDayLabel(d.day) })),
    [revDaily]
  );

  const ordersData = useMemo(
    () => (ordersDaily ?? []).map((d) => ({ ...d, dayShort: compactDayLabel(d.day) })),
    [ordersDaily]
  );

  const statusData = useMemo(
    () =>
      [
        { name: "Pending", value: statusCounts.PENDING },
        { name: "Paid", value: statusCounts.PAID },
        { name: "Processing", value: statusCounts.PROCESSING },
        { name: "Shipped", value: statusCounts.SHIPPED },
        { name: "Cancelled", value: statusCounts.CANCELLED },
        { name: "Refunded", value: statusCounts.REFUNDED },
        { name: "Failed", value: statusCounts.FAILED },
      ].filter((x) => (x.value ?? 0) > 0),
    [statusCounts]
  );

  const topData = useMemo(() => {
    const seen = new Map<string, number>();

    return (topProducts ?? []).map((p) => {
      const raw = String(p?.name ?? "").trim() || "Unnamed product";
      const short = raw.length > 28 ? raw.slice(0, 28) + "…" : raw;

      const n = seen.get(short) ?? 0;
      seen.set(short, n + 1);

      const label = n === 0 ? short : `${short} (${n + 1})`;

      return { name: label, qty: Number(p?.qty ?? 0) || 0 };
    });
  }, [topProducts]);

  const topMax = useMemo(() => topData.reduce((m, r) => Math.max(m, r.qty), 0), [topData]);

  const revOverridden = hasOverride(revDays, globalDays);
  const ordersOverridden = hasOverride(ordersDays, globalDays);
  const topOverridden = hasOverride(topDays, globalDays);

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* Revenue */}
      <div className="rounded-2xl bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-black">Revenue trend ({revDays}d)</div>
              {revOverridden ? (
                <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold text-black/70">
                  Override
                </span>
              ) : null}
            </div>
            <div className="text-xs text-black/60">Paid-like: PAID / PROCESSING / SHIPPED / FULFILLED</div>
          </div>

          <RangePicker valueDays={revDays} paramKey="revDays" label="Range" compact globalKey="days" showUseGlobal />
        </div>

        <div className="mt-4 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dayShort" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={penniesTickFormatter} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: any, name: any) => {
                  if (name === "revenuePennies") return [gbpFromPennies(Number(value)), "Revenue"];
                  return [String(value), name];
                }}
              />
              <Line
                type="monotone"
                dataKey="revenuePennies"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Orders */}
      <div className="rounded-2xl bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-black">Orders per day ({ordersDays}d)</div>
              {ordersOverridden ? (
                <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold text-black/70">
                  Override
                </span>
              ) : null}
            </div>
            <div className="text-xs text-black/60">All orders created per day</div>
          </div>

          <RangePicker
            valueDays={ordersDays}
            paramKey="ordersDays"
            label="Range"
            compact
            globalKey="days"
            showUseGlobal
          />
        </div>

        <div className="mt-4 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ordersData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dayShort" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => [String(v), "Orders"]} />
              <Bar dataKey="orders" fill="#111827" radius={[6, 6, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Status */}
      <div className="rounded-2xl bg-white p-5">
        <div className="text-sm font-medium text-black">Order status split</div>
        <div className="text-xs text-black/60">Current snapshot</div>

        <div className="mt-4 h-[320px]">
          {statusData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [String(v), "Count"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="rounded-xl bg-black/5 p-3 text-sm text-black/70">No status data yet.</div>
          )}
        </div>
      </div>

      {/* Top products */}
      <div className="rounded-2xl bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-black">Top products ({topDays}d)</div>
              {topOverridden ? (
                <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold text-black/70">
                  Override
                </span>
              ) : null}
            </div>
            <div className="text-xs text-black/60">By quantity ordered</div>
          </div>

          <RangePicker valueDays={topDays} paramKey="topDays" label="Range" compact globalKey="days" showUseGlobal />
        </div>

        <div className="mt-4 h-[320px]">
          {topData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topData} layout="vertical" margin={{ left: 16, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  domain={[0, niceDomainMax(topMax)]}
                  tick={{ fontSize: 12 }}
                />
                <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => [String(v), "Qty"]} />
                <Bar dataKey="qty" fill="#2563eb" radius={[0, 8, 8, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="rounded-xl bg-black/5 p-3 text-sm text-black/70">No product data yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}