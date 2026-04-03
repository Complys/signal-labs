// app/admin/AdminQuickLinks.tsx
import Link from "next/link";
import type { CSSProperties } from "react";

const wrap: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 14,
};

const pillBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 650,
  textDecoration: "none",
  border: "1px solid #2a2a2a",
  color: "rgba(255,255,255,0.9)",
  background: "rgba(255,255,255,0.06)",
  transition: "all 150ms ease",
};

const items = [
  { label: "Products", href: "/admin/products" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Shipping", href: "/admin/shipping" }, // keep your route as-is
  { label: "Deals", href: "/admin/deals" },
];

export default function AdminQuickLinks() {
  return (
    <div style={wrap}>
      {items.map((x) => (
        <Link
          key={x.href}
          href={x.href}
          style={pillBase}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.10)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)";
          }}
        >
          {x.label}
        </Link>
      ))}
    </div>
  );
}