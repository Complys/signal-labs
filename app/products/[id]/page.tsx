// app/products/[id]/page.tsx
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

import DealCountdown from "@/app/_components/DealCountdown";
import ProductsPurchaseActions from "@/app/_components/ProductsPurchaseActions";

function formatGBPFromPennies(value: unknown) {
  const pennies = typeof value === "number" ? value : Number(value);
  const safe = Number.isFinite(pennies) ? pennies : 0;
  return `£${(safe / 100).toFixed(2)}`;
}

function pctOffPennies(basePennies: number, specialPennies: number) {
  if (!Number.isFinite(basePennies) || basePennies <= 0) return 0;
  if (!Number.isFinite(specialPennies) || specialPennies <= 0) return 0;
  if (specialPennies >= basePennies) return 0;
  return Math.round(((basePennies - specialPennies) / basePennies) * 100);
}

function NotFoundCard({ subtitle }: { subtitle?: string }) {
  return (
    <main className="min-h-screen bg-[#F6F8FB] px-6 py-10 text-[#0B1220]">
      <div className="mx-auto max-w-3xl rounded-3xl border border-black/10 bg-white p-10 shadow-sm">
        <h1 className="text-2xl font-semibold">Product not found</h1>
        {subtitle ? <p className="mt-2 text-sm text-black/60">{subtitle}</p> : null}
        <Link
          href="/products"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-black/90"
        >
          Back to products
        </Link>
      </div>
    </main>
  );
}

export default async function ProductPage(props: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const params = await Promise.resolve(props.params);
  const id = String((params as any)?.id ?? "").trim();

  if (!id) return <NotFoundCard subtitle="Missing product id in the URL." />;

  const now = new Date();

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      deals: {
        where: {
          isActive: true,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
        orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { id: true, specialPrice: true, endsAt: true },
      },
    },
  });

  if (!product) {
    return <NotFoundCard subtitle="This product doesn’t exist (or may have been removed)." />;
  }

  const stock = typeof product.stock === "number" ? product.stock : 0;
  const isBackOrder = stock <= 0;

  // Weekly special / active deal (if any)
  const activeDeal = product.deals?.[0] ?? null;

  const basePennies = typeof product.price === "number" ? product.price : Number(product.price) || 0;
  const dealPennies = typeof activeDeal?.specialPrice === "number" ? activeDeal.specialPrice : null;

  const reduced =
    typeof dealPennies === "number" &&
    Number.isFinite(dealPennies) &&
    dealPennies > 0 &&
    dealPennies < basePennies;

  const pct = reduced && dealPennies ? pctOffPennies(basePennies, dealPennies) : 0;

  const unitPricePennies = reduced && dealPennies ? dealPennies : basePennies;

  // Cap qty if stock is positive, otherwise allow larger for backorder
  const maxQty = stock > 0 ? stock : 999;

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

            {reduced ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
                On sale {pct > 0 ? `(-${pct}%)` : ""}
              </span>
            ) : null}

            <span
              className={[
                "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset",
                isBackOrder
                  ? "bg-amber-50 text-amber-700 ring-amber-100"
                  : "bg-emerald-50 text-emerald-700 ring-emerald-100",
              ].join(" ")}
            >
              {isBackOrder ? "Back order" : `${stock} in stock`}
            </span>
          </div>
        </div>

        {/* Layout */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Image card */}
          <div className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
            <div className="relative aspect-[4/3] w-full bg-[#F6F8FB]">
              {product.image ? (
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  priority
                  className="object-cover"
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

            {/* Price */}
            <div className="mt-4">
              <p className="text-sm text-black/60">Price</p>

              {reduced && typeof dealPennies === "number" ? (
                <div className="mt-1 flex items-end gap-3">
                  <p className="text-3xl font-semibold text-black">
                    {formatGBPFromPennies(dealPennies)}
                  </p>
                  <p className="pb-1 text-sm text-black/45 line-through">
                    {formatGBPFromPennies(basePennies)}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-3xl font-semibold">{formatGBPFromPennies(basePennies)}</p>
              )}

              {activeDeal?.endsAt ? (
                <div className="mt-2">
                  <DealCountdown
                    endsAtIso={new Date(activeDeal.endsAt).toISOString()}
                    className="text-xs text-black/60"
                  />
                </div>
              ) : null}
            </div>

            {/* Description */}
            {product.description ? (
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-black/70">
                {product.description}
              </p>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-black/60">
                Research-use product supplied for laboratory and analytical purposes only.
              </p>
            )}

            {/* CTA */}
            <div className="mt-6">
              <ProductsPurchaseActions
                productId={String(product.id)}
                dealId={activeDeal?.id ?? null}
                // NOTE: your component currently uses isBackOrder as "disable" too
                // We keep behaviour: inactive blocks buying, backorder still allowed
                isBackOrder={product.isActive === false ? true : false}
                maxQty={maxQty}
                name={product.name}
                unitPricePennies={unitPricePennies}
                image={product.image ?? null}
              />

              {isBackOrder ? (
                <p className="mt-3 text-xs text-black/55">
                  Back order — dispatched as soon as stock arrives.
                </p>
              ) : null}
            </div>

            {/* Compliance / disclaimer */}
            <div className="mt-6 rounded-2xl border border-black/10 bg-[#F6F8FB] p-4 text-xs text-black/55">
              Research-use only. Not for human or veterinary consumption. Not intended to diagnose,
              treat, cure, or prevent any disease.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
