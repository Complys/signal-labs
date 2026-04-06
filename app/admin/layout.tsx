// app/admin/layout.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { CSSProperties, ReactNode } from "react";
import { headers } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** ---------------- Styles ---------------- */
const baseLinkStyle: CSSProperties = {
  color: "#fff",
  textDecoration: "none",
  opacity: 0.85,
  fontWeight: 650,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid transparent",
  transition: "all 150ms ease",
};

function linkStyle(isActive: boolean): CSSProperties {
  if (!isActive) return baseLinkStyle;
  return {
    ...baseLinkStyle,
    opacity: 1,
    borderColor: "#2a2a2a",
    background: "rgba(255,255,255,0.08)",
  };
}

function sectionTitle(label: string): CSSProperties {
  return {
    marginTop: 14,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    opacity: 0.5,
  };
}

/**
 * Best-effort pathname detection for Server Components.
 * Different Next versions/runtimes can expose different headers.
 * We safely attempt common headers and fall back to "/admin".
 */
async function getPathnameSafe(): Promise<string> {
  try {
    const h = await headers();

    const candidates = [
      h.get("next-url"),
      h.get("x-url"),
      h.get("x-invoke-path"),
      h.get("referer"),
      h.get("x-forwarded-host")
        ? `https://${h.get("x-forwarded-host")}${h.get("x-invoke-path") || ""}`
        : "",
    ].filter(Boolean) as string[];

    const raw = candidates[0] || "";
    if (!raw) return "/admin";

    const u = new URL(raw, "http://localhost");
    return u.pathname || "/admin";
  } catch {
    return "/admin";
  }
}

/** ---------------- Nav ---------------- */
type NavItem = { label: string; href: string; hint?: string };

const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Products", href: "/admin/products" },
  { label: "Waitlist", href: "/admin/waitlist" },
  { label: "Weekly Specials", href: "/admin/deals" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Analytics", href: "/admin/analytics", hint: "Includes affiliate stats" },
];

const CONTENT_NAV: NavItem[] = [{ label: "Blog", href: "/admin/blog" }];

const AFFILIATE_NAV: NavItem[] = [
  { label: "Affiliates", href: "/admin/affiliates" },
  { label: "Applications", href: "/admin/affiliate-applications" },
  { label: "Payouts", href: "/admin/affiliate-payouts" },
];

const SETTINGS_NAV: NavItem[] = [
  { label: "Shipping", href: "/admin/shipping" },
  { label: "Users", href: "/admin/users" },
  { label: "Announcement Bar", href: "/admin/settings/announcement" },
  { label: "Multi-buy Discounts", href: "/admin/settings/multibuy" },
];

/** ---------------- Layout ---------------- */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [pendingApps, pendingPayouts] = await Promise.all([
    prisma.affiliateApplication.count({ where: { status: "PENDING" } }),
    prisma.affiliatePayoutRequest.count({ where: { status: "PENDING" } }),
  ]);
  const totalNotifications = pendingApps + pendingPayouts;

  const pathname = await getPathnameSafe();

  const session = await getServerSession(authOptions);

  if (!session) redirect("/admin-login");
  const role = (session.user as any)?.role ?? "USER";
  if (role !== "ADMIN" && role !== "FULFILMENT") redirect("/");
  const isFulfilment = role === "FULFILMENT";
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "260px 1fr",
        minHeight: "100vh",
        background: "#0b0b0b",
        color: "#fff",
      }}
    >
      <aside style={{ borderRight: "1px solid #1f1f1f", padding: 18 }}>
        <div style={{ fontWeight: 900, letterSpacing: 0.5, marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span><span style={{ color: "#f5c400" }}>Signal</span> Admin</span>
          {totalNotifications > 0 && (
            <span style={{ background: "#f5c400", color: "#000", borderRadius: 999, fontSize: 11, fontWeight: 800, padding: "2px 8px", minWidth: 20, textAlign: "center" }}>
              {totalNotifications}
            </span>
          )}
        </div>

        <nav style={{ display: "grid", gap: 8, fontSize: 14 }}>
          {MAIN_NAV.map((item) => (
            <Link key={item.href} style={linkStyle(isActive(item.href))} href={item.href}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span>{item.label}</span>
                {item.hint ? <span style={{ fontSize: 11, opacity: 0.55 }}>{item.hint}</span> : null}
              </div>
            </Link>
          ))}

          <div style={sectionTitle("Content")}>Content</div>
          {CONTENT_NAV.map((item) => (
            <Link key={item.href} style={linkStyle(isActive(item.href))} href={item.href}>
              {item.label}
            </Link>
          ))}

          <div style={sectionTitle("Affiliates")}>Affiliates</div>
          {AFFILIATE_NAV.map((item) => (
            <Link key={item.href} style={linkStyle(isActive(item.href))} href={item.href}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span>{item.label}</span>
                {item.href === "/admin/affiliate-applications" && pendingApps > 0 && (
                  <span style={{ background: "#f5c400", color: "#000", borderRadius: 999, fontSize: 10, fontWeight: 800, padding: "1px 7px" }}>
                    {pendingApps}
                  </span>
                )}
                {item.href === "/admin/affiliate-payouts" && pendingPayouts > 0 && (
                  <span style={{ background: "#f5c400", color: "#000", borderRadius: 999, fontSize: 10, fontWeight: 800, padding: "1px 7px" }}>
                    {pendingPayouts}
                  </span>
                )}
              </div>
            </Link>
          ))}

          <div style={sectionTitle("Settings")}>Settings</div>
          {SETTINGS_NAV.map((item) => (
            <Link key={item.href} style={linkStyle(isActive(item.href))} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ marginTop: 22, opacity: 0.6, fontSize: 12 }}>
          Tip: Bookmark <span style={{ opacity: 0.9 }}>/admin/dashboard</span>
        </div>
      </aside>

      <main style={{ padding: 22 }}>{children}</main>
    </div>
  );
}