// app/success/page.tsx
"use client";
import { Suspense } from "react";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const CART_KEY = "signal_cart_v1";
const LAST_SESSION_KEY = "signal_last_checkout_session_id";

type OrderLite = {
  stripeSessionId: string;
  email?: string | null;
  amountTotal?: number | null; // pennies
  currency?: string | null;
  status?: string | null;
  createdAt?: string | null;
  receiptUrl?: string | null;
};

function formatGBPFromPennies(pennies?: number | null) {
  const safe = Number.isFinite(Number(pennies)) ? Number(pennies) : 0;
  return `£${(safe / 100).toFixed(2)}`;
}

function shortRef(sessionId: string) {
  if (!sessionId) return "";
  const clean = sessionId.replace(/[^a-zA-Z0-9_]/g, "");
  return clean.length > 16 ? `${clean.slice(0, 8)}…${clean.slice(-6)}` : clean;
}

function SuccessPageInner() {
  const sp = useSearchParams();
  const sessionId = (sp.get("session_id") || "").trim();

  const [order, setOrder] = useState<OrderLite | null>(null);
  const [loading, setLoading] = useState(false);
  const [logoOk, setLogoOk] = useState(true);

  // ✅ Clear cart once page loads
  useEffect(() => {
    try {
      localStorage.removeItem(CART_KEY);
      window.dispatchEvent(new Event("cart:updated"));
    } catch {}
  }, []);

  // ✅ Persist session_id (we’ll use this to attach guest orders to an account later)
  useEffect(() => {
    if (!sessionId) return;
    try {
      localStorage.setItem(LAST_SESSION_KEY, sessionId);
    } catch {}
  }, [sessionId]);

  // ✅ (Optional) fetch basic order info
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/orders/lookup?session_id=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as OrderLite;
        if (!cancelled) setOrder(data);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const createAccountHref = useMemo(() => {
    const redirect = encodeURIComponent("/account");
    const sid = sessionId ? encodeURIComponent(sessionId) : "";
    return sessionId
      ? `/login?redirect=${redirect}&session_id=${sid}`
      : `/login?redirect=${redirect}`;
  }, [sessionId]);

  const showSummary = !!sessionId;

  return (
    <main className="min-h-screen bg-[#F6F8FB] text-[#0B1220] px-6 py-10">
      <div className="mx-auto max-w-4xl">
        {/* Logo (no giant blank box) */}
        <div className="flex justify-center">
          {logoOk ? (
            <div className="relative w-full max-w-md h-[72px]">
              <Image
                src="/signal-logo.png" // keep your existing file
                alt="Signal Laboratories"
                fill
                priority
                sizes="(max-width: 768px) 90vw, 420px"
                className="object-contain"
                onError={() => setLogoOk(false)}
              />
            </div>
          ) : (
            <div className="text-sm font-semibold text-black/70">
              Signal Laboratories
            </div>
          )}
        </div>

        {/* Success header card */}
        <div className="mt-8 rounded-3xl border border-black/10 bg-white p-8 shadow-sm sm:p-10">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <span className="text-2xl leading-none">✔</span>
            </div>

            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                Payment successful
              </h1>
              <p className="mt-2 text-sm sm:text-base text-black/60">
                Thanks — your order has been received and is now being processed.
              </p>

              {sessionId ? (
                <p className="mt-2 text-xs text-black/45">
                  Order reference:{" "}
                  <span className="font-mono text-black/70">{shortRef(sessionId)}</span>
                </p>
              ) : null}
            </div>

            {order?.receiptUrl ? (
              <a
                href={order.receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-[#F6F8FB]"
              >
                View receipt
              </a>
            ) : null}
          </div>

          {/* Primary actions */}
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white hover:bg-black/90"
            >
              Continue shopping
            </Link>

            <Link
              href="/cart"
              className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-[#0B1220] hover:bg-[#F6F8FB]"
            >
              View cart
            </Link>

            {order?.receiptUrl ? (
              <a
                href={order.receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="sm:hidden inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold hover:bg-[#F6F8FB]"
              >
                View receipt
              </a>
            ) : null}
          </div>
        </div>

        {/* Account / rewards card */}
        <div className="mt-6 rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight">
            Create an account to track orders
          </h2>
          <p className="mt-2 text-sm text-black/60">
            Guest checkout is fast — but an account lets you view order history, save details, and manage support.
          </p>

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <Link
              href={createAccountHref}
              className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white hover:opacity-95"
              style={{ backgroundColor: "#0074D4" }}
            >
              Create account / Login
            </Link>

            <Link
              href="/account"
              className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold hover:bg-[#F6F8FB]"
            >
              Go to My Account
            </Link>
          </div>

          <p className="mt-3 text-xs text-black/50">
            Tip: use the same email you used at checkout — we’ll attach this guest order to your account.
          </p>
        </div>

        {/* What happens next */}
        <div className="mt-6 rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight">What happens next?</h2>

          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-black/10 bg-[#F6F8FB] p-4">
              <div className="text-sm font-semibold">📧 Email confirmation</div>
              <p className="mt-1 text-sm text-black/60">
                Stripe will email your receipt to the address used at checkout.
              </p>
            </div>

            <div className="rounded-2xl border border-black/10 bg-[#F6F8FB] p-4">
              <div className="text-sm font-semibold">🔬 Research use only</div>
              <p className="mt-1 text-sm text-black/60">
                All products are supplied strictly for R&amp;D use only. Not for human or veterinary consumption.
              </p>
            </div>

            <div className="rounded-2xl border border-black/10 bg-[#F6F8FB] p-4">
              <div className="text-sm font-semibold">🧾 Need support?</div>
              <p className="mt-1 text-sm text-black/60">
                If you don’t receive an email, check spam/junk or contact support.
              </p>
              <Link
                href="/support"
                className="mt-3 inline-flex text-sm font-semibold text-[#0074D4] hover:underline"
              >
                Contact support →
              </Link>
            </div>
          </div>

          {/* Optional order summary */}
          {showSummary ? (
            <div className="mt-6 rounded-2xl border border-black/10 bg-white p-4">
              <div className="text-sm font-semibold">Order summary</div>

              {loading ? (
                <p className="mt-2 text-sm text-black/60">Loading…</p>
              ) : order ? (
                <div className="mt-3 grid gap-1 text-sm text-black/70">
                  <div>
                    Status:{" "}
                    <span className="font-semibold text-black">
                      {order.status || "PAID"}
                    </span>
                  </div>
                  <div>
                    Total:{" "}
                    <span className="font-semibold text-black">
                      {formatGBPFromPennies(order.amountTotal)}
                    </span>
                  </div>
                  <div>
                    Email:{" "}
                    <span className="font-semibold text-black">
                      {order.email || "—"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-black/60">
                  (Optional) If you want totals + email here, keep the lookup API enabled.
                </p>
              )}
            </div>
          ) : null}

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Link
              href="/research-use-policy"
              className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold hover:bg-[#F6F8FB]"
            >
              Research use policy
            </Link>

            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white hover:bg-black/90"
            >
              Back to products
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-black/45">
          If you need help, contact support and include the receipt email or your order reference.
        </p>
      </div>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessPageInner />
    </Suspense>
  );
}
