// app/admin/dashboard/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fmtInt(n: number) {
  const x = Number.isFinite(n) ? Math.trunc(n) : 0;
  return x.toLocaleString();
}

type QuickLink = {
  href: string;
  label: string;
};

function QuickLinksRow({ links }: { links: QuickLink[] }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}

function StatCard({
  title,
  value,
  href,
  subtitle,
  actions,
}: {
  title: string;
  value: string;
  href?: string;
  subtitle?: string;
  actions?: QuickLink[];
}) {
  const card = (
    <div className="rounded-2xl border border-white/10 bg-white p-5 text-black">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-black/50">{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-black/55">{subtitle}</div> : null}
        </div>

        {href ? (
          <Link
            href={href}
            className="rounded-full border border-black/10 bg-black/5 px-3 py-1 text-[11px] font-semibold text-black hover:bg-black/10"
          >
            View
          </Link>
        ) : null}
      </div>

      <div className="mt-3 text-3xl font-extrabold">{value}</div>

      {actions?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="rounded-full border border-black/10 bg-black/5 px-3 py-1 text-[11px] font-semibold text-black hover:bg-black/10"
            >
              {a.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );

  // If you want the entire card clickable later, we can wrap it.
  return card;
}

export default async function DashboardPage() {
  const [
    totalProducts,
    activeProducts,
    lowStockProducts,
    activeDeals,
    pendingOrders,
    paidOrders,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.count({ where: { isActive: true, stock: { gt: 0, lt: 5 } } }),
    prisma.deal.count({ where: { isActive: true } }),

    // These two are safe even if you don’t use them yet; if your schema doesn’t have status, delete them.
    prisma.order?.count ? prisma.order.count({ where: { status: "PENDING" as any } }) : Promise.resolve(0),
    prisma.order?.count ? prisma.order.count({ where: { status: "PAID" as any } }) : Promise.resolve(0),
  ]);

  const topQuickLinks: QuickLink[] = [
    { href: "/admin/products", label: "Products" },
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/shipping", label: "Shipping" },
    { href: "/admin/deals", label: "Deals" },
  ];

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold">Dashboard</h1>
        <p className="mt-1 text-sm text-white/60">Quick health checks.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="Products"
          subtitle="Manage catalogue & stock"
          value={fmtInt(totalProducts)}
          href="/admin/products"
          actions={[
            { href: "/admin/products", label: "Manage" },
            { href: "/admin/products?filter=low-stock", label: "Low stock" },
          ]}
        />

        <StatCard
          title="Active products"
          subtitle="Visible on site"
          value={fmtInt(activeProducts)}
          href="/admin/products"
          actions={[{ href: "/admin/products?filter=active", label: "View active" }]}
        />

        <StatCard
          title="Low stock (1–4)"
          subtitle="Restock soon"
          value={fmtInt(lowStockProducts)}
          href="/admin/products?filter=low-stock"
          actions={[
            { href: "/admin/products?filter=low-stock", label: "View list" },
            { href: "/admin/products", label: "All products" },
          ]}
        />

        <StatCard
          title="Active deals"
          subtitle="Weekly specials running"
          value={fmtInt(activeDeals)}
          href="/admin/deals"
          actions={[
            { href: "/admin/deals", label: "Manage deals" },
            { href: "/admin/products", label: "Pick products" },
          ]}
        />
      </div>

      {/* Optional order quick stats (only useful if your Orders page uses these statuses) */}
      {(pendingOrders > 0 || paidOrders > 0) && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <StatCard
            title="Pending orders"
            subtitle="Need payment / review"
            value={fmtInt(pendingOrders)}
            href="/admin/orders?status=PENDING"
            actions={[{ href: "/admin/orders?status=PENDING", label: "View" }]}
          />

          <StatCard
            title="Paid orders"
            subtitle="Ready to process"
            value={fmtInt(paidOrders)}
            href="/admin/orders?status=PAID"
            actions={[
              { href: "/admin/orders?status=PAID", label: "View" },
              { href: "/admin/orders", label: "All orders" },
            ]}
          />
        </div>
      )}

      {/* Your existing quick links row (kept) */}
      <QuickLinksRow links={topQuickLinks} />
    </div>
  );
}