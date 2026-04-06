import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== "ADMIN") redirect("/admin/orders");

  const customers = await prisma.user.findMany({
    where: { role: "USER" },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      createdAt: true, city: true, country: true,
      orders: { select: { id: true, amountTotal: true, status: true }, orderBy: { createdAt: "desc" } }
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main style={{ padding: "32px 40px", maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#fff", margin: 0 }}>Customers</h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "4px 0 0" }}>
          {customers.length} registered accounts
        </p>
      </div>

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {["Customer", "Email", "Location", "Orders", "Total spent", "Joined"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map((c, i) => {
              const totalSpent = c.orders.reduce((s, o) => s + (o.amountTotal || 0), 0);
              const paidOrders = c.orders.filter(o => ["PAID","PROCESSING","SHIPPED","FULFILLED"].includes(o.status));
              return (
                <tr key={c.id} style={{ borderBottom: i < customers.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                  <td style={{ padding: "11px 16px", color: "#fff" }}>
                    {c.firstName || c.lastName ? `${c.firstName || ""} ${c.lastName || ""}`.trim() : "—"}
                  </td>
                  <td style={{ padding: "11px 16px", color: "rgba(255,255,255,0.7)" }}>{c.email}</td>
                  <td style={{ padding: "11px 16px", color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                    {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td style={{ padding: "11px 16px", color: "rgba(255,255,255,0.7)" }}>{paidOrders.length}</td>
                  <td style={{ padding: "11px 16px", fontWeight: 600, color: totalSpent > 0 ? "#fff" : "rgba(255,255,255,0.3)" }}>
                    £{(totalSpent / 100).toFixed(2)}
                  </td>
                  <td style={{ padding: "11px 16px", color: "rgba(255,255,255,0.4)" }}>
                    {new Date(c.createdAt).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>No customer accounts yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
