"use client";

import Link from "next/link";
import FreeDeliveryUpsell from "@/app/_components/FreeDeliveryUpsell";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/app/_components/CartProvider";

type ShippingDTO = {
  enabled: boolean;
  freeOverPennies: number;
  flatRatePennies: number;
  currency?: string;
};

function gbp(pennies: number) {
  const safe = Number.isFinite(pennies) ? pennies : 0;
  return `£${(safe / 100).toFixed(2)}`;
}

function clampInt(n: unknown, min: number, max: number) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.trunc(v)));
}

export default function CheckoutPage() {
  const cart = useCart();

  // ✅ Compute subtotal from cart items (source of truth for UI)
  const subtotalPennies = useMemo(() => {
    const items = (cart as any)?.items ?? {};
    return Object.values(items).reduce((sum: number, it: any) => {
      const unit = clampInt(it?.unitPricePennies, 0, 10_000_000);
      const qty = clampInt(it?.qty, 0, 9999);
      return sum + unit * qty;
    }, 0);
  }, [cart]);

  // ✅ Load shipping settings for messaging + live delivery estimate
  const [ship, setShip] = useState<ShippingDTO | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/shipping", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as ShippingDTO;
        if (cancelled) return;

        setShip({
          enabled: Boolean(json.enabled),
          freeOverPennies: clampInt(json.freeOverPennies, 0, 10_000_000),
          flatRatePennies: clampInt(json.flatRatePennies, 0, 10_000_000),
          currency: json.currency ?? "GBP",
        });
      } catch {
        // silent fail — checkout still works
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const deliveryPennies = useMemo(() => {
    if (!ship?.enabled) return 0;
    const threshold = ship.freeOverPennies ?? 0;
    if (threshold <= 0) return ship.flatRatePennies ?? 0;
    return subtotalPennies >= threshold ? 0 : ship.flatRatePennies ?? 0;
  }, [ship, subtotalPennies]);

  const totalPennies = subtotalPennies + deliveryPennies;

  const remainingForFree = useMemo(() => {
    if (!ship?.enabled) return 0;
    const threshold = ship.freeOverPennies ?? 0;
    if (threshold <= 0) return 0;
    return Math.max(0, threshold - subtotalPennies);
  }, [ship, subtotalPennies]);

  return (
    <main className="min-h-screen bg-[#F6F8FB] p-8 text-[#0B1220]">
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1fr_360px]">
        {/* Left: content */}
        <section className="rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-2xl font-semibold">Checkout</h1>
          <p className="mb-6 text-sm text-black/60">
            Enter your details and review your order.
          </p>

          {/* Replace with your actual checkout form */}
          <div className="rounded-2xl border border-black/10 bg-[#F6F8FB] p-4 text-sm text-black/70">
            Checkout form goes here.
          </div>

          <div className="mt-6">
            <Link href="/cart" className="text-sm font-semibold underline">
              Back to cart
            </Link>
          </div>
        </section>

        {/* Right: order summary */}
        <aside className="h-fit rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Order summary</h2>

          {/* Shipping message */}
          {ship?.enabled ? (
            <div className="mt-3 rounded-2xl border border-black/10 bg-[#F6F8FB] p-3 text-[12px] text-black/70">
              Delivery is <span className="font-semibold">{gbp(ship.flatRatePennies)}</span> — free
              over <span className="font-semibold">{gbp(ship.freeOverPennies)}</span>
              {remainingForFree > 0 ? (
                <>
                  {" "}
                  • Spend <span className="font-extrabold">{gbp(remainingForFree)}</span> more to
                  unlock free delivery.
                </>
              ) : (
                <> • <span className="font-extrabold">Free delivery unlocked ✅</span></>
              )}
            </div>
          ) : null}

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-black/60">Subtotal</span>
              <span className="font-semibold">{gbp(subtotalPennies)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-black/60">Delivery</span>
              <span className="font-semibold">{gbp(deliveryPennies)}</span>
            </div>

            <div className="my-3 h-px bg-black/10" />

            <div className="flex items-center justify-between">
              <span className="text-black/60">Total</span>
              <span className="text-base font-extrabold">{gbp(totalPennies)}</span>
            </div>
          </div>

          {/* ✅ Suggestions / quick-add to reach free shipping */}
          <FreeDeliveryUpsell subtotalPennies={subtotalPennies} limit={4} onAdd={() => {}} />

          <button
  type="button"
  onClick={async () => {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), // your API will read cart server-side or accept items here
    });
    const json = await res.json();
    if (json?.url) window.location.href = json.url;
  }}
  className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-black px-6 text-sm font-semibold text-white hover:opacity-95"
>
  Checkout
</button>

          <Link
            href="/products"
            className="mt-3 inline-flex w-full items-center justify-center text-sm font-semibold underline"
          >
            Continue shopping
          </Link>
        </aside>
      </div>
    </main>
  );
}