// web/app/_components/ProductQuickActions.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import BuyNowButton from "./BuyNowButton";
import { useCart } from "@/app/_components/CartProvider";

type Props = {
  productId: string;
  dealId: string | null;

  canView: boolean;
  isBackOrder: boolean;

  buyLinkGoesToCheckout?: boolean;

  linkLabel?: string;
  buyLabel?: string;
  maxQty?: number;

  name: string;
  image?: string | null;
  unitPricePennies: number;

  /**
   * IMPORTANT:
   * If your Quick Buy modal ALSO shows a shipping progress bar / suggestions,
   * set this to false wherever you render ProductQuickActions in that context
   * to prevent DUPLICATED progress bars + suggestions.
   */
  showDeliveryUpsell?: boolean;
};

type ShippingSettingsResponse = {
  enabled: boolean;
  freeOverPennies: number;
  flatRatePennies: number;
  shippingCostPennies?: number; // back-compat alias
  currency: "GBP";
};

type Suggestion = {
  id: string;
  name: string;
  image: string | null;
  pricePennies: number;
  stock: number;
};

type SuggestionsResponse = {
  ok: boolean;
  enabled: boolean;
  freeOverPennies?: number;
  flatRatePennies?: number;
  remainingPennies: number;
  suggestions: Suggestion[];
  error?: string;
};

type CartItem = {
  productId: string;
  dealId?: string | null;
  qty: number;
  name?: string;
  image?: string | null;
  unitPricePennies?: number;
};

type CartContextShape = {
  items: Record<string, CartItem>;
  addItem: (item: CartItem, maxQty?: number) => void;
  subtotalPennies?: number;
};

function clampInt(n: unknown, min: number, max: number) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.trunc(v)));
}

function gbp(pennies: number) {
  const safe = Number.isFinite(pennies) ? pennies : 0;
  return `£${(safe / 100).toFixed(2)}`;
}

function buildCartKey(productId: string, dealId: string | null) {
  return `${String(productId ?? "").trim()}::${String(dealId ?? "").trim()}`;
}

