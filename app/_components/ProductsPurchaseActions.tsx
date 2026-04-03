// web/app/_components/ProductsPurchaseActions.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import BuyNowButton from "@/app/_components/BuyNowButton";
import AddToCartButton from "@/app/_components/AddToCartButton";

type Props = {
  productId: string;
  dealId?: string | null;

  isBackOrder: boolean;
  disabled?: boolean;
  maxQty?: number;

  name: string;
  unitPricePennies: number;
  image?: string | null;
  stock?: number;
};

function toInt(x: unknown) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

function clampQty(v: unknown, cap: number) {
  const n = toInt(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(cap, n));
}

export default function ProductsPurchaseActions({
  productId,
  dealId = null,
  isBackOrder,
  disabled = false,
  maxQty,
  name,
  unitPricePennies,
  image = null,
  stock,
}: Props) {
  const cap = useMemo(() => {
    if (isBackOrder) return 999;
    const m = toInt(maxQty);
    if (Number.isFinite(m) && m > 0) return Math.min(999, m);
    return 999;
  }, [isBackOrder, maxQty]);

  const [raw, setRaw] = useState("1");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (raw === "") return;
    const next = String(clampQty(raw, cap));
    if (next !== raw) setRaw(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cap]);

  const qty = useMemo(() => (raw === "" ? 1 : clampQty(raw, cap)), [raw, cap]);

  function commit() {
    setRaw(String(qty));
  }

  function dec() {
    setRaw(String(clampQty(qty - 1, cap)));
  }

  function inc() {
    setRaw(String(clampQty(qty + 1, cap)));
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (v === "") return setRaw("");
    if (!/^\d+$/.test(v)) return;
    setRaw(v);
  }

  function blurIfTyping() {
    if (document.activeElement === inputRef.current) inputRef.current?.blur();
  }

  const buyLabel = disabled ? "Unavailable" : isBackOrder ? "Back order" : "Buy";

  const stockNum = typeof stock === "number" ? stock : null;
  const showLowStock = stockNum !== null && stockNum > 0 && qty > stockNum;

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        {/* Qty */}
        <div className="flex h-10 items-center overflow-hidden rounded-full border border-black/15 bg-white">
          <button
            type="button"
            onClick={() => {
              blurIfTyping();
              dec();
            }}
            disabled={disabled || qty <= 1}
            className="h-10 w-10 text-black text-lg leading-none hover:bg-black/5 disabled:opacity-40"
            aria-label="Decrease quantity"
          >
            −
          </button>

          <input
            ref={inputRef}
            inputMode="numeric"
            pattern="[0-9]*"
            value={raw}
            onChange={onChange}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
            }}
            disabled={disabled}
            className="h-10 w-16 bg-transparent text-center text-sm text-black outline-none"
            aria-label="Quantity"
          />

          <button
            type="button"
            onClick={() => {
              blurIfTyping();
              inc();
            }}
            disabled={disabled || qty >= cap}
            className="h-10 w-10 text-black text-lg leading-none hover:bg-black/5 disabled:opacity-40"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        {/* Buy */}
        <div className="flex-1">
          <BuyNowButton
            productId={productId}
            dealId={dealId}
            qty={qty}
            maxQty={cap}
            name={name}
            unitPricePennies={unitPricePennies}
            disabled={disabled}
            label={buyLabel}
            className="h-10 w-full rounded-full bg-black px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Low stock warning */}
      {showLowStock && stockNum !== null ? (
        <p className="mt-2 text-xs font-semibold text-amber-700">
          Only {stockNum} in stock — your order will be adjusted at checkout.
        </p>
      ) : null}

      {/* Add to cart */}
      <div className="mt-3">
        <AddToCartButton
          productId={productId}
          dealId={dealId}
          name={name}
          unitPricePennies={unitPricePennies}
          image={image}
          qty={qty}
          maxQty={cap}
          disabled={disabled}
          label="Add to cart"
          className="h-10 w-full rounded-full border border-black/15 bg-white px-4 text-sm font-semibold transition hover:bg-black/5 disabled:opacity-50"
        />
      </div>

      {isBackOrder ? (
        <p className="mt-2 text-[11px] text-black/55">
          Back order — dispatched as soon as stock arrives.
        </p>
      ) : null}
    </div>
  );
}