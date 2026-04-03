"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

type AnalyticsResponse = {
  ok: boolean;
  rangeDays: number;
  totals: {
    revenue: number;
    refunds: number;
    cogs: number;
    postageCost: number;
    affiliate: number;
    expenses: number;
    profit: number;
    orders: number;
  };
  series: Array<{
    date: string;
    revenue: number;
    refunds: number;
    cogs: number;
    postageCost: number;
    affiliate: number;
    expenses: number;
    profit: number;
    orders: number;
  }>;
  topPopular: Array<{ productId: string; name: string; qty: number; revenue: number; cogs: number; profit: number; orders: number }>;
  topProfitable: Array<{ productId: string; name: string; qty: number; revenue: number; cogs: number; profit: number; orders: number }>;
  biggestSpenders: Array<{ key: string; revenue: number; orders: number }>;
  peakHours: Array<{ hour: number; count: number }>;
  peakDays: Array<{ day: string; count: number }>;
};

function gbp(p: number) {
  const safe = Number.isFinite(p) ? p : 0;
  return `£${(safe / 100).toFixed(2)}`;
}

function shortDate(s: string) {
  // "YYYY-MM-DD" => "DD/MM"
  const [y, m, d] = (s || "").split("-");
  if (!y || !m || !d) return s;
  return `${d}/${m}`;
}

export default function AnalyticsClient() {
  const [days, setDays] = useState<30 | 90 | 180 | 365>(30);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsResponse | null>(null);

  async function load(range: number) {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/analytics?days=${range}`, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw new Error(json?.error || "Failed to load analytics");
      setData(json as AnalyticsResponse);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const series = data?.series ?? [];

  const cards = useMemo(() => {
    const t = data?.totals;
    if (!t) return [];
    return [
      { label: "Total Revenue", value: gbp(t.revenue) },
      { label: "Refunds", value: gbp(t.refunds) },
      { label: "COGS", value: gbp(t.cogs) },
      { label: "Postage Cost", value: gbp(t.postageCost) },
      { label: "Business Expenses", value: gbp(t.expenses) },
      { label: "Affiliate", value: gbp(t.affiliate) },
      { label: "Net Profit", value: gbp(t.profit) },
      { label: "Orders", value: String(t.orders) },
    ];
  }, [data]);

  return (
    <div className="grid gap-6">
      {/* Range selector */}
      <div className="flex flex-wrap items-center gap-2">
        {[30, 90, 180, 365].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setDays(n as any)}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold border",
              days === n
                ? "bg-white/15 border-white/20"
                : "bg-white/5 border-white/10 hover:bg-white/10",
            ].join(" ")}
          >
            Last {n} days
          </button>
        ))}
        {loading ? <span className="text-sm text-white/60 ml-2">Loading…</span> : null}
        {err ? <span className="text-sm text-red-300 ml-2">{err}</span> : null}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/50">{c.label}</div>
            <div className="mt-2 text-lg font-extrabold">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Profit line chart */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">Revenue vs COGS vs Profit</h2>
          <div className="text-xs text-white/50">True profit includes postage + expenses</div>
        </div>

        <div className="mt-4 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={shortDate} />
              <YAxis tickFormatter={(v) => `£${Math.round(v / 100)}`} />
              <Tooltip
                formatter={(v: any, key: any) => [gbp(Number(v)), String(key)]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line type="monotone" dataKey="revenue" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cogs" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="profit" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Orders bar chart */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-base font-semibold">Orders (per day)</h2>
        <div className="mt-4 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={shortDate} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="orders" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-base font-semibold">Most profitable products</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-white/60">
                <tr>
                  <th className="text-left py-2 pr-3">Product</th>
                  <th className="text-right py-2 px-3">Qty</th>
                  <th className="text-right py-2 px-3">Profit</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topProfitable ?? []).map((p) => (
                  <tr key={p.productId} className="border-t border-white/10">
                    <td className="py-2 pr-3">{p.name}</td>
                    <td className="py-2 px-3 text-right">{p.qty}</td>
                    <td className="py-2 px-3 text-right font-semibold">{gbp(p.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-white/45">
            Profit is based on item price minus unit cost snapshot (unitCostPennies). If cost is blank, profit will look higher.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-base font-semibold">Most popular products</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-white/60">
                <tr>
                  <th className="text-left py-2 pr-3">Product</th>
                  <th className="text-right py-2 px-3">Qty</th>
                  <th className="text-right py-2 px-3">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topPopular ?? []).map((p) => (
                  <tr key={p.productId} className="border-t border-white/10">
                    <td className="py-2 pr-3">{p.name}</td>
                    <td className="py-2 px-3 text-right">{p.qty}</td>
                    <td className="py-2 px-3 text-right">{gbp(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-base font-semibold">Biggest spenders</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-white/60">
                <tr>
                  <th className="text-left py-2 pr-3">Customer</th>
                  <th className="text-right py-2 px-3">Orders</th>
                  <th className="text-right py-2 px-3">Spend</th>
                </tr>
              </thead>
              <tbody>
                {(data?.biggestSpenders ?? []).map((s) => (
                  <tr key={s.key} className="border-t border-white/10">
                    <td className="py-2 pr-3 break-all">{s.key}</td>
                    <td className="py-2 px-3 text-right">{s.orders}</td>
                    <td className="py-2 px-3 text-right font-semibold">{gbp(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-base font-semibold">Peak hours & peak days</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs text-white/50 mb-2">Peak hours (24h)</div>
              <div className="space-y-2">
                {(data?.peakHours ?? []).slice().sort((a,b)=>b.count-a.count).slice(0,6).map((h) => (
                  <div key={h.hour} className="flex items-center justify-between text-sm">
                    <span>{String(h.hour).padStart(2, "0")}:00</span>
                    <span className="text-white/70">{h.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs text-white/50 mb-2">Peak days</div>
              <div className="space-y-2">
                {(data?.peakDays ?? []).slice().sort((a,b)=>b.count-a.count).map((d) => (
                  <div key={d.day} className="flex items-center justify-between text-sm">
                    <span>{d.day}</span>
                    <span className="text-white/70">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-white/45">
            Peaks are currently based on server time. If you want “UK time always”, tell me and I’ll switch this to timezone-safe grouping.
          </p>
        </div>
      </div>

      {/* Next: expenses UI */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-base font-semibold">Business costs (next)</h2>
        <p className="mt-2 text-sm text-white/60">
          You’ve now got the DB + API for business expenses. Next we add a small admin page to add/edit them
          (Rent, Packaging, Materials, Fuel, etc.) and they’ll automatically subtract from profit.
        </p>
        <p className="mt-2 text-xs text-white/45">
          If you want, I’ll write <code className="text-white/70">/admin/expenses</code> with Add + list + delete.
        </p>
      </div>
    </div>
  );
}