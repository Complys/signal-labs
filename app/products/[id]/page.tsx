// app/products/[id]/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProductPageClient from "./ProductPageClient";
import type { ProductVariant } from "@/app/_components/VariantSelector";

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

function pctOffPennies(basePennies: number, specialPennies: number) {
  if (!Number.isFinite(basePennies) || basePennies <= 0) return 0;
  if (!Number.isFinite(specialPennies) || specialPennies <= 0) return 0;
  if (specialPennies >= basePennies) return 0;
  return Math.round(((basePennies - specialPennies) / basePennies) * 100);
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
    return <NotFoundCard subtitle="This product does not exist (or may have been removed)." />;
  }

  const stock = typeof product.stock === "number" ? product.stock : 0;
  const isBackOrder = stock <= 0;

  const activeDeal = product.deals?.[0] ?? null;

  const basePennies = typeof product.price === "number" ? product.price : Number(product.price) || 0;
  const dealPennies = typeof activeDeal?.specialPrice === "number" ? activeDeal.specialPrice : null;

  const reduced =
    typeof dealPennies === "number" &&
    Number.isFinite(dealPennies) &&
    dealPennies > 0 &&
    dealPennies < basePennies;

  const pct = reduced && dealPennies ? pctOffPennies(basePennies, dealPennies) : 0;

  // Parse variants
  let variants: ProductVariant[] = [];
  if ((product as any).variantsJson) {
    try {
      const parsed = JSON.parse((product as any).variantsJson);
      if (Array.isArray(parsed)) variants = parsed;
    } catch {}
  }

  return (
    <ProductPageClient
      product={{
        id: product.id,
        name: product.name,
        description: product.description ?? null,
        image: product.image ?? null,
        isActive: product.isActive,
      }}
      stock={stock}
      isBackOrder={isBackOrder}
      basePennies={basePennies}
      dealPennies={dealPennies}
      dealId={activeDeal?.id ?? null}
      dealEndsAt={activeDeal?.endsAt ? new Date(activeDeal.endsAt).toISOString() : null}
      reduced={reduced}
      pct={pct}
      variants={variants}
    />
  );
}
