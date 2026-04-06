// web/app/products/page.tsx
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";

import WeeklySpecialsSection from "@/app/_components/WeeklySpecialsSection";
import ProductCard from "@/app/products/ProductCard";


export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Research Peptides UK | Signal Labs",
  description: "Browse HPLC-verified research peptides from Signal Labs. BPC-157, TB-500, GHK-Cu, CJC-1295 and more. UK-based, tracked dispatch.",
};

type SP = Record<string, string | string[] | undefined>;

function spValue(sp: SP, key: string): string | undefined {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

function penniesFrom(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatGBPFromPennies(value: unknown) {
  const pennies = penniesFrom(value);
  return `£${(pennies / 100).toFixed(2)}`;
}

function pctOffPennies(basePennies: number, specialPennies: number) {
  if (!Number.isFinite(basePennies) || basePennies <= 0) return 0;
  if (!Number.isFinite(specialPennies) || specialPennies <= 0) return 0;
  if (specialPennies >= basePennies) return 0;
  return Math.round(((basePennies - specialPennies) / basePennies) * 100);
}

/**
 * Read NextAuth session server-side without importing authOptions.
 * Uses the request host + cookies to call /api/auth/session.
 */
async function getSessionFromApi() {
  try {
    const h = await headers();
    const c = await cookies();

    const host = h.get("host");
    if (!host) return null;

    const proto =
      host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";

    const url = `${proto}://${host}/api/auth/session`;

    const res = await fetch(url, {
      headers: { cookie: c.toString() },
      cache: "no-store",
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function buildProductsUrl(q: string, activeOnly: boolean) {
  const usp = new URLSearchParams();
  if (q) usp.set("q", q);
  if (activeOnly) usp.set("activeOnly", "1");
  const s = usp.toString();
  return s ? `/products?${s}` : "/products";
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SP> | SP;
}) {
  const sp = await Promise.resolve(searchParams);

  const q = (spValue(sp, "q") || "").trim();
  const activeOnly = spValue(sp, "activeOnly") === "1";
  const sort = spValue(sp, "sort") || "stock_first";

  const session = await getSessionFromApi();
  const isAdmin = session?.user?.role === "ADMIN";

  // Admin can optionally show inactive products (unless activeOnly=1)
  const showInactive = isAdmin && !activeOnly;

  const now = new Date();

  const products = await prisma.product.findMany({
    where: {
      ...(showInactive ? {} : { isActive: true }),
      category: "peptide",
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { description: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: sort === "za" ? [{ name: "desc" }] :
               sort === "price_asc" ? [{ price: "asc" }] :
               sort === "price_desc" ? [{ price: "desc" }] :
               sort === "newest" ? [{ createdAt: "desc" }] :
               [{ name: "asc" }],
    include: {
      _count: { select: { orderItems: true } },
      deals: {
        where: {
          isActive: true,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
        orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
  });

  const pageUrl = (params: { q?: string; activeOnly?: boolean }) =>
    buildProductsUrl(params.q ?? q, params.activeOnly ?? activeOnly);

  return (
    <main className="min-h-screen bg-[#F6F8FB] text-[#0B1220]">
      {/* WEEKLY SPECIALS */}
      <section className="pt-6">
        <WeeklySpecialsSection
          title="Weekly Specials"
          showViewProducts={false}
          variant="grid"
          take={8}
        />
      </section>

      {/* PRODUCTS */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16 sm:px-6">
        {/* Header + search */}
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Available Products
            </h2>

            <p className="mt-1 text-sm text-black/60">
              {products.length} product{products.length === 1 ? "" : "s"} listed
              {q ? (
                <>
                  {" "}
                  , showing results for{" "}
                  <span className="font-semibold text-black">“{q}”</span>
                </>
              ) : null}
            </p>

            {isAdmin ? (
              <div className="mt-2 text-xs text-black/50">
                {showInactive ? (
                  <Link href={pageUrl({ activeOnly: true })} className="underline">
                    Hide inactive products
                  </Link>
                ) : (
                  <Link
                    href={pageUrl({ activeOnly: false })}
                    className="underline"
                  >
                    Show inactive products
                  </Link>
                )}
              </div>
            ) : null}
          </div>

          <div className="w-full sm:w-[440px]">
            <form method="GET" className="flex items-center gap-2">
              <select
                name="sort"
                defaultValue={sort}
                className="rounded-2xl border border-black/15 bg-white px-3 py-3 text-sm outline-none focus:border-black/30"
              >
                <option value="stock_first">In Stock First</option>
                  <option value="az">A — Z</option>
                <option value="za">Z — A</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="newest">Newest</option>
              </select>
              <input
                name="q"
                defaultValue={q}
                placeholder="Search products…"
                className="w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-sm outline-none focus:border-black/30"
              />

              {isAdmin && activeOnly ? (
                <input type="hidden" name="activeOnly" value="1" />
              ) : null}

              <button
                type="submit"
                className="rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
              >
                Search
              </button>

              {q ? (
                <Link
                  href={pageUrl({ q: "", activeOnly })}
                  className="rounded-2xl border border-black/15 bg-white px-4 py-3 text-sm font-medium transition hover:bg-black/5"
                >
                  Clear
                </Link>
              ) : null}
            </form>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold">No products found</h3>
            <p className="mt-2 text-sm text-black/60">
              {q
                ? "Try a different search term, or clear the search."
                : "No products are in the database yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {(sort === "stock_first"
              ? [...products].sort((a, b) => {
                  // Parse variants to check stock
                  const hasStock = (p: any) => {
                    if (p.variantsJson) {
                      try {
                        const v = JSON.parse(p.variantsJson);
                        if (Array.isArray(v)) return v.some((v: any) => (v.stock ?? 0) > 0);
                      } catch {}
                    }
                    return (typeof p.stock === 'number' ? p.stock : 0) > 0;
                  };
                  const aStock = hasStock(a) ? 1 : 0;
                  const bStock = hasStock(b) ? 1 : 0;
                  if (bStock !== aStock) return bStock - aStock;
                  return a.name.localeCompare(b.name);
                })
              : products
            ).map((p) => {
              const stock = typeof p.stock === "number" ? p.stock : 0;
              const isBackOrder = stock <= 0;
              const isInactive = p.isActive === false;
              const disabled = !isAdmin && isInactive;
              const maxQty = stock > 0 ? stock : 999;
              const activeDeal = p.deals?.[0] ?? null;
              const basePennies = penniesFrom(p.price);
              const dealPennies = activeDeal?.specialPrice == null ? null : penniesFrom(activeDeal.specialPrice);
              const reduced = typeof dealPennies === "number" && dealPennies > 0 && dealPennies < basePennies;
              const pct = reduced && dealPennies ? pctOffPennies(basePennies, dealPennies) : 0;

              return (
                <ProductCard
                  key={String(p.id)}
                  product={{
                    id: String(p.id),
                    name: p.name,
                    image: p.image ?? null,
                    stock,
                    isActive: p.isActive,
                    variantsJson: (p as any).variantsJson ?? null,
                  allDeals: p.deals ?? [],
                  }}
                  basePennies={basePennies}
                  dealId={activeDeal?.id ?? null}
                  dealEndsAt={activeDeal?.endsAt ? new Date(activeDeal.endsAt).toISOString() : null}
                  reduced={reduced}
                  dealPennies={dealPennies}
                  pct={pct}
                  isAdmin={isAdmin}
                  isBackOrder={isBackOrder}
                  disabled={disabled}
                  maxQty={maxQty}
                  orderCount={(p as any)._count?.orderItems ?? 0}
                />
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}