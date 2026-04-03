"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";

type Suggestion = {
  id: string;
  name: string;
  image: string | null;
  pricePennies: number;
  stock: number;
};

/**
 * /api/suggestions/free-delivery response
 * (keep it permissive because you’ve had a few variants over time)
 */
type SuggestionsResponse = {
  ok?: boolean;
  enabled?: boolean;
  remainingPennies?: number;
  suggestions?: Suggestion[];
  freeOverPennies?: number;
  flatRatePennies?: number;
  shippingCostPennies?: number;
};

/**
 * /api/settings/shipping response(s)
 * You may return either:
 *  A) { enabled, freeOverPennies, flatRatePennies, ... }
 *  B) { ok: true, settings: { enabled, freeOverPennies, ... } }
 */
type ShippingSettingsCore = {
  enabled?: boolean;
  freeOverPennies?: number;
  flatRatePennies?: number;
  shippingCostPennies?: number;
};

type ShippingSettingsResponse =
  | ShippingSettingsCore
  | { ok?: boolean; settings?: ShippingSettingsCore };

function gbp(pennies: number) {
  const safe = Number.isFinite(pennies) ? pennies : 0;
  return `£${(safe / 100).toFixed(2)}`;
}

function asInt(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(String(v ?? ""));
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function unwrapShipping(resp: ShippingSettingsResponse | null): ShippingSettingsCore | null {
  if (!resp) return null;
  if (typeof (resp as any)?.settings === "object" && (resp as any).settings) {
    return (resp as any).settings as ShippingSettingsCore;
  }
  return resp as ShippingSettingsCore;
}

/**
 * Resolve shipping values from any mix of old/new endpoints:
 * - prefers explicit values from suggestions endpoint (a)
 * - falls back to shipping settings endpoint (b)
 * - supports old names: freeOverPennies, enabled, shippingCostPennies
 */
function pickShippingNumbers(a: SuggestionsResponse | null, bWrapped: ShippingSettingsResponse | null) {
  const b = unwrapShipping(bWrapped);

  const enabled =
    Boolean(
      a?.enabled ??
        (a as any)?.enabled ??
        b?.enabled ??
        (b as any)?.enabled ??
        true
    ) || false;

  const freeOver =
    asInt(
      a?.freeOverPennies ??
        a?.freeOverPennies ??
        (a as any)?.freeOverPennies ??
        b?.freeOverPennies ??
        b?.freeOverPennies ??
        3000,
      3000
    ) || 3000;

  const shipCost =
    asInt(
      a?.shippingCostPennies ??
        a?.flatRatePennies ??
        b?.shippingCostPennies ??
        b?.flatRatePennies ??
        499,
      499
    ) || 499;

  return {
    enabled,
    freeOverPennies: Math.max(0, freeOver),
    shippingCostPennies: Math.max(0, shipCost),
  };
}

function dedupeById(list: Suggestion[]) {
  const map = new Map<string, Suggestion>();
  for (const s of list) {
    const id = String(s?.id ?? "").trim();
    if (!id) continue;
    if (!map.has(id)) map.set(id, s);
  }
  return Array.from(map.values());
}

type Props = {
  subtotalPennies: number;
  excludeProductId?: string | null;
  limit?: number;
  variant?: "cards" | "chips";

  /** If false, hides header/progress UI */
  showProgress?: boolean;

  /** Defaults: true */
  enableConfetti?: boolean;

  /** REQUIRED: how to add an item */
  onAdd: (s: Suggestion) => void;

  /** Optional: quick-buy qty getter (for "(Added x)" display). */
  getQty?: (productId: string) => number;
};

export default function FreeDeliveryUpsell({
  subtotalPennies,
  excludeProductId,
  limit = 4,
  variant = "cards",
  showProgress = true,
  enableConfetti = true,
  onAdd,
  getQty,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  // shipping display numbers
  const [shipEnabled, setShipEnabled] = useState(true);
  const [freeOverPennies, setFreeOverPennies] = useState(3000);
  const [shippingCostPennies, setShippingCostPennies] = useState(499);

  // UI feedback
  const [addedId, setAddedId] = useState<string | null>(null);
  const addedTimerRef = useRef<number | null>(null);

  // Prevent out-of-order fetches overwriting state
  const reqRef = useRef(0);

  useEffect(() => {
    return () => {
      if (addedTimerRef.current) window.clearTimeout(addedTimerRef.current);
    };
  }, []);

  const safeSubtotal = useMemo(
    () => Math.max(0, Math.trunc(Number(subtotalPennies) || 0)),
    [subtotalPennies]
  );

  const qp = useMemo(() => {
    const qs = new URLSearchParams({
      subtotalPennies: String(safeSubtotal),
      limit: String(limit),
    });
    if (excludeProductId) qs.set("excludeProductId", String(excludeProductId));
    return qs.toString();
  }, [safeSubtotal, limit, excludeProductId]);

  useEffect(() => {
    let cancelled = false;
    const myReq = ++reqRef.current;

    async function load() {
      setLoading(true);
      try {
        const [res, shipRes] = await Promise.all([
          fetch(`/api/suggestions/free-delivery?${qp}`, { cache: "no-store" }),
          fetch(`/api/settings/shipping`, { cache: "no-store" }),
        ]);

        const json = (await res.json().catch(() => null)) as SuggestionsResponse | null;
        const shipJson = (await shipRes.json().catch(() => null)) as ShippingSettingsResponse | null;

        if (cancelled) return;
        if (myReq !== reqRef.current) return;

        // Suggestions
        const ok = Boolean(res.ok && json && (json.ok ?? true));
        if (!ok) {
          setSuggestions([]);
        } else {
          const list = Array.isArray(json?.suggestions) ? json!.suggestions! : [];
          const filtered = excludeProductId ? list.filter((s) => s.id !== excludeProductId) : list;
          setSuggestions(dedupeById(filtered));
        }

        // Shipping
        const picked = pickShippingNumbers(json, shipJson);
        setShipEnabled(Boolean(picked.enabled));
        setFreeOverPennies(Math.max(0, Math.trunc(picked.freeOverPennies)));
        setShippingCostPennies(Math.max(0, Math.trunc(picked.shippingCostPennies)));
      } finally {
        if (!cancelled && myReq === reqRef.current) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [qp, excludeProductId]);

  // Derived state
  const remainingToFree = Math.max(0, freeOverPennies - safeSubtotal);
  const alreadyFree = remainingToFree <= 0;

  const progressPct =
    freeOverPennies > 0
      ? Math.max(0, Math.min(100, (safeSubtotal / freeOverPennies) * 100))
      : 0;

  // Confetti: fire once when crossing threshold
  const prevFreeRef = useRef<boolean>(false);
  useEffect(() => {
    if (!enableConfetti) {
      prevFreeRef.current = alreadyFree;
      return;
    }

    const justUnlocked = alreadyFree && !prevFreeRef.current;

    if (justUnlocked) {
      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

      if (!reduceMotion) {
        confetti({
          particleCount: 140,
          spread: 80,
          startVelocity: 42,
          origin: { y: 0.35 },
          ticks: 220,
        });
        window.setTimeout(() => {
          confetti({
            particleCount: 90,
            spread: 110,
            startVelocity: 34,
            origin: { y: 0.35 },
            ticks: 200,
          });
        }, 180);
      }
    }

    prevFreeRef.current = alreadyFree;
  }, [alreadyFree, enableConfetti]);

  // Hide if shipping disabled
  if (!shipEnabled) return null;

  function flashAdded(id: string) {
    setAddedId(id);
    if (addedTimerRef.current) window.clearTimeout(addedTimerRef.current);
    addedTimerRef.current = window.setTimeout(() => setAddedId(null), 900) as unknown as number;
  }

  function qty(id: string) {
    if (typeof getQty !== "function") return 0;
    return Math.max(0, Math.trunc(Number(getQty(id) || 0)));
  }

  function onAddClick(e: React.SyntheticEvent, s: Suggestion) {
    e.preventDefault();
    e.stopPropagation();
    flashAdded(s.id);
    onAdd(s); // ✅ pure callback only
  }

  const showSuggestions = !alreadyFree;

  return (
    <div className="mt-3 rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
      {/* HEADER / PROGRESS */}
      {showProgress ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full bg-black px-4 py-1 font-extrabold tracking-wide text-white">
              Delivery {gbp(shippingCostPennies)}
            </div>

            <div className="text-sm font-semibold text-black/60">Free over</div>

            <div className="rounded-full bg-emerald-100 px-4 py-1 font-extrabold tracking-wide text-emerald-800">
              {gbp(freeOverPennies)}
            </div>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full bg-emerald-500 transition-all duration-700 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {!alreadyFree ? (
            <div className="text-[17px] font-extrabold leading-snug">
              Spend <span className="underline underline-offset-2">{gbp(remainingToFree)}</span> more to unlock{" "}
              <span className="text-emerald-700">FREE delivery</span>
            </div>
          ) : (
            <div className="animate-pulse text-[17px] font-extrabold text-emerald-700">
              ✅ You’ve unlocked FREE delivery
            </div>
          )}
        </div>
      ) : null}

      {/* SUGGESTIONS */}
      {showSuggestions ? (
        <div className={showProgress ? "mt-5" : ""}>
          {loading ? (
            <div className="text-sm font-semibold text-black/50">Finding add-ons…</div>
          ) : suggestions.length ? (
            variant === "chips" ? (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => {
                  const q = qty(s.id);
                  const label =
                    q > 0
                      ? `✅ Added (${q})`
                      : addedId === s.id
                        ? "✅ Added"
                        : `+ ${s.name} (${gbp(s.pricePennies)})`;

                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={(e) => onAddClick(e, s)}
                      className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-extrabold hover:bg-black/5"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {suggestions.map((s) => {
                  const q = qty(s.id);
                  const buttonLabel = q > 0 ? `Added (${q})` : addedId === s.id ? "Added" : "+ Add";

                  return (
                    <div key={s.id} className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black/[0.03]">
                        {s.image ? (
                          <Image
                            src={s.image}
                            alt={s.name}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 50vw, 25vw"
                          />
                        ) : null}
                      </div>

                      <div className="mt-2">
                        <div className="line-clamp-2 text-sm font-extrabold text-black">{s.name}</div>
                        <div className="mt-1 text-sm font-bold text-black/80">{gbp(s.pricePennies)}</div>

                        <button
                          type="button"
                          onClick={(e) => onAddClick(e, s)}
                          className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-full border border-black/15 bg-white text-sm font-extrabold hover:bg-black/5"
                        >
                          {buttonLabel}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-sm font-semibold text-black/50">
              No add-ons right now —{" "}
              <Link href="/products" className="font-extrabold text-black underline">
                browse products
              </Link>
            </div>
          )}

          <div className="mt-4 text-xs font-semibold text-black/50">
            Tip: add-ons go wherever this button is wired (quick checkout vs cart).
          </div>
        </div>
      ) : null}
    </div>
  );
}