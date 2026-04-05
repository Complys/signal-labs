"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/app/_components/CartProvider";
import ShippingNotice from "@/app/_components/ShippingNotice";
import FreeDeliveryUpsell from "@/app/_components/FreeDeliveryUpsell";
import MultiBuyBanner from "@/app/_components/MultiBuyBanner";

type CartLine = {
  productId: string;
  dealId?: string | null;
  name?: string | null;
  image?: string | null;
  qty: number;
  unitPricePennies: number;
};

type ShippingSettingsDTO = {
  enabled: boolean;
  freeOverPennies: number;
  shippingCostPennies?: number;
  flatRatePennies?: number; // backward compat
  currency?: string;
};

type ProductDTO = {
  id: string;
  name: string;
  image: string | null;
  pricePennies: number;
};

const LAST_CHECKOUT_SESSION_KEY = "signal_last_checkout_session_id";
const LAST_ORDER_ID_KEY = "signal_last_order_id";
const DELIVERY_FORM_KEY = "signal_delivery_form_v2";

const SAFEPLACES = [
  "No Safeplace (Someone will be at the property)",
  "Enclosed porch",
  "Shed",
  "Reception",
  "Garage",
  "Outbuilding",
  "Other",
] as const;

type Safeplace = (typeof SAFEPLACES)[number];

/* ---------------- helpers ---------------- */

function formatGBPFromPennies(p: number) {
  const safe = Number.isFinite(p) ? p : 0;
  return `£${(safe / 100).toFixed(2)}`;
}

