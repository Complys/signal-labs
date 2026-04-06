"use client";
import { useEffect, useState } from "react";
type PageViewRow = { path: string; _count: { path: number } };
type AbandonedSession = { sessionId: string; items: { name: string; variantLabel: string | null; quantity: number; pricePennies: number }[]; total: number; date: string };
type Data = { topPages: PageViewRow[]; totalPageViews: number; abandonedSessions: AbandonedSession[] };

export default function AnalyticsExtra({ days }: { days: number }) {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => { fetch("/api/admin/analytics-extra?days=" + days).then(r => r.json()).then(setData).catch(() => {}); }, [days]);
  if (!data) return <div className="mt-10 py-8 text-center text-sm text-white/30">Loading visitor data...</div>;
  return (
    <>
      <section className="mt-10">
        <h2 className="text-base font-semibold text-white mb-1">Page views</h2>
        <p className="text-xs text-white/40 mb-3">{data.totalPageViews} total views · last {days} days</p>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
          {data.topPages.length === 0 ? (
            <div className="p-6 text-center text-sm text-white/30">No page view data yet for this range</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <th style={{ padding: "10px 16px", textAlign: "left", color: "rgba(255,255,255,0.4)", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Page</th>
                <th style={{ padding: "10px 16px", textAlign: "right", color: "rgba(255,255,255,0.4)", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Views</th>
                <th style={{ padding: "10px 16px", textAlign: "right", color: "rgba(255,255,255,0.4)", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Share</th>
              </tr></thead>
              <tbody>{data.topPages.map((p, i) => (
                <tr key={p.path} style={{ borderBottom: i < data.topPages.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                  <td style={{ padding: "9px 16px" }}><span style={{ fontFamily: "monospace", fontSize: 12, background: "rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 4, color: "rgba(255,255,255,0.8)" }}>{p.path}</span></td>
                  <td style={{ padding: "9px 16px", textAlign: "right", fontWeight: 600, color: "#fff" }}>{p._count.path}</td>
                  <td style={{ padding: "9px 16px", textAlign: "right", color: "rgba(255,255,255,0.4)" }}>{data.totalPageViews > 0 ? Math.round(p._count.path / data.totalPageViews * 100) : 0}%</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </section>
      <section className="mt-10 mb-10">
        <h2 className="text-base font-semibold text-white mb-1">Abandoned baskets</h2>
        <p className="text-xs text-white/40 mb-3">Items added to cart in last 7 days not converted · {data.abandonedSessions.length} sessions</p>
        {data.abandonedSessions.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/30">No abandoned baskets yet — appears here once customers add items to cart</div>
        ) : (
          <div className="flex flex-col gap-3">{data.abandonedSessions.map(session => (
            <div key={session.sessionId} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>...{session.sessionId}</span>
                <div className="flex items-center gap-4">
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{new Date(session.date).toLocaleDateString("en-GB")}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>£{(session.total / 100).toFixed(2)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">{session.items.map((item, i) => (
                <span key={i} style={{ fontSize: 12, background: "rgba(255,255,255,0.08)", padding: "3px 10px", borderRadius: 20, color: "rgba(255,255,255,0.7)" }}>
                  {item.name}{item.variantLabel ? ` (${item.variantLabel})` : ""} × {item.quantity}
                </span>
              ))}</div>
            </div>
          ))}</div>
        )}
      </section>
    </>
  );
}