export default function ProductQuickActions({
  productId,
  dealId,
  canView,
  isBackOrder,
  buyLinkGoesToCheckout = true,
  linkLabel = "Buy",
  buyLabel = "Buy",
  maxQty = 10,
  name,
  image,
  unitPricePennies,
  showDeliveryUpsell = true,
}: Props) {
  const disabled = !canView;

  const cartCtx = useCart() as unknown as CartContextShape;
  const items = cartCtx?.items || {};
  const addItem = cartCtx?.addItem;

  // ✅ stop parent card <Link> wrappers hijacking clicks
  function stopBubble(e: any) {
    e?.stopPropagation?.();
  }

  const options = useMemo(() => {
    const m = clampInt(maxQty, 1, 99);
    return Array.from({ length: m }, (_, i) => i + 1);
  }, [maxQty]);

  const [qty, setQty] = useState<number>(1);
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);

  const safeQty = useMemo(() => clampInt(qty, 1, 99), [qty]);

  /** ---------------- Shipping settings ---------------- */
  const [ship, setShip] = useState<ShippingSettingsResponse | null>(null);

  useEffect(() => {
    if (!showDeliveryUpsell) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/settings/shipping", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as ShippingSettingsResponse;
        if (!cancelled) setShip(json);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showDeliveryUpsell]);

  const shippingCostPennies = useMemo(() => {
    if (!ship) return 0;
    return Number(ship.flatRatePennies ?? ship.shippingCostPennies ?? 0) || 0;
  }, [ship]);

  const freeOverPennies = useMemo(() => {
    if (!ship) return 0;
    return Number(ship.freeOverPennies ?? 0) || 0;
  }, [ship]);

  /** ---------------- Subtotals ---------------- */
  const cartSubtotalPennies = useMemo(() => {
    const fromProvider = Number(cartCtx?.subtotalPennies);
    if (Number.isFinite(fromProvider) && fromProvider >= 0) return Math.trunc(fromProvider);

    return Object.values(items).reduce((sum, it) => {
      const price = Number(it?.unitPricePennies) || 0;
      const q = Number(it?.qty) || 0;
      return sum + price * q;
    }, 0);
  }, [cartCtx?.subtotalPennies, items]);

  const thisSubtotalPennies = useMemo(() => {
    const u = clampInt(unitPricePennies, 0, 10_000_000);
    return u * safeQty;
  }, [unitPricePennies, safeQty]);

  const inCartKey = useMemo(() => buildCartKey(productId, dealId), [productId, dealId]);

  const inCartQty = useMemo(() => {
    const entry = items?.[inCartKey];
    return Number(entry?.qty) || 0;
  }, [items, inCartKey]);

  const subtotalForUnlockPennies = useMemo(() => {
    // if already in cart, don’t double-count
    return cartSubtotalPennies + (inCartQty > 0 ? 0 : thisSubtotalPennies);
  }, [cartSubtotalPennies, inCartQty, thisSubtotalPennies]);

  /** ---------------- Suggestions ---------------- */
  const [remainingPennies, setRemainingPennies] = useState<number>(0);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggLoading, setSuggLoading] = useState(false);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!showDeliveryUpsell) return;

    if (!ship?.enabled) {
      setRemainingPennies(0);
      setSuggestions([]);
      return;
    }

    const threshold = Math.max(0, freeOverPennies);
    const remaining = Math.max(0, threshold - subtotalForUnlockPennies);

    if (remaining <= 0) {
      setRemainingPennies(0);
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const myReqId = ++reqIdRef.current;

    async function loadSuggestions() {
      setSuggLoading(true);
      try {
        const qs = new URLSearchParams({
          subtotalPennies: String(subtotalForUnlockPennies),
          limit: "4",
          excludeProductId: String(productId),
        });

        const res = await fetch(`/api/suggestions/free-delivery?${qs.toString()}`, {
          cache: "no-store",
        });

        const json = (await res.json().catch(() => null)) as SuggestionsResponse | null;

        if (cancelled) return;
        if (myReqId !== reqIdRef.current) return;

        if (!res.ok || !json || !json.ok) {
          setRemainingPennies(remaining);
          setSuggestions([]);
          return;
        }

        setRemainingPennies(Number(json.remainingPennies) || remaining);

        const list = Array.isArray(json.suggestions) ? json.suggestions : [];
        setSuggestions(list.filter((s) => s.id !== productId));
      } finally {
        if (!cancelled && myReqId === reqIdRef.current) setSuggLoading(false);
      }
    }

    loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [showDeliveryUpsell, ship?.enabled, freeOverPennies, subtotalForUnlockPennies, productId]);

  /** ---------------- Delivery UI: message + progress ---------------- */
  const alreadyFree = useMemo(() => {
    if (!ship?.enabled) return false;
    if (freeOverPennies <= 0) return false;
    return subtotalForUnlockPennies >= freeOverPennies;
  }, [ship?.enabled, subtotalForUnlockPennies, freeOverPennies]);

  const progressPercent = useMemo(() => {
    if (!ship?.enabled) return 0;
    if (freeOverPennies <= 0) return 0;
    const pct = (subtotalForUnlockPennies / freeOverPennies) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }, [ship?.enabled, subtotalForUnlockPennies, freeOverPennies]);

  const remainingToFree = useMemo(() => {
    if (!ship?.enabled) return 0;
    return Math.max(0, freeOverPennies - subtotalForUnlockPennies);
  }, [ship?.enabled, freeOverPennies, subtotalForUnlockPennies]);

  function addToCart() {
    if (disabled || !addItem) return;

    addItem(
      {
        productId,
        dealId: dealId ?? null,
        qty: safeQty,
        name,
        image: image ?? null,
        unitPricePennies,
      },
      99
    );

    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  async function quickCheckout() {
    if (disabled || busy) return;

    try {
      setBusy(true);

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          items: [{ productId, dealId: dealId ?? null, qty: safeQty }],
        }),
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || "Checkout failed");

      const url = data?.url || data?.checkoutUrl;
      if (typeof url === "string" && url) {
        window.location.href = url;
        return;
      }

      throw new Error("Checkout link not returned");
    } catch (e: any) {
      alert(e?.message || "Could not start checkout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-3">
      {/* Primary row */}
      <div
        className="flex items-center gap-2 flex-wrap justify-end"
        onPointerDownCapture={stopBubble}
        onClickCapture={stopBubble}
      >
        {canView ? (
          buyLinkGoesToCheckout ? (
            <button
              type="button"
              onClick={(e) => {
                stopBubble(e);
                quickCheckout();
              }}
              disabled={disabled || busy}
              className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-medium transition hover:bg-black/5 disabled:opacity-50"
            >
              {busy ? "…" : linkLabel}
            </button>
          ) : (
            <Link
              href={`/products/${productId}`}
              className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-medium transition hover:bg-black/5"
            >
              {linkLabel}
            </Link>
          )
        ) : (
          <span className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-black/50">
            Unavailable
          </span>
        )}

        <select
          value={qty}
          onClick={stopBubble}
          onPointerDown={stopBubble}
          onChange={(e) => setQty(Number(e.target.value))}
          disabled={disabled || busy}
          className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-medium outline-none disabled:opacity-50"
        >
          {options.map((n) => (
            <option key={n} value={n}>
              Qty {n}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={(e) => {
            stopBubble(e);
            addToCart();
          }}
          disabled={disabled || busy}
          className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-medium transition hover:bg-black/5 disabled:opacity-50"
        >
          {added ? "Added!" : "Cart"}
        </button>

        <div onClickCapture={stopBubble} onPointerDownCapture={stopBubble}>
          <BuyNowButton
            productId={productId}
            dealId={dealId}
            qty={safeQty} // ✅ use clamped qty
            name={name}
            unitPricePennies={unitPricePennies}
            disabled={disabled || busy}
            label={isBackOrder ? "Back order" : buyLabel}
            maxQty={maxQty}
          />
        </div>
      </div>

      <div className="text-[12px] leading-5 text-black/70 text-right">
        Cart subtotal:{" "}
        <span className="font-extrabold text-black">{gbp(cartSubtotalPennies)}</span>
        <span className="mx-2 text-black/25">•</span>
        This selection:{" "}
        <span className="font-extrabold text-black">{gbp(thisSubtotalPennies)}</span>
      </div>

      {/* Delivery + progress + suggestions */}
      {showDeliveryUpsell && ship ? (
        <div
          className="w-full max-w-[520px] rounded-2xl border border-black/10 bg-white p-3"
          onPointerDownCapture={stopBubble}
          onClickCapture={stopBubble}
        >
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <span className="rounded-full bg-black px-3 py-1 text-[12px] font-extrabold text-white">
              Delivery {ship.enabled ? gbp(shippingCostPennies) : "£0.00"}
            </span>

            {ship.enabled ? (
              <>
                <span className="text-[12px] font-semibold text-black/60">Free over</span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[12px] font-extrabold text-emerald-900">
                  {gbp(freeOverPennies)}
                </span>
              </>
            ) : (
              <span className="text-[12px] font-semibold text-black/60">Shipping disabled</span>
            )}
          </div>

          {ship.enabled ? (
            <>
              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-black/10">
                <div
                  className="h-full bg-emerald-500 transition-all duration-700 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="mt-3 text-[13px] font-semibold text-black/80 text-right">
                {alreadyFree ? (
                  <span className="font-extrabold text-emerald-700 animate-pulse">
                    ✅ FREE delivery unlocked
                  </span>
                ) : (
                  <>
                    Spend{" "}
                    <span className="font-extrabold underline">{gbp(remainingToFree)}</span>{" "}
                    more to unlock{" "}
                    <span className="font-extrabold text-emerald-700 animate-pulse">
                      FREE delivery
                    </span>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="mt-3 text-[12px] font-semibold text-black/70 text-right">
              Delivery is currently disabled (shown as £0.00 at checkout).
            </div>
          )}

          {ship.enabled && remainingPennies > 0 ? (
            <div className="mt-3">
              <div className="text-[12px] font-semibold text-black/70 text-right">
                Suggested add-ons:
              </div>

              <div className="mt-2 flex flex-wrap justify-end gap-2">
                {suggLoading ? (
                  <span className="text-[12px] text-black/45">Finding suggestions…</span>
                ) : suggestions.length ? (
                  suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={(e) => {
                        stopBubble(e);
                        if (!addItem) return;
                        addItem(
                          {
                            productId: s.id,
                            dealId: null,
                            qty: 1,
                            name: s.name,
                            image: s.image,
                            unitPricePennies: s.pricePennies,
                          },
                          99
                        );
                      }}
                      className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-semibold hover:bg-black/5"
                      title="Add to cart"
                    >
                      + {s.name} ({gbp(s.pricePennies)})
                    </button>
                  ))
                ) : (
                  <span className="text-[12px] text-black/45">No suggestions found.</span>
                )}
              </div>

              <div className="mt-2 text-[12px] text-black/55 text-right">
                Tip: add-ons go into your cart. To checkout with them, use{" "}
                <Link href="/cart" className="underline font-semibold">
                  cart checkout
                </Link>
                .
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2 flex-wrap justify-end">
        <Link
          href="/products"
          className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-[12px] font-semibold transition hover:bg-white"
          title="Add more products to unlock free delivery"
        >
          Add more products
        </Link>

        <Link
          href="/cart"
          className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-[12px] font-semibold transition hover:bg-white"
          title="Go to cart"
        >
          View cart
        </Link>
      </div>
    </div>
  );
}