// app/admin/deals/page.tsx
import { prisma } from "@/lib/prisma";
import DealsManager from "./DealsManager";

export const metadata = {
  title: "Weekly Specials | Signal Admin",
  description: "Manage weekly specials (deals) for products.",
};

function safeIso(d: Date | string | null | undefined) {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  return Number.isFinite(dt.getTime()) ? dt.toISOString() : null;
}

export default async function AdminDealsPage() {
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      image: true,
      isActive: true,
      stock: true,
      variantsJson: true,
    },
  });

  const deals = await prisma.deal.findMany({
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      productId: true,
      title: true,
      description: true,
      image: true,
      buttonLabel: true,
      buttonUrl: true,
      specialPrice: true,
      variantLabel: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
    },
  });

  // Build deals map keyed by "productId::variantLabel" (empty string for whole product)
  const dealsByKey: Record<string, any> = {};
  for (const d of deals) {
    if (!d.productId) continue;
    const key = `${d.productId}::${d.variantLabel ?? ""}`;
    if (!dealsByKey[key]) {
      dealsByKey[key] = {
        ...d,
        startsAt: safeIso(d.startsAt)!,
        endsAt: safeIso(d.endsAt),
      };
    }
  }

  return (
    <main className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Weekly Specials</h1>
          <p className="mt-1 text-sm text-white/60">
            Set deals per variant. Each size can have its own special price and dates.
          </p>
        </div>
        <DealsManager products={products as any} dealsByKey={dealsByKey} />
      </div>
    </main>
  );
}
