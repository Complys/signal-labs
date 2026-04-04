// app/_components/WeeklySpecialsSection.tsx
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import DealCountdown from "./DealCountdown";
import ProductsPurchaseActions from "@/app/_components/ProductsPurchaseActions";

/**
 * Weekly Specials
 * - Server component (DB read)
 * - Uses ProductsPurchaseActions (client) for qty/buy/cart
 * - IMPORTANT: Tile is clickable via an overlay <Link> that sits BEHIND controls
 *   so buttons always click (z-index + pointer-events).
 */

function formatGBPFromPennies(pennies: number) {
  const p = Number.isFinite(pennies) ? pennies : 0;
  return `£${(p / 100).toFixed(2)}`;
}

function pctOffPennies(basePennies: number, specialPennies: number) {
  if (!Number.isFinite(basePennies) || basePennies <= 0) return 0;
  if (!Number.isFinite(specialPennies) || specialPennies <= 0) return 0;
  if (specialPennies >= basePennies) return 0;
  return Math.round(((basePennies - specialPennies) / basePennies) * 100);
}

type Props = {
  title?: string;
  showViewProducts?: boolean;
  variant?: "grid" | "cards";
  take?: number;
};

function looksLikeCuid(id: unknown) {
  return typeof id === "string" && id.startsWith("c") && id.length >= 20;
}

function normalizeExternalUrl(u: unknown): string | null {
  if (typeof u !== "string") return null;
  const raw = u.trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("www.")) return `https://${raw}`;
  return null;
}

function safeIntPennies(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i <= 0) return null;
  return i;
}

type DealRow = {
  id: string;
  productId: string;
  description: string | null;
  image: string | null;
  buttonUrl: string | null;
  specialPrice: number | null;
  endsAt: Date | null;
  variantLabel?: string | null;
  product: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    image: string | null;
    stock: number;
    isActive: boolean;
  } | null;
};

function getDealPricing(d: DealRow) {
  const basePennies = safeIntPennies(d?.product?.price);
  const dealPennies = safeIntPennies(d?.specialPrice);

  const canPrice = basePennies !== null && basePennies > 0;

  const reduced =
    canPrice &&
    dealPennies !== null &&
    dealPennies > 0 &&
    dealPennies < (basePennies as number);

  const pct = reduced ? pctOffPennies(basePennies as number, dealPennies as number) : 0;

  const unitPricePennies = reduced ? (dealPennies as number) : (basePennies ?? 0);

  return { basePennies, dealPennies, canPrice, reduced, pct, unitPricePennies };
}

function getProductBasics(d: DealRow) {
  const product = d.product;

  const productId = product?.id || null;
  const productName = (product?.name || "").trim();
  const description = (d.description || product?.description || "").trim();

  const image = (d.image || product?.image || "").trim();
  const variantLabel = (d as any).variantLabel?.trim() || null;
  const titleText = variantLabel ? `${productName} — ${variantLabel}` : (productName || "Weekly Special");

  const stock = typeof product?.stock === "number" ? product.stock : 0;
  const isBackOrder = stock <= 0;

  // match /products: cap qty when stock > 0 else allow up to 999
  const maxQty = stock > 0 ? stock : 999;

  return { productId, productName, description, image, titleText, stock, isBackOrder, maxQty };
}

/**
 * Overlay link BEHIND content.
 * - z-0 so it never blocks buttons
 * - content uses z-10 / actions z-20
 */
function TileOverlayLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="absolute inset-0 z-0"
      // no styling; it’s just a click target behind the content
    />
  );
}

