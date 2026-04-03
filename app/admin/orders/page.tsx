import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

function spValue(sp: SP, key: string): string | undefined {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

function clampInt(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function formatGBPFromPennies(p: number | null | undefined) {
  const safe = Number.isFinite(Number(p)) ? Number(p) : 0;
  return `£${(safe / 100).toFixed(2)}`;
}

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function shortAddr(o: { addressLine1: string | null; postcode: string | null; city: string | null }) {
  const parts = [clean(o.addressLine1), clean(o.postcode), clean(o.city)].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

function shortCustomer(o: { name: string | null; phone: string | null; email: string | null; company: string | null }) {
  const name = clean(o.name);
  const company = clean(o.company);
  const phone = clean(o.phone);
  const email = clean(o.email);

  const primary = name || company || email || "—";
  const secondary = phone ? ` • ${phone}` : "";
  return `${primary}${secondary}`;
}

function statusPill(status: string) {
  const s = (status || "").toUpperCase();

  const cls =
    s === "PAID"
      ? "border-green-500/30 bg-green-500/10 text-green-200"
      : s === "PROCESSING"
      ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-200"
      : s === "SHIPPED"
      ? "border-blue-500/30 bg-blue-500/10 text-blue-200"
      : s === "REFUNDED"
      ? "border-red-500/30 bg-red-500/10 text-red-200"
      : s === "CANCELLED" || s === "FAILED"
      ? "border-gray-500/30 bg-gray-500/10 text-gray-200"
      : "border-white/15 bg-white/5 text-white/80";

  return <span className={`rounded-full border px-3 py-1 text-xs font-bold ${cls}`}>{s || "—"}</span>;
}

function miniPill(label: string, ok: boolean) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${
        ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-white/15 bg-white/5 text-white/60"
      }`}
      title={label}
    >
      {label}
    </span>
  );
}

const STATUSES = ["ALL", "PENDING", "PAID", "PROCESSING", "SHIPPED", "REFUNDED", "CANCELLED", "FAILED"] as const;
type StatusFilter = (typeof STATUSES)[number];

function normalizeStatus(v: string): StatusFilter {
  const u = (v || "").toUpperCase();
  return (STATUSES as readonly string[]).includes(u) ? (u as StatusFilter) : "ALL";
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  const q = (spValue(sp, "q") ?? "").trim();
  const status = normalizeStatus(spValue(sp, "status") ?? "ALL");

  const page = clampInt(Number(spValue(sp, "page") ?? "1") || 1, 1, 999999);
  const pageSize = clampInt(Number(spValue(sp, "pageSize") ?? "25") || 25, 10, 100);

  const where: any = {
    ...(status !== "ALL" ? { status } : {}),
    ...(q
      ? {
          OR: [
            { id: { contains: q } },
            { orderRef: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { receiptEmail: { contains: q, mode: "insensitive" } },
            { stripeSessionId: { contains: q } },
            { paymentIntentId: { contains: q } },
            { trackingNo: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const total = await prisma.order.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = clampInt(page, 1, totalPages);

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (safePage - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      orderRef: true,
      createdAt: true,

      email: true,
      receiptEmail: true,

      name: true,
      company: true,
      phone: true,

      safePlace: true,
      addressLine1: true,
      city: true,
      postcode: true,

      amountTotal: true,
      status: true,

      stripeSessionId: true,
      paymentIntentId: true,

      trackingNo: true,
      trackingUrl: true,

      items: { select: { quantity: true } },
    },
  });

  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (status && status !== "ALL") baseParams.set("status", status);
  baseParams.set("pageSize", String(pageSize));

  const prevHref = (() => {
    const p = new URLSearchParams(baseParams);
    p.set("page", String(Math.max(1, safePage - 1)));
    return `/admin/orders?${p.toString()}`;
  })();

  const nextHref = (() => {
    const p = new URLSearchParams(baseParams);
    p.set("page", String(Math.min(totalPages, safePage + 1)));
    return `/admin/orders?${p.toString()}`;
  })();

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold">Orders</h1>
            <p className="mt-1 text-sm text-white/60">
              {total} total — showing page {safePage} of {totalPages}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/analytics"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
              title="Sales & profit analytics"
            >
              Analytics
            </Link>

            <Link
              href="/admin/products"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
            >
              Products
            </Link>

            <Link
              href="/admin/deals"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
            >
              Weekly Specials
            </Link>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <form method="GET" className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search email / receipt email / order ref / session / payment / tracking…"
              className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm text-white outline-none placeholder:text-white/40 sm:w-[440px]"
            />

            <select
              name="status"
              defaultValue={status}
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="PAID">PAID</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="SHIPPED">SHIPPED</option>
              <option value="REFUNDED">REFUNDED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="FAILED">FAILED</option>
            </select>

            <select
              name="pageSize"
              defaultValue={String(pageSize)}
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="10">10 / page</option>
              <option value="25">25 / page</option>
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
            </select>

            <input type="hidden" name="page" value="1" />

            <button
              type="submit"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
            >
              Apply
            </button>

            {(q || (status && status !== "ALL")) && (
              <Link
                href="/admin/orders"
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
              >
                Clear
              </Link>
            )}
          </form>
        </div>

        {/* Table */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5">
          <div className="w-full overflow-x-auto">
            <table className="min-w-[1180px] w-full border-collapse">
              <thead className="text-left text-xs uppercase text-white/60">
                <tr className="border-b border-white/10">
                  <th className="p-4">Date</th>
                  <th className="p-4">Emails</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Address</th>
                  <th className="p-4">Safe place</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Items</th>
                  <th className="p-4">Order</th>

                  <th className="sticky right-0 z-10 p-4 text-right bg-[#0b0b0b]/95 backdrop-blur border-l border-white/10">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td className="p-4 text-white/60" colSpan={10}>
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => {
                    const qty = (o.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0);

                    const hasReceiptEmail = !!clean(o.receiptEmail);
                    const hasTrackingEmail = !!clean(o.email);
                    const hasTracking = !!(clean(o.trackingNo) || clean(o.trackingUrl));

                    return (
                      <tr key={o.id} className="border-b border-white/5 align-top">
                        <td className="p-4 text-sm text-white/80">
                          {new Date(o.createdAt).toLocaleString("en-GB")}
                        </td>

                        <td className="p-4 text-sm">
                          <div className="grid gap-1">
                            <div className="text-white/80">
                              <span className="text-xs text-white/50">Tracking:</span>{" "}
                              {o.email || <span className="text-white/50">—</span>}
                            </div>
                            <div className="text-white/80">
                              <span className="text-xs text-white/50">Receipt:</span>{" "}
                              {o.receiptEmail || <span className="text-white/50">—</span>}
                            </div>
                            <div className="flex flex-wrap gap-1 pt-1">
                              {miniPill("tracking email", hasTrackingEmail)}
                              {miniPill("receipt email", hasReceiptEmail)}
                              {miniPill("tracking info", hasTracking)}
                            </div>
                          </div>
                        </td>

                        <td className="p-4 text-sm text-white/80">{shortCustomer(o)}</td>
                        <td className="p-4 text-sm text-white/80">{shortAddr(o)}</td>

                        <td className="p-4 text-sm text-white/80">
                          {o.safePlace ? o.safePlace : <span className="text-white/50">—</span>}
                        </td>

                        <td className="p-4 text-sm font-extrabold">{formatGBPFromPennies(o.amountTotal)}</td>

                        <td className="p-4 text-sm">
                          <div className="flex flex-col gap-2">
                            {statusPill(o.status)}
                            {o.status?.toUpperCase() === "SHIPPED" && (
                              <div className="text-xs text-white/60">
                                {o.trackingNo ? (
                                  <div>
                                    Tracking: <span className="font-mono text-white/80">{o.trackingNo}</span>
                                  </div>
                                ) : o.trackingUrl ? (
                                  <div>Tracking link saved</div>
                                ) : (
                                  <div className="text-amber-200">No tracking saved</div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="p-4 text-sm text-white/80">{qty}</td>

                        <td className="p-4 text-xs text-white/60">
                          <div className="grid gap-1">
                            <span className="font-mono">Ref: {o.orderRef || "—"}</span>
                            <span className="font-mono">
                              Session: {o.stripeSessionId ? `${o.stripeSessionId.slice(0, 12)}…` : "—"}
                            </span>
                          </div>
                        </td>

                        <td className="sticky right-0 z-10 p-4 text-right bg-[#0b0b0b]/95 backdrop-blur border-l border-white/10">
                          <Link
                            href={`/admin/orders/${o.id}`}
                            className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/15"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 p-4">
            <div className="text-xs text-white/60">
              Page {safePage} of {totalPages}
            </div>

            <div className="flex gap-2">
              <Link
                href={prevHref}
                className={`rounded-xl border border-white/15 px-4 py-2 text-xs font-bold ${
                  safePage <= 1 ? "pointer-events-none bg-white/5 opacity-40" : "bg-white/10 hover:bg-white/15"
                }`}
              >
                Prev
              </Link>

              <Link
                href={nextHref}
                className={`rounded-xl border border-white/15 px-4 py-2 text-xs font-bold ${
                  safePage >= totalPages ? "pointer-events-none bg-white/5 opacity-40" : "bg-white/10 hover:bg-white/15"
                }`}
              >
                Next
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-white/50">
          Webhook saves receipt email + payment. Admin sends fulfilment/tracking updates to the tracking email.
        </p>
      </div>
    </main>
  );
}