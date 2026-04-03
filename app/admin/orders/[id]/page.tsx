// app/admin/orders/[id]/page.tsx
import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OrderAdminActions from "./OrderAdminActions";
import OrderEmailTools from "./OrderEmailTools";

export const dynamic = "force-dynamic";

/** ---------- formatting helpers ---------- */
function formatGBPFromPennies(p: unknown) {
  const n = typeof p === "number" ? p : Number(p);
  const safe = Number.isFinite(n) ? n : 0;
  return `£${(safe / 100).toFixed(2)}`;
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTime(v: unknown) {
  const d = toDate(v);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function joinAddress(parts: Array<string | null | undefined>) {
  const out = parts.map((p) => clean(p)).filter(Boolean);
  return out.length ? out.join(", ") : "—";
}

function toInt(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/** ---------- UI atoms ---------- */
function statusPill(statusRaw: string) {
  const s = (statusRaw || "").toUpperCase();
  const cls =
    s === "PAID"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : s === "PROCESSING"
      ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
      : s === "SHIPPED"
      ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-200"
      : s === "REFUNDED"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : s === "CANCELLED" || s === "FAILED"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
      : "border-white/15 bg-white/5 text-white/80";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-extrabold ${cls}`}>
      {s || "—"}
    </span>
  );
}

function Card({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
        <div className="text-xs font-semibold tracking-wide text-white/45 uppercase">{title}</div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-sm text-white/55">{k}</div>
      <div className="text-sm font-medium text-white/90 text-right break-all">{v}</div>
    </div>
  );
}

function EmailTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-extrabold text-white/80">
      {children}
    </span>
  );
}

function emailKind(typeRaw: string) {
  const t = clean(typeRaw).toUpperCase();
  if (t.includes("RECEIPT") || t.includes("PAID")) return "receipt";
  if (t.includes("SHIPPED") || t.includes("FULFIL") || t.includes("TRACK")) return "fulfilment";
  return "unknown";
}

function eventBadge(sourceRaw: unknown) {
  const s = clean(sourceRaw).toLowerCase();
  const cls =
    s === "stripe"
      ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
      : s === "admin"
      ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-200"
      : s === "app"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : "border-white/15 bg-white/5 text-white/70";

  const label = s ? s.toUpperCase() : "UNKNOWN";
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${cls}`}>{label}</span>;
}

/** Prisma Json can be object/array/string/number/bool/null */
function prettyJson(v: unknown) {
  if (v == null) return "";
  if (typeof v === "string") {
    const raw = v.trim();
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return raw;
    }
  }
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = await Promise.resolve(params);
  if (!id) return notFound();

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      orderRef: true,
      createdAt: true,
      status: true,
      currency: true,
      amountTotal: true,
      stripeSessionId: true,
      paymentIntentId: true,

      email: true,
      receiptEmail: true,

      name: true,
      company: true,
      phone: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      postcode: true,
      country: true,
      safePlace: true,
      deliveryNotes: true,

      userId: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          postcode: true,
          country: true,
          createdAt: true,
        },
      },

      // ✅ profit/shipping fields
      shippingChargedPennies: true,
      postageCostPennies: true,

      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          productId: true,
          name: true,
          unitPrice: true,
          quantity: true,
          lineTotal: true,
          unitCostPennies: true,
        },
      },

      trackingNo: true,
      trackingUrl: true,

      events: {
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          type: true,
          source: true,
          summary: true,
          data: true,
          createdAt: true,
          idempotencyKey: true,
        },
      },

      emailEvents: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          status: true,
          toEmail: true,
          subject: true,
          providerMessageId: true,
          error: true,
          createdAt: true,
          sentAt: true,
          idempotencyKey: true,
        },
      },
    },
  });

  if (!order) return notFound();

  const itemsQty = order.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  const isGuest = !order.userId;

  const fulfilmentEmail = clean(order.email);
  const receiptEmail = clean(order.receiptEmail);

  const displayName =
    clean(order.name) ||
    [clean(order.user?.firstName), clean(order.user?.lastName)].filter(Boolean).join(" ") ||
    "—";

  const displayPhone = clean(order.phone) || clean(order.user?.phone) || "—";
  const displayCompany = clean(order.company) || "—";

  const addressLine = joinAddress([
    clean(order.addressLine1) || order.user?.addressLine1,
    clean(order.addressLine2) || order.user?.addressLine2,
    clean(order.city) || order.user?.city,
    clean(order.postcode) || order.user?.postcode,
    clean(order.country) || order.user?.country,
  ]);

  const labelHref = `/admin/orders/${order.id}/label`;

  const sentCount = order.emailEvents.filter((e) => clean(e.status).toUpperCase() === "SENT").length;
  const failedCount = order.emailEvents.filter((e) => clean(e.status).toUpperCase() === "FAILED").length;

  const trackingUrl = clean(order.trackingUrl);
  const trackingNo = clean(order.trackingNo);

  const eventStripeCount = order.events.filter((e) => clean(e.source).toLowerCase() === "stripe").length;
  const eventAdminCount = order.events.filter((e) => clean(e.source).toLowerCase() === "admin").length;
  const eventAppCount = order.events.filter((e) => clean(e.source).toLowerCase() === "app").length;

  /** ✅ Profit math (pennies) */
  const itemsRevenuePennies = order.items.reduce((sum, it) => sum + toInt(it.lineTotal, 0), 0);

  const itemsCogsPennies = order.items.reduce((sum, it) => {
    const qty = toInt(it.quantity, 0);
    const unitCost = toInt(it.unitCostPennies, 0);
    return sum + qty * unitCost;
  }, 0);

  const shippingChargedPennies = toInt(order.shippingChargedPennies, 0);
  const postageCostPennies = toInt(order.postageCostPennies, 0);

  // Items only
  const itemsGrossProfitPennies = itemsRevenuePennies - itemsCogsPennies;

  // ✅ Include shipping charged as revenue to you (if customer paid it)
  const profitBeforePostagePennies = itemsGrossProfitPennies + shippingChargedPennies;

  // ✅ Postage cost is always your cost (free shipping or not)
  const netProfitPennies = profitBeforePostagePennies - postageCostPennies;

  const hasAnyCostSnapshot = order.items.some((it) => toInt(it.unitCostPennies, 0) > 0);

  return (
    <main className="min-h-screen bg-[#0B0D10] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-extrabold tracking-tight">Order</h1>
              {statusPill(order.status)}
              {isGuest ? (
                <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-extrabold text-amber-200">
                  GUEST
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-extrabold text-emerald-200">
                  REGISTERED
                </span>
              )}
            </div>

            <div className="mt-3 space-y-1 text-sm text-white/55">
              <div>
                <span className="text-white/40">Order ref:</span>{" "}
                <span className="font-mono text-white/90">{order.orderRef || "—"}</span>
              </div>
              <div>
                <span className="text-white/40">ID:</span>{" "}
                <span className="font-mono text-white/80">{order.id}</span>
              </div>
              <div>
                <span className="text-white/40">Created:</span>{" "}
                <span className="text-white/80">{formatDateTime(order.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/orders"
              className="rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold hover:bg-white/10"
            >
              Back to orders
            </Link>

            <Link
              href={labelHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-extrabold hover:bg-white/15"
            >
              Print label
            </Link>

            <Link
              href="/admin/products"
              className="rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold hover:bg-white/10"
            >
              Products
            </Link>
          </div>
        </div>

        {/* Layout */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* LEFT */}
          <div className="grid gap-6">
            <Card title="Order info">
              <div className="space-y-3">
                <KV k="Status" v={order.status || "—"} />
                <KV k="Currency" v={(order.currency || "gbp").toUpperCase()} />
                <KV k="Items" v={itemsQty} />
                <KV
                  k="Total"
                  v={<span className="text-lg font-extrabold">{formatGBPFromPennies(order.amountTotal)}</span>}
                />
                <KV
                  k="Stripe"
                  v={
                    <div className="space-y-1 text-right">
                      <div className="font-mono text-xs text-white/80">
                        Session: {order.stripeSessionId ? `${order.stripeSessionId.slice(0, 18)}…` : "—"}
                      </div>
                      <div className="font-mono text-xs text-white/60">
                        PI: {order.paymentIntentId ? `${order.paymentIntentId.slice(0, 18)}…` : "—"}
                      </div>
                    </div>
                  }
                />
              </div>
            </Card>

            {/* ✅ Profit + shipping breakdown */}
            <Card
              title="Profit & shipping"
              right={<div className="text-xs text-white/45">{hasAnyCostSnapshot ? "cost snapshot: ok" : "cost snapshot: missing/zero"}</div>}
            >
              <div className="space-y-3">
                <KV k="Items revenue" v={formatGBPFromPennies(itemsRevenuePennies)} />
                <KV k="Items COGS" v={formatGBPFromPennies(itemsCogsPennies)} />

                <div className="my-1 border-t border-white/10 pt-3" />

                <KV
                  k="Items gross profit"
                  v={
                    <span className={`text-sm font-extrabold ${itemsGrossProfitPennies >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                      {formatGBPFromPennies(itemsGrossProfitPennies)}
                    </span>
                  }
                />

                <KV k="Shipping charged (customer)" v={formatGBPFromPennies(shippingChargedPennies)} />

                <KV
                  k="Profit before postage"
                  v={
                    <span className={`text-sm font-extrabold ${profitBeforePostagePennies >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                      {formatGBPFromPennies(profitBeforePostagePennies)}
                    </span>
                  }
                />

                <KV
                  k="Postage cost (you)"
                  v={
                    <div className="text-right">
                      <div className="font-semibold">{formatGBPFromPennies(postageCostPennies)}</div>
                      <div className="text-[11px] text-white/45">Next: make this editable in Actions</div>
                    </div>
                  }
                />

                <div className="my-1 border-t border-white/10 pt-3" />

                <KV
                  k="Net profit (after postage)"
                  v={
                    <span className={`text-base font-extrabold ${netProfitPennies >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                      {formatGBPFromPennies(netProfitPennies)}
                    </span>
                  }
                />

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-white/55">
                  <div className="font-extrabold text-white/80">Notes</div>
                  <ul className="mt-2 list-disc pl-5 space-y-1">
                    <li>
                      <span className="font-semibold">Items gross profit</span> = revenue − COGS (snapshotted in{" "}
                      <span className="font-mono">OrderItem.unitCostPennies</span>).
                    </li>
                    <li>
                      <span className="font-semibold">Shipping charged</span> is what the customer paid (
                      <span className="font-mono">Order.shippingChargedPennies</span>).
                    </li>
                    <li>
                      <span className="font-semibold">Postage cost</span> is what it actually cost you (
                      <span className="font-mono">Order.postageCostPennies</span>).
                    </li>
                    <li>
                      Free shipping works naturally: shipping charged = £0.00 but postage cost still reduces profit.
                    </li>
                  </ul>
                </div>
              </div>
            </Card>

            <Card title="Customer & emails">
              <div className="space-y-3">
                <KV
                  k="Fulfilment email"
                  v={
                    <div className="flex flex-col items-end gap-2">
                      <div className={fulfilmentEmail ? "text-white/90" : "text-white/50"}>{fulfilmentEmail || "—"}</div>
                      <div className="flex items-center gap-2">
                        <EmailTag>Shipping / tracking</EmailTag>
                        {fulfilmentEmail ? (
                          <a className="text-xs underline text-white/70 hover:text-white" href={`mailto:${encodeURIComponent(fulfilmentEmail)}`}>
                            email
                          </a>
                        ) : null}
                      </div>
                    </div>
                  }
                />

                <KV
                  k="Receipt email"
                  v={
                    <div className="flex flex-col items-end gap-2">
                      <div className={receiptEmail ? "text-white/90" : "text-white/50"}>{receiptEmail || "—"}</div>
                      <div className="flex items-center gap-2">
                        <EmailTag>Payment / receipt</EmailTag>
                        {receiptEmail ? (
                          <a className="text-xs underline text-white/70 hover:text-white" href={`mailto:${encodeURIComponent(receiptEmail)}`}>
                            email
                          </a>
                        ) : null}
                      </div>
                    </div>
                  }
                />

                <div className="mt-2 grid gap-3 border-t border-white/10 pt-4">
                  <KV k="Name" v={displayName} />
                  <KV k="Company" v={displayCompany} />
                  <KV k="Phone" v={displayPhone} />
                  <KV k="Address" v={addressLine} />
                  <KV k="Safe place" v={clean(order.safePlace) || "—"} />
                  <KV k="Delivery notes" v={clean(order.deliveryNotes) || "—"} />
                </div>
              </div>

              <div className="mt-4 text-xs text-white/45">
                Fulfilment email = shipping / tracking updates • Receipt email = payment confirmation.
              </div>
            </Card>

            <Card title="Tracking">
              <div className="space-y-3">
                <KV k="Tracking number" v={trackingNo || "—"} />
                <KV
                  k="Tracking URL"
                  v={
                    trackingUrl ? (
                      <div className="flex flex-col items-end gap-2">
                        <a href={trackingUrl} target="_blank" rel="noreferrer" className="underline text-white/90 hover:text-white">
                          Open tracking link
                        </a>
                        <div className="text-xs text-white/50 max-w-[340px] break-all">{trackingUrl}</div>
                      </div>
                    ) : (
                      "—"
                    )
                  }
                />
              </div>
              <div className="mt-4 text-xs text-white/45">Tip: add tracking after dispatch, then set status to SHIPPED.</div>
            </Card>

            {/* Payment journey */}
            <Card
              title="Payment journey"
              right={
                <div className="text-xs text-white/45">
                  {eventStripeCount} stripe • {eventAppCount} app • {eventAdminCount} admin
                </div>
              }
            >
              {order.events.length === 0 ? (
                <div className="text-sm text-white/60">No journey events yet. (Stripe webhook / admin/app logging not writing?)</div>
              ) : (
                <div className="space-y-3">
                  {order.events.map((ev) => {
                    const type = clean(ev.type) || "—";
                    const summary = clean(ev.summary);
                    const dataPretty = prettyJson(ev.data);

                    return (
                      <div key={ev.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-extrabold text-white/90">{type}</div>
                              {eventBadge(ev.source)}
                            </div>
                            {summary ? <div className="mt-1 text-xs text-white/65">{summary}</div> : null}
                          </div>

                          <div className="shrink-0 text-xs text-white/50">{formatDateTime(ev.createdAt)}</div>
                        </div>

                        <div className="mt-2 text-xs text-white/55">
                          Key: <span className="font-mono">{clean(ev.idempotencyKey) || "—"}</span>
                        </div>

                        {dataPretty ? (
                          <details className="mt-3">
                            <summary className="cursor-pointer text-xs text-white/55 hover:text-white">View raw data</summary>
                            <pre className="mt-2 max-h-[240px] overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-white/80">
                              {dataPretty}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT */}
          <div className="grid gap-6">
            <Card title="Actions">
              <OrderAdminActions
                orderId={order.id}
                status={(order.status || "PENDING").toUpperCase()}
                trackingNo={order.trackingNo ?? ""}
                trackingUrl={order.trackingUrl ?? ""}
              />

              <div className="mt-5 border-t border-white/10 pt-5">
                <OrderEmailTools
                  orderId={order.id}
                  status={(order.status || "PENDING").toUpperCase()}
                  receiptEmail={receiptEmail}
                  fulfilmentEmail={fulfilmentEmail}
                  hasTracking={!!(trackingNo || trackingUrl)}
                />
              </div>
            </Card>

            <Card
              title="Email history"
              right={
                <div className="text-xs text-white/45">
                  {sentCount} sent • {failedCount} failed
                </div>
              }
            >
              {order.emailEvents.length === 0 ? (
                <div className="text-sm text-white/60">No emails logged for this order yet.</div>
              ) : (
                <div className="space-y-3">
                  {order.emailEvents.map((e) => {
                    const when = e.sentAt || e.createdAt;
                    const status = clean(e.status).toUpperCase();
                    const kind = emailKind(e.type);

                    const badge =
                      status === "SENT"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                        : status === "FAILED"
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                        : "border-white/15 bg-white/5 text-white/70";

                    const kindBadge =
                      kind === "receipt"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                        : kind === "fulfilment"
                        ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
                        : "border-white/15 bg-white/5 text-white/70";

                    return (
                      <div key={e.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-extrabold text-white/90">{clean(e.type) || "—"}</div>
                              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${kindBadge}`}>
                                {kind === "receipt" ? "RECEIPT" : kind === "fulfilment" ? "FULFILMENT" : "OTHER"}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-white/60 truncate">{clean(e.subject) || "—"}</div>
                          </div>
                          <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-extrabold ${badge}`}>
                            {status || "—"}
                          </span>
                        </div>

                        <div className="mt-2 space-y-1 text-xs text-white/55">
                          <div>
                            To: <span className="font-mono">{clean(e.toEmail) || "—"}</span>
                          </div>
                          <div>When: {formatDateTime(when)}</div>
                          {clean(e.providerMessageId) ? (
                            <div>
                              Provider ID: <span className="font-mono">{clean(e.providerMessageId)}</span>
                            </div>
                          ) : null}
                          {clean(e.idempotencyKey) ? (
                            <div>
                              Key: <span className="font-mono">{clean(e.idempotencyKey)}</span>
                            </div>
                          ) : null}
                        </div>

                        {clean(e.error) ? (
                          <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-rose-100">
                            <div className="font-extrabold">Error</div>
                            <div className="mt-1 break-words">{clean(e.error)}</div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}