"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import ProductsPurchaseActions from "@/app/_components/ProductsPurchaseActions";
import DealCountdown from "@/app/_components/DealCountdown";
import StockNotifyButton from "@/app/_components/StockNotifyButton";

type Variant = { label: string; pricePennies: number; image?: string };

type Props = {
  product: {
    id: string;
    name: string;
    image?: string | null;
    stock: number;
    isActive: boolean;
    variantsJson?: string | null;
    allDeals?: Array<any>;
  };
  basePennies: number;
  dealId: string | null;
  dealEndsAt: string | null;
  reduced: boolean;
  dealPennies: number | null;
  pct: number;
  isAdmin: boolean;
  isBackOrder: boolean;
  disabled: boolean;
  maxQty: number;
};

function fmt(p: number) { return `£${(p / 100).toFixed(2)}`; }

export default function ProductCard({
  product, basePennies, dealId, dealEndsAt, reduced, dealPennies, pct,
  isAdmin, isBackOrder, disabled, maxQty,
}: Props) {
  // Parse variants
  let variants: Variant[] = [];
  try {
    if (product.variantsJson) {
      const parsed = JSON.parse(product.variantsJson);
      if (Array.isArray(parsed) && parsed.length > 0) variants = parsed;
    }
  } catch {}

  const hasVariants = variants.length > 0;
  // Default to first in-stock variant, fall back to 0
  const defaultIndex = variants.findIndex(
    (v) => typeof (v as any).stock !== "number" || (v as any).stock > 0
  );
  const [selectedIndex, setSelectedIndex] = useState(defaultIndex >= 0 ? defaultIndex : 0);
  const selectedVariant = hasVariants ? variants[selectedIndex] : null;

  // Per-variant stock
  const effectiveStock = hasVariants && selectedVariant && typeof (selectedVariant as any).stock === "number"
    ? (selectedVariant as any).stock
    : product.stock;
  const effectiveIsBackOrder = effectiveStock <= 0;

  // Only show back order badge on image if ALL variants are out of stock
  const allOutOfStock = hasVariants
    ? variants.every((v) => typeof (v as any).stock === "number" && (v as any).stock <= 0)
    : isBackOrder;

  // Effective price
  const effectiveBasePennies = selectedVariant ? selectedVariant.pricePennies : basePennies;
  const effectiveDealPennies = !hasVariants && reduced && dealPennies ? dealPennies : null;
  const displayPrice = effectiveDealPennies ?? effectiveBasePennies;
  const fromPrice = hasVariants ? Math.min(...variants.map(v => v.pricePennies)) : basePennies;

  // Effective image
  const displayImage = selectedVariant?.image || product.image || null;

  const cardCls = [
    "group overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md",
    reduced ? "border-2 border-green-500/60" : "border border-black/10",
    isAdmin && !product.isActive ? "opacity-70" : "",
  ].join(" ");

  return (
    <div className={cardCls} style={{isolation: "isolate"}}>
      {/* Clickable image */}
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative aspect-square w-full bg-black/[0.03]">
          {reduced && (
            <div className="absolute right-3 top-3 z-20 rounded-full bg-green-600 px-3 py-1 text-[11px] font-extrabold text-white shadow">
              On Sale
            </div>
          )}
          {reduced && pct > 0 && (
            <div className="absolute left-3 top-3 z-20 rounded-full bg-green-600 px-4 py-2 text-[12px] font-extrabold text-white shadow">
              -{pct}%
            </div>
          )}
          {allOutOfStock && (
            <div className="absolute bottom-3 left-3 z-20 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-semibold text-white">
              Back order
            </div>
          )}
          {isAdmin && !product.isActive && (
            <div className="absolute bottom-3 right-3 z-20 rounded-full bg-red-600 px-3 py-1 text-[11px] font-semibold text-white">
              Inactive
            </div>
          )}

          {/* Offer price badge — top right corner */}
          <div className="absolute top-0 right-0 z-[1] bg-emerald-600 text-white rounded-bl-2xl px-3 py-2 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wide leading-none">With offer</div>
            <div className="text-sm font-extrabold leading-tight mt-0.5">
              {hasVariants
                ? (selectedVariant ? fmt(Math.round(selectedVariant.pricePennies * 0.7)) : `From ${fmt(Math.round(fromPrice * 0.7))}`)
                : fmt(Math.round((effectiveDealPennies ?? basePennies) * 0.7))
              }
            </div>
          </div>
          {displayImage ? (
            <Image
              key={displayImage}
              src={displayImage}
              alt={product.name}
              fill
              sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
              className="object-cover transition-opacity duration-200"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-black/45">
              No Image
            </div>
          )}
        </div>
      </Link>

      <div className="p-3 sm:p-4">
        {/* Clickable name */}
        <Link href={`/products/${product.id}`} className="block">
          <div className="line-clamp-2 text-sm font-medium leading-snug hover:underline">
            {product.name}
          </div>
        </Link>

        {/* Variant pills */}
        {hasVariants && (
          <div className="mt-2 flex flex-wrap gap-1">
            {variants.map((v, i) => {
          const oos = typeof (v as any).stock === "number" && (v as any).stock <= 0;
          const sel = selectedIndex === i;
          let cls = "rounded-full border px-2.5 py-1 text-xs font-semibold transition ";
          if (sel && oos) cls += "border-rose-500 bg-rose-500 text-white";
          else if (sel) cls += "border-black bg-black text-white";
          else if (oos) cls += "border-black/15 bg-white text-black/35 hover:border-rose-300";
          else cls += "border-black/20 bg-white text-black hover:border-black/50";
          return (
          <button
                key={i}
                type="button"
                onClick={() => setSelectedIndex(i)}
                className={cls}
              >
                {oos ? <span className="line-through">{v.label}</span> : v.label}
              </button>
          );
        })}
          </div>
        )}

        {/* Price */}
        <div className="mt-2">
          {hasVariants && showReduced && effectiveDealPennies ? (
            <div className="leading-tight">
              <div className="text-sm font-extrabold text-black">
                {fmt(effectiveDealPennies)}
              </div>
              <div className="text-[11px] text-black/50 line-through">{fmt(effectiveBasePennies)}</div>
              <div className="text-[11px] font-bold text-green-600">-{effectivePct}% off</div>
            </div>
          ) : hasVariants ? (
            <div className="text-sm font-semibold">
              {selectedVariant ? fmt(selectedVariant.pricePennies) : `From ${fmt(fromPrice)}`}
            </div>
          ) : reduced && effectiveDealPennies ? (
            <div className="leading-tight">
              <div className="text-sm font-extrabold text-black sm:text-base">
                {fmt(effectiveDealPennies)}
              </div>
              <div className="text-[11px] text-black/50 line-through">{fmt(basePennies)}</div>
            </div>
          ) : (
            <div className="text-sm font-semibold">{fmt(basePennies)}</div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-3">
          <ProductsPurchaseActions
            productId={product.id}
            dealId={effectiveDealId ?? null}
            isBackOrder={isBackOrder}
            disabled={disabled}
            maxQty={maxQty}
            stock={product.stock}
            name={hasVariants && selectedVariant ? `${product.name} — ${selectedVariant.label}` : product.name}
            unitPricePennies={displayPrice}
            image={displayImage}
          />
        </div>

        {dealEndsAt && (
          <div className="mt-2">
            <DealCountdown endsAtIso={dealEndsAt} className="text-[11px] text-black/60" />
          </div>
        )}

        {effectiveIsBackOrder && !isAdmin && (
          <p className="mt-1.5 text-[11px] text-amber-700 font-medium">
            This size — back order, est. 10–15 days.
          </p>
        )}
      </div>
    </div>
  );
}
