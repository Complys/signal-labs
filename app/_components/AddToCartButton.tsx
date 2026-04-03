// app/_components/AddToCartButton.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useCart } from "@/app/_components/CartProvider";

type Props = {
  productId: string;
  dealId?: string | null;
  name: string;
  unitPricePennies: number;
  image?: string | null;

  qty?: number;
  disabled?: boolean;
  className?: string;
  label?: string;

  maxQty?: number; // silent cap (stock)
};

function clampQty(qty: unknown, maxQty?: number) {
  const n = typeof qty === "number" ? qty : Number(qty);
  const base = Number.isFinite(n) ? Math.max(1, Math.trunc(n)) : 1;

  const cap =
    typeof maxQty === "number" && Number.isFinite(maxQty) && maxQty > 0
      ? Math.min(999, Math.trunc(maxQty))
      : 999;

  return Math.min(base, cap);
}

export default function AddToCartButton({
  productId,
  dealId = null,
  name,
  unitPricePennies,
  image = null,
  qty = 1,
  disabled = false,
  className = "",
  label = "Add to cart",
  maxQty,
}: Props) {
  const cart = useCart() as any; // compatibility
  const [loading, setLoading] = useState(false);

  const safeQty = useMemo(() => clampQty(qty, maxQty), [qty, maxQty]);

  function stopLinkHijack(e: React.SyntheticEvent) {
    // ✅ If this button sits inside a <Link>/<a> card, block navigation.
    e.preventDefault();
    e.stopPropagation();
  }

  function handleAdd() {
    if (!cart) throw new Error("CartProvider missing (useCart() returned null)");

    if (typeof cart.addItem === "function") {
      cart.addItem(
        { productId, qty: safeQty, dealId, name, unitPricePennies, image },
        maxQty
      );
      return;
    }

    if (typeof cart.add === "function") {
      cart.add(productId, safeQty);
      return;
    }

    throw new Error("CartProvider is missing add/addItem");
  }

  function onClick(e: React.MouseEvent<HTMLButtonElement>) {
    stopLinkHijack(e);
    if (disabled || loading) return;

    setLoading(true);
    try {
      // dev breadcrumb (safe to keep; remove later if you want)
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.log("[AddToCartButton] add", {
          productId,
          dealId,
          safeQty,
          hasAddItem: typeof cart?.addItem === "function",
          hasAdd: typeof cart?.add === "function",
        });
      }

      handleAdd();
    } catch (err: any) {
      alert(err?.message || "Could not add to cart");
    } finally {
      // small delay makes the loading state visible and avoids double clicks
      window.setTimeout(() => setLoading(false), 250);
    }
  }

  return (
    <button
      type="button"
      // ✅ This helps even when parent is an anchor overlay
      onPointerDown={stopLinkHijack}
      onClick={onClick}
      disabled={disabled || loading}
      className={
        className ||
        "h-10 w-full rounded-full border border-black/15 bg-white px-4 text-sm font-semibold hover:bg-black/5 disabled:opacity-50"
      }
    >
      {loading ? "..." : label}
    </button>
  );
}