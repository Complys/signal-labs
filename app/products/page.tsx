// web/app/products/page.tsx
import Image from "next/image";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";

import WeeklySpecialsSection from "@/app/_components/WeeklySpecialsSection";
import StockNotifyButton from "@/app/_components/StockNotifyButton";
import DealCountdown from "@/app/_components/DealCountdown";
import ProductsPurchaseActions from "@/app/_components/ProductsPurchaseActions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Products | Signal Labs",
  description: "Browse research-use products from Signal Labs. Secure checkout and tracked UK dispatch.",
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

  const session = await getSessionFromApi();
  const isAdmin = session?.user?.role === "ADMIN";

  // Admin can optionally show inactive products (unless activeOnly=1)
  const showInactive = isAdmin && !activeOnly;

  const now = new Date();

  const products = await prisma.product.findMany({
    where: {
      ...(showInactive ? {} : { isActive: true }),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { description: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
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
            {products.map((p) => {
              const idStr = String(p.id);

              const stock = typeof p.stock === "number" ? p.stock : 0;
              const isBackOrder = stock <= 0;

              const isInactive = p.isActive === false;
              const disabled = !isAdmin && isInactive;

              // Cap qty when stock is positive, otherwise allow up to 999 (backorder)
              const maxQty = stock > 0 ? stock : 999;

              const activeDeal = p.deals?.[0] ?? null;

              const basePennies = penniesFrom(p.price);
              const dealPennies =
                activeDeal?.specialPrice == null ? null : penniesFrom(activeDeal.specialPrice);

              const reduced =
                typeof dealPennies === "number" &&
                dealPennies > 0 &&
                dealPennies < basePennies;

              const pct = reduced && dealPennies ? pctOffPennies(basePennies, dealPennies) : 0;
              const unitPricePennies = reduced && dealPennies ? dealPennies : basePennies;

              const cardCls = [
                "group overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md",
                reduced ? "border-2 border-green-500/60" : "border border-black/10",
                isAdmin && isInactive ? "opacity-70" : "",
              ].join(" ");

              return (
                <div key={idStr} className={cardCls}>
                  <div className="relative aspect-square w-full bg-black/[0.03]">
                    {reduced ? (
                      <div className="absolute right-3 top-3 z-20 rounded-full bg-green-600 px-3 py-1 text-[11px] font-extrabold text-white shadow">
                        On Sale
                      </div>
                    ) : null}

                    {reduced && pct > 0 ? (
                      <div className="absolute left-3 top-3 z-20 rounded-full bg-green-600 px-4 py-2 text-[12px] font-extrabold text-white shadow sm:text-[13px]">
                        -{pct}%
                      </div>
                    ) : null}

                    {isBackOrder ? (
                      <div className="absolute bottom-3 left-3 z-20 rounded-full bg-black px-3 py-1 text-[11px] font-semibold text-white">
                        Back order
                      </div>
                    ) : null}

                    {isAdmin && isInactive ? (
                      <div className="absolute bottom-3 right-3 z-20 rounded-full bg-red-600 px-3 py-1 text-[11px] font-semibold text-white">
                        Inactive
                      </div>
                    ) : null}

                    {p.image ? (
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-black/45">
                        No Image
                      </div>
                    )}
                  </div>

                  <div className="p-3 sm:p-4">
                    <div className="line-clamp-2 text-sm font-medium leading-snug">
                      {p.name}
                    </div>

                    {/* Price */}
                    <div className="mt-3">
                      {reduced && typeof dealPennies === "number" ? (
                        <div className="leading-tight">
                          <div className="text-sm font-extrabold text-black sm:text-base">
                            {formatGBPFromPennies(dealPennies)}
                          </div>
                          <div className="text-[11px] text-black/50 line-through">
                            {formatGBPFromPennies(basePennies)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm font-semibold">
                          {formatGBPFromPennies(basePennies)}
                        </div>
                      )}
                    </div>

                    {/* Actions (Client Component) */}
                    <div className="mt-4">
  <ProductsPurchaseActions
    productId={idStr}
    dealId={activeDeal?.id ?? null}
    isBackOrder={isBackOrder}
    disabled={disabled}
    maxQty={maxQty}
    name={p.name}
    unitPricePennies={unitPricePennies}
    image={p.image ?? null}
  />
</div>

                    {activeDeal?.endsAt ? (
                      <div className="mt-2">
                        <DealCountdown
                          endsAtIso={new Date(activeDeal.endsAt).toISOString()}
                          className="text-[11px] text-black/60"
                        />
                      </div>
                    ) : null}

                    {isBackOrder && !isAdmin ? (
                      <div className="mt-3">
                        <StockNotifyButton productId={idStr} />
                      </div>
                    ) : null}
                    <p className="mt-3 text-[11px] text-black/50">
                      {isBackOrder ? "Back order" : `Stock: ${stock}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}