// app/_components/BuyNowButton.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import ShippingNotice from "@/app/_components/ShippingNotice";
import FreeDeliveryUpsell from "@/app/_components/FreeDeliveryUpsell";
import { useCart } from "@/app/_components/CartProvider";

type Props = {
  productId: string;
  dealId?: string | null;
  qty: number;

  name: string;
  unitPricePennies: number;

  disabled?: boolean;
  label?: string;
  className?: string;
  maxQty?: number;

  isLoggedIn?: boolean;
  loginHref?: string;
  rememberGuestChoice?: boolean;
};

const MAX_QTY_UI = 9999;

const SAFEPLACES = [
  "No Safeplace (Someone will be at the property)",
  "Enclosed porch",
  "Shed",
  "Reception",
  "Garage",
  "Outbuilding",
  "Other",
] as const;

const DELIVERY_FORM_KEY = "signal_delivery_form_v2";
const LAST_CHECKOUT_SESSION_KEY = "signal_last_checkout_session_id";
const LAST_ORDER_ID_KEY = "signal_last_order_id";
const GUEST_SKIP_KEY = "sl_skip_login_prompt_v1";

type Safeplace = (typeof SAFEPLACES)[number];

type QuickExtra = {
  productId: string;
  name: string;
  image: string | null;
  unitPricePennies: number;
  qty: number;
};

