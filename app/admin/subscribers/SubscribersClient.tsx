"use client";
import { useState } from "react";

type Subscriber = {
  id: string;
  email: string;
  firstName: string | null;
  source: string | null;
  subscribed: boolean;
  createdAt: Date;
};

export default function SubscribersClient({ subscribers }: { subscribers: Subscriber[] }) {
  const active = subscribers.filter(s => s.subscribed);

  function exportCSV() {
    const csv = "Email,First Name,Source,Date\n" + active.map(s =>
      `${s.email},${s.firstName || ""},${s.source || "website"},${new Date(s.createdAt).toLocaleDateString("en-GB")}`
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subscribers.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ padding: "32px 40px", maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "#fff", margin: 0 }}>Newsletter subscribers</h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "4px 0 0" }}>
            {active.length} active · {subscribers.length} total
          </p>
        </div>
        <button
          onClick={exportCSV}
          style={{ background: "#fff", color: "#000", border: "none", borderRadius: 20, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          Export CSV
        </button>
      </div>

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {["Email", "Name", "Source", "Date", "Status"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subscribers.map((s, i) => (
              <tr key={s.id} style={{ borderBottom: i < subscribers.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                <td style={{ padding: "11px 16px", color: "#fff" }}>{s.email}</td>
                <td style={{ padding: "11px 16px", color: "rgba(255,255,255,0.6)" }}>{s.firstName || "—"}</td>
                <td style={{ padding: "11px 16px", color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                  <span style={{ background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 10 }}>{s.source || "website"}</span>
                </td>
                <td style={{ padding: "11px 16px", color: "rgba(255,255,255,0.4)" }}>{new Date(s.createdAt).toLocaleDateString("en-GB")}</td>
                <td style={{ padding: "11px 16px" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                    background: s.subscribed ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                    color: s.subscribed ? "#4ade80" : "rgba(255,255,255,0.3)",
                    border: s.subscribed ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.1)"
                  }}>{s.subscribed ? "Active" : "Unsubscribed"}</span>
                </td>
              </tr>
            ))}
            {subscribers.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>No subscribers yet — add the newsletter form to the site to start collecting emails</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, padding: "14px 18px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
          Use the Export CSV button to download all active subscribers and import into Mailchimp, Klaviyo, or SendGrid for newsletter campaigns.
        </p>
      </div>
    </main>
  );
}
