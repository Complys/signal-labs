// app/admin/products/page.tsx
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import ProductRowActions from "./ProductRowActions";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

function spValue(sp: SP, key: string): string | undefined {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

function clampInt(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function asNumber(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatGBPFromPennies(pennies: unknown) {
  const safe = asNumber(pennies);
  return `£${(safe / 100).toFixed(2)}`;
}

function discountPct(originalPennies: unknown, specialPennies: unknown) {
  const o = asNumber(originalPennies);
  const s = asNumber(specialPennies);
  if (!Number.isFinite(o) || o <= 0 || !Number.isFinite(s) || s < 0) return 0;
  const pct = Math.round(((o - s) / o) * 100);
  return Math.max(0, Math.min(99, pct));
}

function marginPct(sellPennies: number, costPennies: number) {
  if (!Number.isFinite(sellPennies) || sellPennies <= 0) return null;
  if (!Number.isFinite(costPennies) || costPennies < 0) return null;
  const profit = sellPennies - costPennies;
  const pct = (profit / sellPennies) * 100;
  if (!Number.isFinite(pct)) return null;
  return Math.max(-999, Math.min(999, Math.round(pct)));
}

function Dot({ kind }: { kind: "active" | "inactive" | "backorder" | "special" | "low" }) {
  const cls =
    kind === "active"
      ? "bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.15)]"
      : kind === "inactive"
      ? "bg-gray-400 shadow-[0_0_0_3px_rgba(156,163,175,0.12)]"
      : kind === "special"
      ? "bg-yellow-400 shadow-[0_0_0_3px_rgba(245,196,0,0.18)]"
      : kind === "low"
      ? "bg-orange-500 shadow-[0_0_0_3px_rgba(249,115,22,0.15)]"
      : "bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.14)]";

  return <span className={`h-2 w-2 rounded-full ${cls}`} />;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-extrabold">
      {children}
    </span>
  );
}

function Btn({
  href,
  children,
  variant = "dark",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "dark" | "yellow";
}) {
  const base =
    "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold no-underline transition hover:opacity-90";
  const dark = "border-white/15 bg-white/5 text-white hover:bg-white/10";
  const yellow = "border-yellow-400 bg-yellow-400 text-black";

  return (
    <Link href={href} className={`${base} ${variant === "yellow" ? yellow : dark}`}>
      {children}
    </Link>
  );
}

type Filter = "" | "active" | "low-stock" | "backorder";

function normalizeFilter(v: string): Filter {
  const x = (v || "").trim().toLowerCase();
  if (x === "active") return "active";
  if (x === "low-stock") return "low-stock";
  if (x === "backorder") return "backorder";
  return "";
}

export default async function AdminProductsPage({
  searchParams,
}: {
  // Next.js 16: searchParams is a Promise in Server Components
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;

  const q = (spValue(sp, "q") ?? "").trim();
  const filter = normalizeFilter(spValue(sp, "filter") ?? "");
  const page = clampInt(Number(spValue(sp, "page") ?? "1") || 1, 1, 999999);
  const pageSize = clampInt(Number(spValue(sp, "pageSize") ?? "25") || 25, 5, 100);

  // base search where
  const searchWhere =
    q.length > 0
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

  // filter where
  const filterWhere =
    filter === "active"
      ? { isActive: true }
      : filter === "low-stock"
      ? { isActive: true, stock: { gt: 0, lt: 5 } }
      : filter === "backorder"
      ? { isActive: true, stock: { lte: 0 } }
      : {};

  const where = { ...searchWhere, ...filterWhere };

  const now = new Date();

  const [total, activeCount, lowStockCount, backOrderCount] = await Promise.all([
    prisma.product.count({ where }), // total for current filter/search
    prisma.product.count({ where: { ...searchWhere, isActive: true } }),
    prisma.product.count({ where: { ...searchWhere, isActive: true, stock: { gt: 0, lt: 5 } } }),
    prisma.product.count({ where: { ...searchWhere, isActive: true, stock: { lte: 0 } } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = clampInt(page, 1, totalPages);

  const items = await prisma.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (safePage - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      costPennies: true,
      stock: true,
      isActive: true,
      image: true,
      createdAt: true,
      deals: {
        where: {
          isActive: true,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
        orderBy: { startsAt: "desc" },
        take: 1,
        select: { id: true, specialPrice: true },
      },
    },
  });

  const startIndex = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(total, safePage * pageSize);

  // keep params when paging
  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (filter) baseParams.set("filter", filter);
  baseParams.set("pageSize", String(pageSize));

  const prevHref = (() => {
    const p = new URLSearchParams(baseParams);
    p.set("page", String(Math.max(1, safePage - 1)));
    return `/admin/products?${p.toString()}`;
  })();

  const nextHref = (() => {
    const p = new URLSearchParams(baseParams);
    p.set("page", String(Math.min(totalPages, safePage + 1)));
    return `/admin/products?${p.toString()}`;
  })();

  const exportHref = (() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (filter) p.set("filter", filter);
    return `/admin/products/export?${p.toString()}`;
  })();

  // filter links
  const filterLink = (f: Filter) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (f) p.set("filter", f);
    p.set("pageSize", String(pageSize));
    p.set("page", "1");
    return `/admin/products?${p.toString()}`;
  };

  const filterLabel =
    filter === "active"
      ? "Active"
      : filter === "low-stock"
      ? "Low stock"
      : filter === "backorder"
      ? "Back order"
      : "All";

  return (
    <main className="p-6">
      {/* Title row */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-3xl font-black">Products</h1>

          <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/60">
            <span>{total} total</span>
            <span>• {activeCount} active</span>
            <span>• {lowStockCount} low stock</span>
            <span>• {backOrderCount} back order</span>
            <span>• View: {filterLabel}</span>
            {total > 0 ? (
              <span>
                • Showing {startIndex}–{endIndex}
              </span>
            ) : null}
          </div>

          {/* ✅ Filters (keep) */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={filterLink("")}
              className={`rounded-full border px-3 py-1 text-[11px] font-extrabold ${
                filter === ""
                  ? "border-yellow-400 bg-yellow-400 text-black"
                  : "border-white/15 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              All
            </Link>

            <Link
              href={filterLink("active")}
              className={`rounded-full border px-3 py-1 text-[11px] font-extrabold ${
                filter === "active"
                  ? "border-yellow-400 bg-yellow-400 text-black"
                  : "border-white/15 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              Active
            </Link>

            <Link
              href={filterLink("low-stock")}
              className={`rounded-full border px-3 py-1 text-[11px] font-extrabold ${
                filter === "low-stock"
                  ? "border-yellow-400 bg-yellow-400 text-black"
                  : "border-white/15 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              Low stock
            </Link>

            <Link
              href={filterLink("backorder")}
              className={`rounded-full border px-3 py-1 text-[11px] font-extrabold ${
                filter === "backorder"
                  ? "border-yellow-400 bg-yellow-400 text-black"
                  : "border-white/15 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              Back order
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Btn href="/admin/orders" variant="dark">
            Orders
          </Btn>
          <Btn href="/admin/deals" variant="dark">
            Weekly Specials
          </Btn>
          <Btn href={exportHref} variant="dark">
            Export CSV
          </Btn>
          <Btn href="/admin/products/new" variant="yellow">
            Create New
          </Btn>
        </div>
      </div>

      {/* Panel */}
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        {/* Controls */}
        <form
          action="/admin/products"
          method="get"
          className="flex flex-wrap items-center gap-3 border-b border-white/10 p-4"
        >
          <input
            name="q"
            placeholder="Search products..."
            defaultValue={q}
            className="w-full max-w-[420px] rounded-2xl border border-white/15 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-yellow-400/60"
          />

          <select
            name="pageSize"
            defaultValue={String(pageSize)}
            className="rounded-2xl border border-white/15 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-yellow-400/60"
          >
            <option value="10">10 per page</option>
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </select>

          {/* keep current filter when searching */}
          {filter ? <input type="hidden" name="filter" value={filter} /> : null}

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/10"
          >
            Apply
          </button>

          <input type="hidden" name="page" value="1" />
        </form>

        {/* Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/60">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Thumb</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Margin</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Special</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="text-sm">
              {items.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-white/60" colSpan={10}>
                    {q || filter ? "No products match your filters/search." : "No products found."}
                  </td>
                </tr>
              ) : (
                items.map((p) => {
                  const isActive = p.isActive !== false;
                  const stockNum = typeof p.stock === "number" ? p.stock : 0;
                  const isBackOrder = stockNum <= 0;
                  const lowStock = stockNum > 0 && stockNum < 5;

                  const activeDeal = p.deals?.[0] ?? null;
                  const onSpecial = Boolean(activeDeal);
                  const specialPrice = activeDeal?.specialPrice;

                  // for margin: use special if active, else normal price
                  const sell = onSpecial && typeof specialPrice === "number" ? specialPrice : p.price;
                  const cost = typeof p.costPennies === "number" ? p.costPennies : null;
                  const mp = cost === null ? null : marginPct(sell, cost);

                  const pct =
                    onSpecial && typeof specialPrice === "number"
                      ? discountPct(p.price, specialPrice)
                      : 0;

                  return (
                    <tr key={String(p.id)} className="border-b border-white/5">
                      <td className="px-4 py-3 align-middle">{String(p.id)}</td>

                      <td className="px-4 py-3 align-middle">
                        <div className="relative h-[42px] w-[42px] overflow-hidden rounded-xl border border-white/10 bg-white/5">
                          {p.image ? (
                            <Image src={p.image} alt={p.name} fill sizes="42px" className="object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-xs text-white/40">—</div>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <Link
                          href={`/admin/products/${String(p.id)}/edit`}
                          className="font-extrabold text-white no-underline hover:opacity-90"
                        >
                          {p.name}
                        </Link>
                        {p.description ? (
                          <div className="mt-1 text-xs text-white/55">
                            {p.description.slice(0, 80)}
                            {p.description.length > 80 ? "…" : ""}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 py-3 align-middle">
                        {onSpecial && typeof specialPrice === "number" ? (
                          <div className="grid gap-1">
                            <span className="text-white/50 line-through">{formatGBPFromPennies(p.price)}</span>
                            <span className="font-black text-yellow-400">{formatGBPFromPennies(specialPrice)}</span>
                          </div>
                        ) : (
                          formatGBPFromPennies(p.price)
                        )}
                      </td>

                      <td className="px-4 py-3 align-middle">
                        {typeof p.costPennies === "number" ? (
                          <span className="font-bold text-white/85">{formatGBPFromPennies(p.costPennies)}</span>
                        ) : (
                          <span className="text-xs text-white/45">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 align-middle">
                        {mp === null ? (
                          <span className="text-xs text-white/45">—</span>
                        ) : (
                          <span
                            className={`font-extrabold ${
                              mp >= 30 ? "text-emerald-300" : mp >= 10 ? "text-yellow-300" : "text-orange-300"
                            }`}
                          >
                            {mp}%
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 align-middle">
                        {isBackOrder ? (
                          <Chip>
                            <Dot kind="backorder" />
                            Back order
                          </Chip>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <span className="font-bold">{stockNum}</span>
                            {lowStock ? (
                              <Chip>
                                <Dot kind="low" />
                                Low stock
                              </Chip>
                            ) : null}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <Chip>
                          <Dot kind={isActive ? "active" : "inactive"} />
                          {isActive ? "Active" : "Inactive"}
                        </Chip>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        {onSpecial && typeof specialPrice === "number" ? (
                          <div className="inline-flex flex-wrap items-center gap-2">
                            <Chip>
                              <Dot kind="special" />
                              {formatGBPFromPennies(specialPrice)}
                            </Chip>

                            {pct > 0 ? (
                              <span className="inline-flex items-center rounded-full border border-yellow-400/35 bg-yellow-400/10 px-2.5 py-1 text-xs font-extrabold text-yellow-400">
                                -{pct}%
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-white/50">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 align-middle text-right">
                        <div className="inline-flex flex-wrap justify-end gap-2">
                          <Link
                            href={`/admin/products/${String(p.id)}/edit`}
                            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
                          >
                            Edit
                          </Link>

                          <ProductRowActions id={String(p.id)} isActive={isActive} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="text-xs text-white/60">
            Page {safePage} of {totalPages}
          </div>

          <div className="flex gap-2">
            <Link
              href={prevHref}
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold ${
                safePage <= 1
                  ? "pointer-events-none border-white/10 bg-white/5 text-white/40"
                  : "border-white/15 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              Prev
            </Link>

            <Link
              href={nextHref}
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold ${
                safePage >= totalPages
                  ? "pointer-events-none border-white/10 bg-white/5 text-white/40"
                  : "border-white/15 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              Next
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-white/55">
        Tip: Manage specials in{" "}
        <Link href="/admin/deals" className="font-bold text-yellow-400 hover:opacity-90">
          Weekly Specials
        </Link>
        .
      </div>
    </main>
  );
}