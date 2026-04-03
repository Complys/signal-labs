// app/account/page.tsx
import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/app/_components/LogoutButton";
import AttachLastOrder from "./AttachLastOrder";

export const dynamic = "force-dynamic";

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function formatGBPFromPennies(pennies: unknown) {
  const n = typeof pennies === "number" ? pennies : Number(pennies);
  const safe = Number.isFinite(n) ? n : 0;
  return `£${(safe / 100).toFixed(2)}`;
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function maskEmail(email?: string | null) {
  const e = clean(email);
  if (!e || !e.includes("@")) return e || "—";
  const [user, domain] = e.split("@");
  const u = user || "";
  if (u.length <= 2) return `**@${domain}`;
  return `${u[0]}${"*".repeat(Math.max(2, u.length - 2))}${u[u.length - 1]}@${domain}`;
}

function titleCase(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function statusBadgeClasses(statusRaw: string) {
  const s = (statusRaw || "").toUpperCase();

  if (s === "PAID") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (s === "PROCESSING") return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  if (s === "SHIPPED") return "border-indigo-500/30 bg-indigo-500/10 text-indigo-200";
  if (s === "REFUNDED") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  if (s === "CANCELLED" || s === "FAILED")
    return "border-rose-500/30 bg-rose-500/10 text-rose-200";

  return "border-white/15 bg-white/5 text-white/80";
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

function joinAddress(parts: Array<string | null | undefined>) {
  const out = parts.map((p) => clean(p)).filter(Boolean);
  return out.length ? out.join(", ") : "—";
}

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  const email = clean((session?.user as any)?.email);

  if (!session?.user || !email) {
    redirect("/login?redirect=/account");
  }

  const user = await prisma.user.findUnique({
    where: { email },
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
  });

  // If user record missing for some reason, still let them see the page.
  const userId = user?.id ?? null;

  const orders = await prisma.order.findMany({
    where: userId
      ? { userId }
      : {
          // fallback: for safety, show orders attached to their email
          email,
        },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      orderRef: true,
      createdAt: true,
      status: true,
      amountTotal: true,
      trackingNo: true,
      trackingUrl: true,
      currency: true,
    },
  });

  const displayName =
    clean(user?.firstName) || clean(user?.lastName)
      ? [clean(user?.firstName), clean(user?.lastName)].filter(Boolean).join(" ")
      : "—";

  const addressLine = joinAddress([
    user?.addressLine1,
    user?.addressLine2,
    user?.city,
    user?.postcode,
    user?.country,
  ]);

  return (
    <main className="min-h-screen bg-[#0B0D10] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">My Account</h1>
            <p className="mt-2 text-sm text-white/55">
              Signed in as <span className="font-mono text-white/80">{maskEmail(email)}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/products"
              className="rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold hover:bg-white/10"
            >
              Products
            </Link>
            <Link
              href="/support"
              className="rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold hover:bg-white/10"
            >
              Support
            </Link>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-extrabold hover:bg-white/15">
              <LogoutButton />
            </div>
          </div>
        </div>

        {/* Attach last order helper (client component) */}
        <div className="mt-6">
          <AttachLastOrder />
        </div>

        {/* Layout */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Left */}
          <div className="grid gap-6">
            <Card title="Profile">
              <div className="space-y-3">
                <KV k="Name" v={displayName} />
                <KV k="Email" v={clean(user?.email) || email} />
                <KV k="Phone" v={clean(user?.phone) || "—"} />
                <KV k="Member since" v={user?.createdAt ? formatDate(user.createdAt) : "—"} />
              </div>
            </Card>

            <Card title="Saved delivery details" right={<span className="text-xs text-white/45">for faster checkout</span>}>
              <div className="space-y-3">
                <KV k="Address" v={addressLine} />
              </div>

              <div className="mt-4 text-xs text-white/45">
                Want to edit these? (Next step) we can add an account details form.
              </div>
            </Card>
          </div>

          {/* Right */}
          <div className="grid gap-6">
            <Card title="Recent orders" right={<span className="text-xs text-white/45">{orders.length} shown</span>}>
              {orders.length === 0 ? (
                <div className="text-sm text-white/60">No orders yet.</div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <div className="grid grid-cols-[140px_1fr_140px_140px] gap-3 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/55">
                    <div>Date</div>
                    <div>Order</div>
                    <div className="text-right">Total</div>
                    <div className="text-right">Status</div>
                  </div>

                  <div className="divide-y divide-white/10">
                    {orders.map((o) => {
                      const status = clean(o.status).toUpperCase();
                      return (
                        <div key={o.id} className="grid grid-cols-[140px_1fr_140px_140px] gap-3 px-4 py-4">
                          <div className="text-sm text-white/70">{formatDate(o.createdAt)}</div>

                          <div className="min-w-0">
                            <div className="truncate text-sm font-extrabold text-white/90">
                              {o.orderRef || o.id}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-white/55">
                              {o.trackingUrl ? (
                                <a
                                  href={o.trackingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline hover:text-white"
                                >
                                  Track parcel
                                </a>
                              ) : o.trackingNo ? (
                                <span className="font-mono">Tracking: {o.trackingNo}</span>
                              ) : (
                                <span>Tracking: —</span>
                              )}

                              {/* Optional: show a customer-friendly status */}
                              {status === "PAID" ? <span>• Preparing</span> : null}
                              {status === "PROCESSING" ? <span>• Packing</span> : null}
                              {status === "SHIPPED" ? <span>• Dispatched</span> : null}
                            </div>
                          </div>

                          <div className="text-right text-sm font-extrabold">
                            {formatGBPFromPennies(o.amountTotal)}
                          </div>

                          <div className="text-right">
                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-extrabold ${statusBadgeClasses(
                                o.status || ""
                              )}`}
                            >
                              {clean(o.status).toUpperCase() || "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-4 text-xs text-white/45">
                Need an “Order detail” page for customers next? We can add <span className="font-mono">/account/orders/[id]</span>.
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}