function toInt(n: unknown, fallback = 0) {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function clampInt(n: unknown, min: number, max: number) {
  const x = toInt(n, min);
  return Math.min(max, Math.max(min, x));
}

function isDigitsOnly(s: string) {
  return /^\d+$/.test(s);
}

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function looksLikeEmail(s: string) {
  const v = clean(s);
  return v.includes("@") && v.includes(".") && v.length >= 5;
}

function lineKey(it: { productId: string; dealId?: string | null }) {
  return `${String(it.productId)}::${it.dealId ?? ""}`;
}

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchProductById(productId: string, signal?: AbortSignal): Promise<ProductDTO | null> {
  const tries = [
    `/api/products/${encodeURIComponent(productId)}`,
    `/api/product/${encodeURIComponent(productId)}`,
  ];

  for (const url of tries) {
    try {
      const res = await fetch(url, { cache: "no-store", signal });
      if (!res.ok) continue;

      const data = await safeJson<any>(res);
      if (!data) continue;

      const p = (data.product ?? data) as any;
      const id = String(p?.id ?? p?.productId ?? "");
      const name = String(p?.name ?? "");
      const image = p?.image ?? null;
      const pricePennies = Number(p?.pricePennies ?? p?.unitPricePennies ?? 0);

      if (!id || !name || !Number.isFinite(pricePennies)) continue;

      return {
        id,
        name,
        image: typeof image === "string" ? image : null,
        pricePennies: Math.max(0, Math.trunc(pricePennies)),
      };
    } catch {
      // try next
    }
  }

  return null;
}

/* ---------------- component ---------------- */

export default function CartPage() {
  // ✅ include keyOf + addItem (needed for upsell qty + adding)
  const { items, count, setQty, remove, clear, subtotalPennies, keyOf, addItem } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);

  /** ---------------- Shipping settings ---------------- */
  const [ship, setShip] = useState<ShippingSettingsDTO | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/shipping", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ShippingSettingsDTO | null;
        if (!cancelled && json) setShip(json);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const shippingEnabled = Boolean(ship?.enabled ?? true);

  const shippingCostPennies = useMemo(() => {
    const v = Number(ship?.shippingCostPennies ?? ship?.flatRatePennies ?? 0) || 0;
    return Math.max(0, v);
  }, [ship]);

  const freeOverPennies = useMemo(() => {
    const v = Number(ship?.freeOverPennies ?? 3000) || 3000;
    return Math.max(0, v);
  }, [ship]);

  const deliveryPennies = useMemo(() => {
    if (!shippingEnabled) return 0;
    if (subtotalPennies >= freeOverPennies) return 0;
    return shippingCostPennies;
  }, [shippingEnabled, subtotalPennies, freeOverPennies, shippingCostPennies]);

  const totalPennies = useMemo(
    () => Math.max(0, subtotalPennies + deliveryPennies),
    [subtotalPennies, deliveryPennies]
  );

  /** ---------------- Cart lines from provider ---------------- */
  const list: CartLine[] = useMemo(() => {
    const arr = Object.values(items || {}) as any[];
    return arr.map((it) => ({
      productId: String(it.productId),
      dealId: it.dealId ?? null,
      name: it.name ?? null,
      image: it.image ?? null,
      qty: clampInt(it.qty, 1, 999),
      unitPricePennies: clampInt(it.unitPricePennies, 0, 10_000_000),
    }));
  }, [items]);

  /** ---------------- Fetch missing product details ---------------- */
  const [productById, setProductById] = useState<Record<string, ProductDTO>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();

    const idsToFetch = Array.from(new Set(list.map((l) => l.productId).filter(Boolean))).filter(
      (id) => !productById[id] && !fetchedRef.current.has(id)
    );

    if (!idsToFetch.length) return;

    (async () => {
      for (const id of idsToFetch) {
        fetchedRef.current.add(id);
        const p = await fetchProductById(id, controller.signal);
        if (!p) continue;
        setProductById((prev) => ({ ...prev, [id]: p }));
      }
    })();

    return () => controller.abort();
  }, [list, productById]);

  /** ---------------- Qty input state ---------------- */
  const [rawByKey, setRawByKey] = useState<Record<string, string>>({});

  useEffect(() => {
    setRawByKey((prev) => {
      const next = { ...prev };

      for (const it of list) {
        const k = lineKey(it);
        if (next[k] == null) next[k] = String(it.qty ?? 1);
      }

      for (const k of Object.keys(next)) {
        const exists = list.some((it) => lineKey(it) === k);
        if (!exists) delete next[k];
      }

      return next;
    });
  }, [list]);

  function commitQty(k: string, productId: string, dealId: string | null) {
    const raw = (rawByKey[k] ?? "").trim();
    const nextQty = raw === "" ? 1 : clampInt(Number(raw), 1, 999);
    setQty(productId, dealId ?? null, nextQty);
    setRawByKey((prev) => ({ ...prev, [k]: String(nextQty) }));
  }

  function bumpQty(k: string, productId: string, dealId: string | null, currentQty: number, delta: number) {
    const nextQty = clampInt(currentQty + delta, 1, 999);
    setQty(productId, dealId ?? null, nextQty);
    setRawByKey((prev) => ({ ...prev, [k]: String(nextQty) }));
  }

  /** ---------------- Delivery form state ---------------- */
  const [recipientName, setRecipientName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [safeplace, setSafeplace] = useState<Safeplace>(SAFEPLACES[0]);
  const [deliveryNotes, setDeliveryNotes] = useState("");

  const [useRecipientForReceipt, setUseRecipientForReceipt] = useState(true);
  const [payerEmail, setPayerEmail] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DELIVERY_FORM_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);

      if (typeof obj?.recipientName === "string") setRecipientName(obj.recipientName);
      if (typeof obj?.companyName === "string") setCompanyName(obj.companyName);
      if (typeof obj?.recipientEmail === "string") setRecipientEmail(obj.recipientEmail);
      if (typeof obj?.recipientPhone === "string") setRecipientPhone(obj.recipientPhone);
      if (typeof obj?.deliveryNotes === "string") setDeliveryNotes(obj.deliveryNotes);

      if (typeof obj?.safeplace === "string" && (SAFEPLACES as readonly string[]).includes(obj.safeplace)) {
        setSafeplace(obj.safeplace as Safeplace);
      }

      if (typeof obj?.useRecipientForReceipt === "boolean") setUseRecipientForReceipt(obj.useRecipientForReceipt);
      if (typeof obj?.payerEmail === "string") setPayerEmail(obj.payerEmail);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        DELIVERY_FORM_KEY,
        JSON.stringify({
          recipientName,
          companyName,
          recipientEmail,
          recipientPhone,
          safeplace,
          deliveryNotes,
          useRecipientForReceipt,
          payerEmail,
        })
      );
    } catch {}
  }, [
    recipientName,
    companyName,
    recipientEmail,
    recipientPhone,
    safeplace,
    deliveryNotes,
    useRecipientForReceipt,
    payerEmail,
  ]);

  useEffect(() => {
    if (useRecipientForReceipt) setPayerEmail(clean(recipientEmail));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useRecipientForReceipt]);

  const deliveryErrors = useMemo(() => {
    const errs: string[] = [];
    const nameOk = !!clean(recipientName) || !!clean(companyName);
    const recipientOk = looksLikeEmail(recipientEmail);
    const payerOk = useRecipientForReceipt ? true : looksLikeEmail(payerEmail);

    if (!nameOk) errs.push("Recipient name or company name is required.");
    if (!recipientOk) errs.push("Recipient email is required.");
    if (!payerOk) errs.push("Receipt email is required (or tick ‘use recipient email’).");

    return errs;
  }, [recipientName, companyName, recipientEmail, payerEmail, useRecipientForReceipt]);

  const canCheckout = list.length > 0 && deliveryErrors.length === 0 && !checkingOut;

  // ✅ qty function for upsell (cart mode)
  const getSuggestionQty = (productId: string) => {
    const k = keyOf(productId, null);
    return Number(items?.[k]?.qty ?? 0);
  };

  async function checkoutCart() {
    if (checkingOut) return;
    if (!list.length) return;

    if (deliveryErrors.length) {
      alert(deliveryErrors[0]);
      return;
    }

    try {
      setCheckingOut(true);

      const payerEmailToSend = useRecipientForReceipt ? clean(recipientEmail) : clean(payerEmail);

      const payload = {
        items: list.map((it) => ({
          productId: it.productId,
          dealId: it.dealId ?? null,
          qty: clampInt(it.qty, 1, 999),
        })),
        delivery: {
          name: clean(recipientName),
          company: clean(companyName),
          email: clean(recipientEmail),
          phone: clean(recipientPhone),
          safePlace: safeplace,
          notes: clean(deliveryNotes),
        },
        payerEmail: payerEmailToSend,
      };

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        alert(data?.error || "Cart checkout failed");
        return;
      }

      if (data?.id) {
        try {
          localStorage.setItem(LAST_CHECKOUT_SESSION_KEY, String(data.id));
        } catch {}
      }

      if (data?.orderId) {
        try {
          localStorage.setItem(LAST_ORDER_ID_KEY, String(data.orderId));
        } catch {}
      }

      const url = data?.url;
      if (typeof url === "string" && url) {
        window.location.href = url;
        return;
      }

      alert("Checkout link not returned");
    } catch (err: any) {
      alert(err?.message || "Cart checkout failed");
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F6F8FB] text-[#0B1220]">
      <section className="mx-auto w-full max-w-5xl px-4 sm:px-6 pt-10 pb-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Your Cart</h1>
            <p className="mt-1 text-sm text-black/60">
              {count} item{count === 1 ? "" : "s"}
            </p>
          </div>

          <Link
            href="/products"
            className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium hover:bg-black/5 transition"
          >
            Continue shopping
          </Link>
        </div>

        {list.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
            <h2 className="text-lg font-semibold">Your cart is empty</h2>
            <p className="mt-2 text-sm text-black/60">
              Add products from the Products or Weekly Specials sections.
            </p>
            <Link
              href="/products"
              className="mt-4 inline-block rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {list.map((it) => {
              const k = lineKey(it);

              const p = productById[it.productId];
              const displayName = it.name ?? p?.name ?? it.productId;
              const displayImage = it.image ?? p?.image ?? null;
              const unit = (it.unitPricePennies || 0) > 0 ? it.unitPricePennies : p?.pricePennies ?? 0;

              const qty = clampInt(it.qty, 1, 999);
              const lineTotal = unit * qty;
              const raw = rawByKey[k] ?? String(qty);

              return (
                <div key={k} className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm">
                  <div className="flex gap-4">
                    <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-black/[0.03]">
                      {displayImage ? (
                        <Image src={displayImage} alt={displayName} fill className="object-cover" sizes="80px" />
                      ) : null}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{displayName}</div>
                          <div className="mt-1 text-xs text-black/55">Unit: {formatGBPFromPennies(unit)}</div>
                          {it.dealId ? <div className="mt-1 text-[11px] text-black/45">Special applied</div> : null}
                        </div>

                        <button
                          onClick={() => remove(it.productId, it.dealId ?? null)}
                          disabled={checkingOut}
                          className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-medium hover:bg-black/5 transition disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-black/55">Qty</span>

                          <div className="flex h-9 items-center overflow-hidden rounded-full border border-black/15 bg-white">
                            <button
                              type="button"
                              onClick={() => bumpQty(k, it.productId, it.dealId ?? null, qty, -1)}
                              disabled={checkingOut || qty <= 1}
                              className="h-9 w-10 text-black text-lg leading-none hover:bg-black/5 disabled:opacity-40"
                              aria-label="Decrease quantity"
                            >
                              −
                            </button>

                            <input
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={raw}
                              disabled={checkingOut}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "") return setRawByKey((prev) => ({ ...prev, [k]: "" }));
                                if (!isDigitsOnly(v)) return;
                                setRawByKey((prev) => ({ ...prev, [k]: v }));
                              }}
                              onBlur={() => commitQty(k, it.productId, it.dealId ?? null)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                                if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  bumpQty(k, it.productId, it.dealId ?? null, qty, +1);
                                }
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  bumpQty(k, it.productId, it.dealId ?? null, qty, -1);
                                }
                              }}
                              className="h-9 w-16 bg-transparent text-center text-sm font-semibold text-black outline-none"
                              aria-label="Quantity"
                            />

                            <button
                              type="button"
                              onClick={() => bumpQty(k, it.productId, it.dealId ?? null, qty, +1)}
                              disabled={checkingOut}
                              className="h-9 w-10 text-black text-lg leading-none hover:bg-black/5 disabled:opacity-40"
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="text-sm font-extrabold">{formatGBPFromPennies(lineTotal)}</div>
                      </div>

                      <div className="mt-3">
                        <Link
                          href={`/products/${it.productId}`}
                          className="text-xs font-medium underline text-black/70 hover:text-black"
                        >
                          View product
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* ✅ ONE progress/breakdown UI only */}
            <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
              <ShippingNotice
                subtotalPennies={subtotalPennies}
                showBreakdown
                ctaHref="/products"
                ctaLabel="Add more products"
              />
            </div>

            {/* ✅ ONE upsell block (cart mode) */}
            <FreeDeliveryUpsell
              subtotalPennies={subtotalPennies}
              excludeProductId={null}
              limit={4}
              showProgress={false} // progress already shown above
              enableConfetti={true}
              onAdd={(s) =>
                addItem(
                  {
                    productId: s.id,
                    dealId: null,
                    qty: 1,
                    name: s.name,
                    image: s.image ?? null,
                    unitPricePennies: s.pricePennies,
                  },
                  99
                )
              }
              getQty={getSuggestionQty}
            />

            {/* Multi-buy discount tiers */}
            <MultiBuyBanner cartPennies={subtotalPennies} />

            {/* Next day delivery notice */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
              🚚 Order before 3pm for next day delivery on in-stock items
            </div>

            {/* Totals */}
            <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-black/60">Subtotal</span>
                  <span className="font-semibold">{formatGBPFromPennies(subtotalPennies)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-black/60">Delivery</span>
                  <span className="text-base font-extrabold">
                    {!shippingEnabled ? "£0.00" : subtotalPennies >= freeOverPennies ? "£0.00" : formatGBPFromPennies(shippingCostPennies)}
                  </span>
                </div>

                <div className="my-3 h-px bg-black/10" />

                <div className="flex items-center justify-between">
                  <span className="text-black/60">Total</span>
                  <span className="text-lg font-extrabold">{formatGBPFromPennies(totalPennies)}</span>
                </div>

                {shippingEnabled ? (
                  <div className="text-xs text-black/55">
                    Free delivery over <span className="font-semibold">{formatGBPFromPennies(freeOverPennies)}</span>
                  </div>
                ) : (
                  <div className="text-xs text-black/55">Delivery pricing currently disabled.</div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={clear}
                  disabled={checkingOut}
                  className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium hover:bg-black/5 transition disabled:opacity-50"
                >
                  Clear cart
                </button>

                <button
                  onClick={checkoutCart}
                  disabled={!canCheckout}
                  className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {checkingOut ? "Starting checkout…" : "Checkout"}
                </button>
              </div>

              <p className="mt-3 text-xs text-black/45">
                You’ll be redirected to Stripe Checkout to complete payment.
              </p>
            </div>

            {/* Delivery details */}
            <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
              <div>
                <div className="text-lg font-extrabold">Delivery details</div>
                <div className="mt-1 text-xs text-black/55">
                  Recipient name or company name is required. Recipient email is required.
                </div>
              </div>

              {deliveryErrors.length ? (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {deliveryErrors[0]}
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold">Recipient name</label>
                  <input
                    className="mt-1 w-full rounded-2xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-black/30"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Tim Wright"
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold">Or company name</label>
                  <input
                    className="mt-1 w-full rounded-2xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-black/30"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Signal Labs"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold">Recipient email (tracking/updates)</label>
                  <input
                    className="mt-1 w-full rounded-2xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-black/30"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="e.g. you@email.com"
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold">Recipient phone number</label>
                  <input
                    className="mt-1 w-full rounded-2xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-black/30"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="optional"
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>

                <div className="sm:col-span-2 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                  <div className="text-sm font-semibold">Receipt email (Stripe)</div>

                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={useRecipientForReceipt}
                      onChange={(e) => setUseRecipientForReceipt(e.target.checked)}
                    />
                    Use recipient email for receipt
                  </label>

                  {!useRecipientForReceipt ? (
                    <div className="mt-3">
                      <label className="text-sm font-semibold">Receipt email</label>
                      <input
                        className="mt-1 w-full rounded-2xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-black/30"
                        value={payerEmail}
                        onChange={(e) => setPayerEmail(e.target.value)}
                        placeholder="e.g. buyer@email.com"
                        autoComplete="email"
                        inputMode="email"
                      />
                    </div>
                  ) : null}
                </div>

                <div className="sm:col-span-2">
                  <label className="text-sm font-semibold">Safeplace for delivery (if you’re not in)</label>
                  <select
                    className="mt-1 w-full rounded-2xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-black/30"
                    value={safeplace}
                    onChange={(e) => setSafeplace(e.target.value as Safeplace)}
                  >
                    {SAFEPLACES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-sm font-semibold">Delivery notes (optional)</label>
                  <textarea
                    className="mt-1 w-full rounded-2xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-black/30"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    rows={3}
                    placeholder="e.g. ring doorbell / side gate is open"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}