function toInt(n: unknown, fallback = 0) {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function clampInt(n: unknown, min: number, max: number) {
  return Math.min(max, Math.max(min, toInt(n, min)));
}

function clampQty(n: unknown, min = 1, max = 99) {
  return clampInt(n, min, max);
}

function formatGBPFromPennies(p: number) {
  const safe = Number.isFinite(p) ? p : 0;
  return `£${(safe / 100).toFixed(2)}`;
}

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function looksLikeEmail(s: string) {
  const v = clean(s).toLowerCase();
  return v.includes("@") && v.includes(".") && v.length >= 5;
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function BuyNowButton({
  productId,
  dealId = null,
  qty,
  name,
  unitPricePennies,
  disabled = false,
  label = "Buy",
  className = "",
  maxQty,
  isLoggedIn,
  loginHref,
  rememberGuestChoice = true,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  // ✅ read-only cart preview (does NOT get modified by quick buy)
  const cart = useCart();

  const [busy, setBusy] = useState(false);

  const [promptOpen, setPromptOpen] = useState(false);
  const [loginKnown, setLoginKnown] = useState<boolean | null>(
    typeof isLoggedIn === "boolean" ? isLoggedIn : null
  );

  const [detailsOpen, setDetailsOpen] = useState(false);

  const [recipientName, setRecipientName] = useState("");
  const [companyName, setCompanyName] = useState("");

  const [trackingEmail, setTrackingEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [safeplace, setSafeplace] = useState<Safeplace>(SAFEPLACES[0]);
  const [deliveryNotes, setDeliveryNotes] = useState("");

  const [useTrackingForReceipt, setUseTrackingForReceipt] = useState(true);
  const [receiptEmail, setReceiptEmail] = useState("");

  // ✅ quick-buy-only extras
  const [extraItems, setExtraItems] = useState<Record<string, QuickExtra>>({});

  useEffect(() => {
    const open = promptOpen || detailsOpen;
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [promptOpen, detailsOpen]);

  const cap = useMemo(() => {
    const stockCap =
      typeof maxQty === "number" && Number.isFinite(maxQty) && maxQty > 0 ? maxQty : MAX_QTY_UI;
    return clampInt(stockCap, 1, MAX_QTY_UI);
  }, [maxQty]);

  const safeQty = useMemo(() => clampInt(qty, 1, cap), [qty, cap]);

  const displayUnit =
    Number.isFinite(unitPricePennies) && unitPricePennies > 0 ? unitPricePennies : null;

  const baseSubtotalPennies = useMemo(() => {
    if (!displayUnit) return 0;
    return Math.max(0, displayUnit * safeQty);
  }, [displayUnit, safeQty]);

  const extrasSubtotalPennies = useMemo(() => {
    return Object.values(extraItems).reduce((sum, it) => sum + (Number(it.unitPricePennies) || 0) * (Number(it.qty) || 0), 0);
  }, [extraItems]);

  const quickSubtotalPennies = useMemo(() => {
    return Math.max(0, baseSubtotalPennies + extrasSubtotalPennies);
  }, [baseSubtotalPennies, extrasSubtotalPennies]);

  const nextLoginHref = loginHref || `/login?next=${encodeURIComponent(pathname || "/")}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DELIVERY_FORM_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);

      if (typeof obj?.recipientName === "string") setRecipientName(obj.recipientName);
      if (typeof obj?.companyName === "string") setCompanyName(obj.companyName);

      if (typeof obj?.trackingEmail === "string") setTrackingEmail(obj.trackingEmail);
      if (!obj?.trackingEmail && typeof obj?.recipientEmail === "string") setTrackingEmail(obj.recipientEmail);

      if (typeof obj?.recipientPhone === "string") setRecipientPhone(obj.recipientPhone);
      if (typeof obj?.deliveryNotes === "string") setDeliveryNotes(obj.deliveryNotes);

      if (typeof obj?.safeplace === "string" && (SAFEPLACES as readonly string[]).includes(obj.safeplace)) {
        setSafeplace(obj.safeplace as Safeplace);
      }

      if (typeof obj?.useTrackingForReceipt === "boolean") setUseTrackingForReceipt(obj.useTrackingForReceipt);

      if (typeof obj?.receiptEmail === "string") setReceiptEmail(obj.receiptEmail);
      if (!obj?.receiptEmail && typeof obj?.payerEmail === "string") setReceiptEmail(obj.payerEmail);
    } catch {}
  }, []);

  function persistDeliveryForm() {
    try {
      localStorage.setItem(
        DELIVERY_FORM_KEY,
        JSON.stringify({
          recipientName,
          companyName,
          trackingEmail,
          recipientPhone,
          safeplace,
          deliveryNotes,
          useTrackingForReceipt,
          receiptEmail,
        })
      );
    } catch {}
  }

  function shouldSkipPrompt() {
    if (!rememberGuestChoice) return false;
    try {
      return localStorage.getItem(GUEST_SKIP_KEY) === "1";
    } catch {
      return false;
    }
  }

  function setSkipPrompt() {
    if (!rememberGuestChoice) return;
    try {
      localStorage.setItem(GUEST_SKIP_KEY, "1");
    } catch {}
  }

  async function detectLogin(): Promise<boolean> {
    if (typeof isLoggedIn === "boolean") return isLoggedIn;
    if (typeof loginKnown === "boolean") return loginKnown;

    try {
      const res = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" });
      const data = await safeJson(res);
      const ok = Boolean((data as any)?.user);
      setLoginKnown(ok);

      const email = (data as any)?.user?.email;
      if (ok && typeof email === "string" && email) {
        if (!clean(trackingEmail)) setTrackingEmail(email);
        if (!clean(receiptEmail)) setReceiptEmail(email);
      }
      return ok;
    } catch {
      setLoginKnown(false);
      return false;
    }
  }

  function formErrors(isGuest: boolean) {
    const errs: string[] = [];

    const nameOk = !!clean(recipientName) || !!clean(companyName);
    if (!nameOk) errs.push("Recipient name or company name is required.");

    if (isGuest) {
      if (!looksLikeEmail(trackingEmail)) errs.push("Tracking email is required.");
    } else {
      if (clean(trackingEmail) && !looksLikeEmail(trackingEmail)) errs.push("Tracking email looks invalid.");
    }

    const chosenReceipt = clean(useTrackingForReceipt ? trackingEmail : receiptEmail);
    if (!looksLikeEmail(chosenReceipt)) errs.push("Purchase receipt email is required (or use tracking email).");

    return errs;
  }

  function addQuickBuyExtra(s: { id: string; name: string; image: string | null; pricePennies: number }) {
    setExtraItems((prev) => {
      const existing = prev[s.id];
      const nextQty = clampQty((existing?.qty ?? 0) + 1, 1, 99);

      return {
        ...prev,
        [s.id]: {
          productId: s.id,
          name: s.name,
          image: s.image ?? null,
          unitPricePennies: Math.max(0, Math.trunc(Number(s.pricePennies) || 0)),
          qty: nextQty,
        },
      };
    });
  }

  function removeQuickBuyExtra(extraProductId: string) {
    setExtraItems((prev) => {
      if (!prev[extraProductId]) return prev;
      const next = { ...prev };
      delete next[extraProductId];
      return next;
    });
  }

  function getQuickBuyQty(extraProductId: string) {
    return Number(extraItems[extraProductId]?.qty || 0);
  }

  // ✅ build an exclude list so suggestions never show duplicates (base + extras + cart items)
  const excludeIds = useMemo(() => {
  const ids = new Set<string>();
  ids.add(productId);
  for (const x of Object.values(extraItems)) ids.add(x.productId);
  // if you also want to exclude cart items:
  // for (const it of Object.values(cart.items || {})) ids.add(String((it as any).productId));
  return Array.from(ids);
}, [productId, extraItems /*, cart.items*/]);

  async function startCheckout() {
    setBusy(true);
    try {
      persistDeliveryForm();

      const chosenReceiptEmail = clean(useTrackingForReceipt ? trackingEmail : receiptEmail);

      const itemsToSend = [
        { productId, dealId: dealId ?? null, qty: safeQty },
        ...Object.values(extraItems).map((x) => ({
          productId: x.productId,
          dealId: null,
          qty: clampQty(x.qty, 1, 99),
        })),
      ];

      const payload = {
        items: itemsToSend,
        delivery: {
          name: clean(recipientName),
          company: clean(companyName),
          email: clean(trackingEmail),
          phone: clean(recipientPhone),
          safePlace: safeplace,
          notes: clean(deliveryNotes),
        },
        payerEmail: chosenReceiptEmail,
      };

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      const data = await safeJson(res);

      if (!res.ok) {
        const msg = (data as any)?.error || (data as any)?.message || `Checkout failed (${res.status})`;
        throw new Error(msg);
      }

      if ((data as any)?.id) {
        try { localStorage.setItem(LAST_CHECKOUT_SESSION_KEY, String((data as any).id)); } catch {}
      }
      if ((data as any)?.orderId) {
        try { localStorage.setItem(LAST_ORDER_ID_KEY, String((data as any)?.orderId)); } catch {}
      }

      const url = (data as any)?.url;
      if (typeof url === "string" && url.trim()) {
        setExtraItems({});
        window.location.href = url;
        return;
      }

      throw new Error("Checkout link not returned");
    } finally {
      setBusy(false);
    }
  }

  async function onClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || busy) return;

    try {
      const loggedIn = await detectLogin();
      if (loggedIn || shouldSkipPrompt()) {
        setDetailsOpen(true);
        return;
      }
      setPromptOpen(true);
    } catch (err: any) {
      alert(err?.message || "Could not start checkout");
    }
  }

  function closePrompt() {
    if (busy) return;
    setPromptOpen(false);
  }

  function goToLogin() {
    if (busy) return;
    setPromptOpen(false);
    router.push(nextLoginHref);
  }

  function continueAsGuest() {
    if (busy) return;
    setPromptOpen(false);
    setSkipPrompt();
    setDetailsOpen(true);
  }

  function closeDetails() {
    if (busy) return;
    setDetailsOpen(false);
  }

  async function submitDetails() {
    if (busy) return;

    const loggedIn = await detectLogin();
    const errs = formErrors(!loggedIn);
    if (errs.length) return alert(errs[0]);

    try {
      await startCheckout();
    } catch (err: any) {
      alert(err?.message || "Could not start checkout");
    }
  }

  function PriceSummary() {
    return (
      <>
        <div className="text-sm font-semibold text-black">{name || "Item"}</div>
        <div className="mt-1 text-sm text-black/70">
          Qty: {safeQty} • {displayUnit ? `${formatGBPFromPennies(displayUnit)} each` : "Price shown at checkout"}
        </div>

        <div className="mt-2 text-sm font-semibold text-black">
          Base: {displayUnit ? formatGBPFromPennies(displayUnit * safeQty) : "—"}
        </div>

        {extrasSubtotalPennies > 0 ? (
          <div className="mt-1 text-sm font-semibold text-black">
            Add-ons: {formatGBPFromPennies(extrasSubtotalPennies)}
          </div>
        ) : null}

        <div className="mt-2 text-sm font-extrabold text-black">
          Subtotal: {formatGBPFromPennies(quickSubtotalPennies)}
        </div>
      </>
    );
  }

  function swallow(e: React.SyntheticEvent) {
    e.stopPropagation();
  }

  // ✅ cart preview (read-only)
  const cartLines = useMemo(() => Object.values(cart.items || {}), [cart.items]);

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || busy}
        className={
          className ||
          "h-10 w-full rounded-full bg-black px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        }
      >
        {busy ? "…" : label}
      </button>

      {promptOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Sign in or continue as guest"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePrompt();
          }}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-black">Sign in for faster checkout?</h3>
                <p className="mt-1 text-sm text-black/70">Continue as a guest, or sign in to use your account.</p>
              </div>
              <button
                type="button"
                onClick={closePrompt}
                className="rounded-full px-3 py-1 text-sm font-semibold text-black/70 hover:bg-black/5"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
              <PriceSummary />
            </div>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={goToLogin}
                disabled={busy}
                className="h-11 w-full rounded-full bg-black px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                Sign in
              </button>

              <button
                type="button"
                onClick={continueAsGuest}
                disabled={busy}
                className="h-11 w-full rounded-full border border-black/15 bg-white px-4 text-sm font-semibold text-black transition hover:bg-black/5 disabled:opacity-50"
              >
                Continue as guest
              </button>

              <p className="text-center text-xs text-black/60">
                Guest checkout is quick — you can still create an account later.
              </p>
            </div>
          </div>
        </div>
      )}

      {detailsOpen && (
        <div className="fixed inset-0 z-[1100]" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={closeDetails} />

          <div className="absolute inset-0 flex items-start justify-center p-4 py-8">
            <div
              className="relative w-full max-w-xl rounded-3xl bg-white shadow-xl max-h-[90dvh] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
              onClick={swallow}
              onMouseDown={swallow}
              onPointerDown={swallow}
              onTouchStart={swallow}
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-black">Delivery details</h3>
                    <p className="mt-1 text-sm text-black/70">
                      We’ll save these to your order. Stripe will still ask for the delivery address.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeDetails}
                    className="rounded-full px-3 py-1 text-sm font-semibold text-black/70 hover:bg-black/5"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                  <PriceSummary />
                </div>

                {/* ✅ NEW: show what's already in cart (read-only) */}
                {cart.count > 0 ? (
                  <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
                    <div className="text-sm font-extrabold text-black">Your cart (separate)</div>
                    <div className="mt-1 text-xs text-black/60">
                      These won’t be included in this quick checkout.
                    </div>

                    <div className="mt-3 grid gap-2">
                      {cartLines.slice(0, 6).map((it: any) => (
                        <div key={cart.keyOf(it.productId, it.dealId ?? null)} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{it.name || it.productId}</div>
                            <div className="text-xs text-black/60">
                              Qty {it.qty}
                              {Number(it.unitPricePennies) > 0 ? ` • ${formatGBPFromPennies(it.unitPricePennies)}` : ""}
                            </div>
                          </div>
                          <div className="text-xs font-semibold text-black/60">In cart</div>
                        </div>
                      ))}
                      {cartLines.length > 6 ? (
                        <div className="text-xs text-black/60">…and {cartLines.length - 6} more</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {/* ✅ ONE progress block */}
                <div className="mt-4">
                  <ShippingNotice subtotalPennies={quickSubtotalPennies} showBreakdown />
                </div>

                {/* ✅ suggestions for quick buy (no progress UI), excludes base/extras/cart */}
                <div className="mt-3">
                  <FreeDeliveryUpsell
                    subtotalPennies={quickSubtotalPennies}
                    excludeProductId={excludeIds[0] ?? productId}
                    limit={4}
                    showProgress={false}
                    enableConfetti={false}
                    onAdd={(s) =>
                      addQuickBuyExtra({
                        id: s.id,
                        name: s.name,
                        image: s.image ?? null,
                        pricePennies: s.pricePennies,
                      })
                    }
                    getQty={(id) => getQuickBuyQty(id)}
                  />
                </div>

                {/* ✅ quick checkout list = base + add-ons */}
                <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                  <div className="text-sm font-semibold text-black">This quick checkout includes</div>

                  <div className="mt-3 grid gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{name}</div>
                        <div className="text-xs text-black/60">
                          {safeQty} × {displayUnit ? formatGBPFromPennies(displayUnit) : "—"}
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-black/60">Base</div>
                    </div>

                    {Object.values(extraItems).map((x) => (
                      <div key={x.productId} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{x.name}</div>
                          <div className="text-xs text-black/60">
                            {x.qty} × {formatGBPFromPennies(x.unitPricePennies)}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeQuickBuyExtra(x.productId)}
                          disabled={busy}
                          className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-black/5 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ---- form fields (unchanged) ---- */}
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-black">Recipient name</label>
                    <input
                      className="mt-1 w-full rounded-2xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-black/30"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="e.g. Tim Wright"
                      autoComplete="name"
                      disabled={busy}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-black">Or company name</label>
                    <input
                      className="mt-1 w-full rounded-2xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-black/30"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Signal Labs"
                      disabled={busy}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-black">Tracking email (order updates)</label>
                    <input
                      className="mt-1 w-full rounded-2xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-black/30"
                      value={trackingEmail}
                      onChange={(e) => setTrackingEmail(e.target.value)}
                      placeholder="e.g. recipient@email.com"
                      autoComplete="email"
                      inputMode="email"
                      disabled={busy}
                    />
                    <div className="mt-1 text-xs text-black/60">We’ll send dispatch + tracking updates to this email.</div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-black">Recipient phone</label>
                    <input
                      className="mt-1 w-full rounded-2xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-black/30"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="optional"
                      autoComplete="tel"
                      inputMode="tel"
                      disabled={busy}
                    />
                  </div>

                  <div className="sm:col-span-2 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                    <div className="text-sm font-semibold text-black">Purchase receipt email</div>

                    <label className="mt-3 flex items-center gap-2 text-sm text-black">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={useTrackingForReceipt}
                        onChange={(e) => setUseTrackingForReceipt(e.target.checked)}
                        disabled={busy}
                      />
                      Use tracking email for the receipt
                    </label>

                    {!useTrackingForReceipt ? (
                      <div className="mt-3">
                        <label className="text-sm font-semibold text-black">Receipt email</label>
                        <input
                          className="mt-1 w-full rounded-2xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-black/30"
                          value={receiptEmail}
                          onChange={(e) => setReceiptEmail(e.target.value)}
                          placeholder="e.g. buyer@email.com"
                          autoComplete="email"
                          inputMode="email"
                          disabled={busy}
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-sm font-semibold text-black">Safeplace for delivery (if you’re not in)</label>
                    <select
                      className="mt-1 w-full rounded-2xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-black/30"
                      value={safeplace}
                      onChange={(e) => setSafeplace(e.target.value as Safeplace)}
                      disabled={busy}
                    >
                      {SAFEPLACES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-sm font-semibold text-black">Delivery notes (optional)</label>
                    <textarea
                      className="mt-1 w-full rounded-2xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-black/30"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      rows={3}
                      placeholder="e.g. ring doorbell / side gate is open"
                      disabled={busy}
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={closeDetails}
                    disabled={busy}
                    className="h-11 rounded-full border border-black/15 bg-white px-5 text-sm font-semibold text-black hover:bg-black/5 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={submitDetails}
                    disabled={busy}
                    className="h-11 rounded-full bg-black px-6 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? "Starting…" : "Continue to Stripe Checkout"}
                  </button>
                </div>

                <p className="mt-3 text-xs text-black/45">You’ll be redirected to Stripe Checkout to complete payment.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}