function WeeklySpecialTile({
  d,
  href,
  external,
  compact,
}: {
  d: DealRow;
  href: string | null;
  external: string | null;
  compact: boolean;
}) {
  const { basePennies, dealPennies, canPrice, reduced, pct, unitPricePennies } = getDealPricing(d);
  const { productId, productName, description, image, titleText, stock, isBackOrder, maxQty } =
    getProductBasics(d);

  const endsAtIso = d.endsAt ? new Date(d.endsAt).toISOString() : null;

  // Only show purchase actions when we can actually purchase
  const canPurchaseActions =
    !!href &&
    !!productId &&
    productName.length > 0 &&
    Number.isFinite(unitPricePennies) &&
    unitPricePennies > 0;

  const cardBorder = reduced ? "border-2 border-green-500/60" : "border border-black/10";

  // =========================
  // CARDS VARIANT (big tile)
  // =========================
  if (!compact) {
    return (
      <div
        className={[
          "relative overflow-hidden rounded-3xl bg-white shadow-sm transition hover:shadow-md",
          cardBorder,
        ].join(" ")}
      >
        {/* ✅ Overlay link behind everything */}
        {href ? <TileOverlayLink href={href} label={`View ${titleText}`} /> : null}

        {/* Content above overlay */}
        <div className="relative z-10">
          <div className="relative aspect-[16/9] bg-white">
            {image ? (
              <Image
                src={image}
                alt={titleText}
                fill
                className="object-contain p-4"
                sizes="(max-width: 1024px) 100vw, 33vw"
                priority={false}
              />
            ) : null}

            <div className="absolute top-3 left-3 rounded-full bg-black/90 px-3 py-1 text-[11px] font-semibold text-white">
              Weekly Special
            </div>

            {reduced ? (
              <div className="absolute top-3 right-3 rounded-full bg-green-600 px-3 py-1 text-[11px] font-extrabold text-white shadow">
                On Sale
              </div>
            ) : null}

            {reduced && pct > 0 ? (
              <div className="absolute bottom-3 left-3 rounded-full bg-green-600 px-4 py-2 text-[12px] font-extrabold text-white shadow sm:text-[13px]">
                -{pct}%
              </div>
            ) : null}

            {isBackOrder ? (
              <div className="absolute bottom-3 right-3 rounded-full bg-black px-3 py-1 text-[11px] font-semibold text-white">
                Back order
              </div>
            ) : null}
          </div>

          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-black/50">WEEKLY SPECIAL</div>
                <h3 className="mt-1 truncate text-lg font-semibold leading-snug">{titleText}</h3>
              </div>

              <div className="shrink-0 text-right">
                {canPrice ? (
                  reduced ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-sm text-black/45 line-through">
                        {formatGBPFromPennies(basePennies as number)}
                      </span>
                      <span className="rounded-full bg-black px-3 py-1 text-sm font-extrabold text-white">
                        {formatGBPFromPennies(dealPennies as number)}
                      </span>
                    </div>
                  ) : (
                    <div className="rounded-full bg-black px-3 py-1 text-sm font-extrabold text-white">
                      {formatGBPFromPennies(basePennies as number)}
                    </div>
                  )
                ) : (
                  <div className="rounded-full bg-black/10 px-3 py-1 text-sm font-semibold text-black/40">
                    Unpriced
                  </div>
                )}
              </div>
            </div>

            {description ? (
              <p className="mt-2 line-clamp-3 text-sm text-black/65">{description}</p>
            ) : null}

            <div className="mt-4 flex items-end justify-between gap-3">
              {/* ✅ Actions ALWAYS above overlay */}
              <div className="relative z-20 pointer-events-auto">
                {canPurchaseActions ? (
                  <ProductsPurchaseActions
                    productId={productId!}
                    dealId={d.id}
                    isBackOrder={isBackOrder}
                    disabled={false}
                    maxQty={maxQty}
                    name={productName}
                    unitPricePennies={unitPricePennies}
                    image={image || null}
                  />
                ) : href ? (
                  <Link
                    href={href}
                    className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    View
                  </Link>
                ) : external ? (
                  <a
                    href={external}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    View offer
                  </a>
                ) : (
                  <span className="cursor-not-allowed rounded-full bg-black/10 px-4 py-2 text-sm font-semibold text-black/40">
                    Unavailable
                  </span>
                )}
              </div>

              <div className="relative z-10">
                <DealCountdown endsAtIso={endsAtIso} className="text-xs text-black/45" />
              </div>
            </div>

            {!productName ? (
              <p className="mt-2 text-[11px] text-red-600/80">
                Admin issue: product name missing.
              </p>
            ) : !canPrice ? (
              <p className="mt-2 text-[11px] text-red-600/80">
                Admin issue: product price missing.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // =========================
  // GRID VARIANT (compact tile)
  // =========================
  return (
    <div className={["relative overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md", cardBorder].join(" ")}>
      {/* ✅ Overlay link behind everything */}
      {href ? <TileOverlayLink href={href} label={`View ${titleText}`} /> : null}

      <div className="relative z-10">
        <div className="relative aspect-square w-full bg-black/[0.03]">
          {image ? (
            <Image
              src={image}
              alt={titleText}
              fill
              sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
              className="object-contain p-3"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-black/45">
              No Image
            </div>
          )}

          <div className="absolute left-3 top-3 rounded-full bg-black/90 px-3 py-1 text-[11px] font-semibold text-white">
            Weekly Special
          </div>

          {reduced ? (
            <div className="absolute right-3 top-3 rounded-full bg-green-600 px-3 py-1 text-[11px] font-extrabold text-white shadow">
              On Sale
            </div>
          ) : null}

          {reduced && pct > 0 ? (
            <div className="absolute bottom-3 left-3 rounded-full bg-green-600 px-4 py-2 text-[12px] font-extrabold text-white shadow sm:text-[13px]">
              -{pct}%
            </div>
          ) : null}

          {isBackOrder ? (
            <div className="absolute bottom-3 left-3 rounded-full bg-black px-3 py-1 text-[11px] font-semibold text-white">
              Back order
            </div>
          ) : null}

          <div className="absolute bottom-3 right-3">
            {canPrice ? (
              reduced ? (
                <div className="rounded-2xl border border-black/10 bg-white/95 px-3 py-2">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-[11px] text-black/45 line-through">
                      {formatGBPFromPennies(basePennies as number)}
                    </span>
                    <span className="text-[13px] font-extrabold text-black">
                      {formatGBPFromPennies(dealPennies as number)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-full border border-black/10 bg-white/95 px-3 py-1 text-[12px] font-semibold text-black">
                  {formatGBPFromPennies(basePennies as number)}
                </div>
              )
            ) : (
              <div className="rounded-full border border-black/10 bg-white/95 px-3 py-1 text-[12px] font-semibold text-black/40">
                Unpriced
              </div>
            )}
          </div>
        </div>

        <div className="p-4">
          <div className="line-clamp-2 text-sm font-medium leading-snug">{titleText}</div>

          <div className="mt-3">
            <DealCountdown endsAtIso={endsAtIso} className="text-[11px] text-black/50" />
          </div>

          {/* ✅ Actions ALWAYS above overlay */}
          <div className="relative z-20 pointer-events-auto mt-3 flex justify-end">
            {canPurchaseActions ? (
              <ProductsPurchaseActions
                productId={productId!}
                dealId={d.id}
                isBackOrder={isBackOrder}
                disabled={false}
                maxQty={maxQty}
                name={productName}
                unitPricePennies={unitPricePennies}
                image={image || null}
              />
            ) : href ? (
              <Link
                href={href}
                className="rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                View
              </Link>
            ) : external ? (
              <a
                href={external}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                View offer
              </a>
            ) : (
              <span className="cursor-not-allowed rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-black/40">
                Unavailable
              </span>
            )}
          </div>

          {!productName ? (
            <p className="mt-2 text-[11px] text-red-600/80">
              Admin issue: product name missing.
            </p>
          ) : !canPrice ? (
            <p className="mt-2 text-[11px] text-red-600/80">
              Admin issue: product price missing.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default async function WeeklySpecialsSection({
  title = "Weekly Specials",
  showViewProducts = true,
  variant = "grid",
  take = 8,
}: Props) {
  const now = new Date();

  const deals = (await prisma.deal.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      product: { is: { isActive: true } },
    },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    take,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          image: true,
          stock: true,
          isActive: true,
        },
      },
    },

  })) as DealRow[];

  const buildProductHref = (d: DealRow) => {
    const pid = d?.product?.id ?? d?.productId;
    return looksLikeCuid(pid) ? `/products/${pid}` : null;
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
          <p className="mt-1 text-sm text-black/60">Limited-time specials — updated regularly.</p>
        </div>

        {showViewProducts ? (
          <Link
            href="/products"
            className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium transition hover:bg-black hover:text-white"
          >
            View products
          </Link>
        ) : null}
      </div>

      {deals.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/70">
          No weekly specials are live right now. Check back soon.
        </div>
      ) : variant === "cards" ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((d) => {
            const href = buildProductHref(d);
            const external = normalizeExternalUrl(d.buttonUrl);
            return <WeeklySpecialTile key={d.id} d={d} href={href} external={external} compact={false} />;
          })}
        </div>
      ) : (
        <div className="mt-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {deals.map((d) => {
              const href = buildProductHref(d);
              const external = normalizeExternalUrl(d.buttonUrl);
              return <WeeklySpecialTile key={d.id} d={d} href={href} external={external} compact={true} />;
            })}
          </div>

          <div className="mt-4 text-xs text-black/45">
            Specials are time-limited and may change without notice.
          </div>
        </div>
      )}
    </section>
  );
}