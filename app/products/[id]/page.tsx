// app/products/[id]/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { absUrl } from "@/lib/site";
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

export async function generateMetadata(props: {
  params: Promise<{ id: string }> | { id: string };
}): Promise<Metadata> {
  const params = await Promise.resolve(props.params);
  const id = String((params as any)?.id ?? "").trim();
  if (!id) return { robots: { index: false, follow: false } };

  const product = await prisma.product.findUnique({
    where: { id },
    select: { name: true, description: true, image: true, isActive: true },
  });

  if (!product || !product.isActive) {
    return { robots: { index: false, follow: false } };
  }

  const title = `${product.name} | Signal Laboratories`;
  const description = product.description
    ? product.description.replace(/\n/g, " ").slice(0, 155).trim()
    : `${product.name} research peptide — laboratory grade, HPLC verified, for research use only.`;
  const canonical = absUrl(`/products/${id}`);
  const imageUrl = product.image ? absUrl(product.image) : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: imageUrl ? [{ url: imageUrl, alt: product.name }] : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
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

  let variants: ProductVariant[] = [];
  if ((product as any).variantsJson) {
    try {
      const parsed = JSON.parse((product as any).variantsJson);
      if (Array.isArray(parsed)) variants = parsed;
    } catch {}
  }

  const canonical = absUrl(`/products/${id}`);
  const priceGBP = (basePennies / 100).toFixed(2);
  const finalPriceGBP = dealPennies ? (dealPennies / 100).toFixed(2) : priceGBP;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: product.image ? absUrl(product.image) : undefined,
    url: canonical,
    brand: { "@type": "Brand", name: "Signal Laboratories" },
    offers: {
      "@type": "Offer",
      url: canonical,
      priceCurrency: "GBP",
      price: finalPriceGBP,
      availability: stock > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/PreOrder",
      seller: { "@type": "Organization", name: "Signal Laboratories" },
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absUrl("/") },
      { "@type": "ListItem", position: 2, name: "Products", item: absUrl("/products") },
      { "@type": "ListItem", position: 3, name: product.name, item: canonical },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
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
    </>
  );
}
