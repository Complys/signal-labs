"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import DealCountdown from "@/app/_components/DealCountdown";
import ProductsPurchaseActions from "@/app/_components/ProductsPurchaseActions";
import MultiBuyBanner from "@/app/_components/MultiBuyBanner";
import VariantSelector, { type ProductVariant } from "@/app/_components/VariantSelector";

function formatGBPFromPennies(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return `£${(safe / 100).toFixed(2)}`;
}

type Props = {
  product: {
    id: string;
    name: string;
    description: string | null;
    image: string | null;
    isActive: boolean;
  };
  stock: number;
  isBackOrder: boolean;
  basePennies: number;
  dealPennies: number | null;
  dealId: string | null;
  dealEndsAt: string | null;
  reduced: boolean;
  pct: number;
  variants: ProductVariant[];
};

export default function ProductPageClient({
  product,
  stock,
  isBackOrder,
  basePennies,
  dealPennies,
  dealId,
  dealEndsAt,
  reduced,
  pct,
  variants,
}: Props) {
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);

  const hasVariants = variants.length > 0;
  const selectedVariant = hasVariants ? variants[selectedVariantIndex] : null;

  // Use per-variant stock if available, otherwise fall back to product stock
  const effectiveStock = hasVariants && selectedVariant && typeof (selectedVariant as any).stock === "number"
    ? (selectedVariant as any).stock
    : stock;
  const effectiveIsBackOrder = effectiveStock <= 0;

  const effectiveBasePennies = selectedVariant ? selectedVariant.pricePennies : basePennies;
  const effectiveDealPennies = !hasVariants && reduced && dealPennies ? dealPennies : null;
  const maxQty = effectiveStock > 0 ? effectiveStock : 999;
  const showReduced = !!effectiveDealPennies;
  const displayPricePennies = effectiveDealPennies ?? effectiveBasePennies;

  // Image: use variant image if set, otherwise fall back to product image
  const displayImage =
    (selectedVariant?.image) || product.image || null;

  return (
    <main className="min-h-screen bg-[#F6F8FB] px-6 py-10 text-[#0B1220]">
      <div className="mx-auto max-w-6xl">
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/products" className="text-sm text-black/60 hover:text-black">
            ← Back to products
          </Link>

          <div className="flex items-center gap-2">
            {product.isActive === false ? (
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-100">
                Inactive
              </span>
            ) : null}
            {showReduced ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
                On sale {pct > 0 ? `(-${pct}%)` : ""}
              </span>
            ) : null}
            <span
              className={[
                "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset",
                effectiveIsBackOrder
                  ? "bg-rose-50 text-rose-700 ring-rose-100"
                  : "bg-emerald-50 text-emerald-700 ring-emerald-100",
              ].join(" ")}
            >
              {effectiveIsBackOrder ? "Out of stock — back order available" : "In stock"}
            </span>
          </div>
        </div>

        {/* Layout */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Image card */}
          <div className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
            <div className="relative aspect-[4/3] w-full bg-[#F6F8FB]">
              {displayImage ? (
                <Image
                  key={displayImage}
                  src={displayImage}
                  alt={product.name}
                  fill
                  priority
                  className="object-cover transition-opacity duration-200"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-sm text-black/40">
                  No image
                </div>
              )}
            </div>
          </div>

          {/* Info card */}
          <div className="rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
            <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>

            {/* Variant selector */}
            {hasVariants && (
              <VariantSelector
                variants={variants}
                selectedIndex={selectedVariantIndex}
                onChange={setSelectedVariantIndex}
              />
            )}

            {/* Price */}
            <div className="mt-4">
              <p className="text-sm text-black/60">Price</p>
              {showReduced && effectiveDealPennies ? (
                <div className="mt-1 flex items-end gap-3">
                  <p className="text-3xl font-semibold text-black">
                    {formatGBPFromPennies(effectiveDealPennies)}
                  </p>
                  <p className="pb-1 text-sm text-black/45 line-through">
                    {formatGBPFromPennies(effectiveBasePennies)}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-3xl font-semibold">
                  {formatGBPFromPennies(displayPricePennies)}
                </p>
              )}
              <p className="mt-1 text-xs text-emerald-700 font-semibold">
                With offer: {formatGBPFromPennies(Math.round(displayPricePennies * 0.7))}
              </p>
              {dealEndsAt ? (
                <div className="mt-2">
                  <DealCountdown endsAtIso={dealEndsAt} className="text-xs text-black/60" />
                </div>
              ) : null}
            </div>

            {/* Description */}
            {product.description ? (
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-black/70">
                {product.description.split("\n\n").map((block, i) => {
                  // Detect molecular/technical data blocks (lines with colons)
                  const lines = block.split("\n");
                  const isTechnical = lines.filter(l => l.includes(":")).length >= 2;
                  if (isTechnical) {
                    return (
                      <div key={i} className="rounded-xl border border-black/10 bg-[#F6F8FB] p-3">
                        {lines.map((line, j) => {
                          const colonIdx = line.indexOf(":");
                          if (colonIdx > 0 && colonIdx < 30) {
                            const label = line.slice(0, colonIdx).trim();
                            const value = line.slice(colonIdx + 1).trim();
                            return (
                              <div key={j} className="flex gap-2 py-0.5 text-xs">
                                <span className="font-semibold text-black/60 shrink-0 w-32">{label}</span>
                                <span className="text-black/80">{value}</span>
                              </div>
                            );
                          }
                          return <p key={j} className="text-xs text-black/60">{line}</p>;
                        })}
                      </div>
                    );
                  }
                  return <p key={i} className="whitespace-pre-line">{block}</p>;
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-black/60">
                Research-use product supplied for laboratory and analytical purposes only.
              </p>
            )}

            {/* CTA */}
            <div className="mt-6">
              <ProductsPurchaseActions
                productId={String(product.id)}
                dealId={!hasVariants ? dealId : null}
                isBackOrder={product.isActive === false ? true : effectiveIsBackOrder}
                maxQty={maxQty}
                stock={effectiveStock}
                name={hasVariants && selectedVariant ? `${product.name} — ${selectedVariant.label}` : product.name}
                unitPricePennies={displayPricePennies}
                image={displayImage}
              />
            </div>

            {/* Multi-buy discounts */}
            <div className="mt-5">
              <MultiBuyBanner />
            </div>

            {/* Compliance */}
            <div className="mt-4 rounded-2xl border border-black/10 bg-[#F6F8FB] p-4 text-xs text-black/55">
              Research-use only. Not for human or veterinary consumption. Not intended to diagnose,
              treat, cure, or prevent any disease.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
