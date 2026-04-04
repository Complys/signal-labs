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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedVariant = hasVariants ? variants[selectedIndex] : null;

  // Per-variant stock
  const effectiveStock = hasVariants && selectedVariant && typeof (selectedVariant as any).stock === "number"
    ? (selectedVariant as any).stock
    : product.stock;
  const effectiveIsBackOrder = effectiveStock <= 0;

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
    <div className={cardCls}>
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
          {effectiveIsBackOrder && (
            <div className="absolute bottom-3 left-3 z-20 rounded-full bg-black px-3 py-1 text-[11px] font-semibold text-white">
              Back order
            </div>
          )}
          {isAdmin && !product.isActive && (
            <div className="absolute bottom-3 right-3 z-20 rounded-full bg-red-600 px-3 py-1 text-[11px] font-semibold text-white">
              Inactive
            </div>
          )}
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
            {variants.map((v, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedIndex(i)}
                className={[
                  "rounded-full border px-2.5 py-1 text-xs font-semibold transition",
                  selectedIndex === i
                    ? "border-black bg-black text-white"
                    : "border-black/20 bg-white text-black hover:border-black/50",
                ].join(" ")}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        {/* Price */}
        <div className="mt-2">
          {hasVariants ? (
            <div className="text-sm font-semibold">
              {selectedVariant ? fmt(selectedVariant.pricePennies) : `From ${fmt(fromPrice)}`}
              {!selectedVariant && (
                <span className="text-xs text-black/50 font-normal ml-1">— select size</span>
              )}
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
            dealId={!hasVariants ? dealId : null}
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
          <div className="mt-3">
            <StockNotifyButton productId={product.id} />
          </div>
        )}
      </div>
    </div>
  );
}
