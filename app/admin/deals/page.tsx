// app/admin/deals/page.tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
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
  // Pull products (include inactive so you can set specials for anything)
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      image: true,
      isActive: true,
      stock: true,
    },
  });

  // Pull deals, newest first
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
      isActive: true,
      startsAt: true,
      endsAt: true,
    },
  });

  // Build dealsByProductId (only keep the best/most recent deal per product)
  const dealsByProductId: Record<string, any> = {};
  for (const d of deals) {
    if (!d.productId) continue;
    if (!dealsByProductId[d.productId]) {
      dealsByProductId[d.productId] = {
        ...d,
        startsAt: safeIso(d.startsAt)!, // startsAt required by schema
        endsAt: safeIso(d.endsAt),
      };
    }
  }

  return (
    <main className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Weekly Specials
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Tick products to put them on special, set price, dates and perks.
          </p>
        </div>

        {/* Client UI */}
        <DealsManager
          products={products}
          dealsByProductId={dealsByProductId}
        />
      </div>
    </main>
  );
}

