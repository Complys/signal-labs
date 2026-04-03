// app/_components/ShippingNotice.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

/* =========================
   Types
========================= */

type ShippingSettings = {
  freeOverPennies: number;
  flatRatePennies: number;
  enabled: boolean;
};

type Props = {
  subtotalPennies: number;
  showBreakdown?: boolean;

  ctaHref?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
};

/* =========================
   Helpers
========================= */

function clampInt(n: unknown, min: number, max: number) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.trunc(v)));
}

function clampPennies(n: unknown) {
  return clampInt(n, 0, 1_000_000_000);
}

function fmtGBP(pennies: number) {
  const p = Number.isFinite(pennies) ? pennies : 0;
  return `£${(p / 100).toFixed(2)}`;
}

/* =========================
   Tiny in-memory cache
========================= */

let _cache: { at: number; settings: ShippingSettings } | null = null;
const CACHE_MS = 30_000;

function normalizeShippingSettings(json: any): ShippingSettings | null {
  const raw = json?.settings ?? json;
  if (!raw) return null;

  const enabled = !!raw.enabled;
  const freeOverPennies = clampPennies(raw.freeOverPennies ?? raw.freeOverPennies ?? 3000);
  const flatRatePennies = clampPennies(raw.flatRatePennies ?? raw.shippingCostPennies ?? 499);

  return { enabled, freeOverPennies, flatRatePennies };
}

async function fetchShippingSettings(): Promise<ShippingSettings | null> {
  try {
    if (_cache && Date.now() - _cache.at < CACHE_MS) return _cache.settings;

    const res = await fetch("/api/settings/shipping", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) return null;

    const settings = normalizeShippingSettings(json);
    if (!settings) return null;

    _cache = { at: Date.now(), settings };
    return settings;
  } catch {
    return null;
  }
}

/* =========================
   Component
========================= */

export default function ShippingNotice({
  subtotalPennies,
  showBreakdown = true,
  ctaHref,
  ctaLabel = "Add more products",
  onCtaClick,
}: Props) {
  const [settings, setSettings] = useState<ShippingSettings | null>(null);
  const [loaded, setLoaded] = useState(false);

  const prevIsFreeRef = useRef<boolean>(false);
  const [justUnlocked, setJustUnlocked] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      const s = await fetchShippingSettings();
      if (!alive) return;
      if (s) setSettings(s);
      setLoaded(true);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const calc = useMemo(() => {
    if (!settings) return null;

    const sub = clampPennies(subtotalPennies);
    const threshold = clampPennies(settings.freeOverPennies);
    const flat = clampPennies(settings.flatRatePennies);
    const enabled = settings.enabled;

    if (!enabled || threshold <= 0) {
      return { enabled, sub, threshold, flat, isFree: true, shipping: 0, remaining: 0, progress: 100 };
    }

    const isFree = sub >= threshold;
    const remaining = isFree ? 0 : Math.max(0, threshold - sub);
    const shipping = isFree ? 0 : flat;
    const progress = Math.max(0, Math.min(100, Math.round((sub / threshold) * 100)));

    return { enabled, sub, threshold, flat, isFree, shipping, remaining, progress };
  }, [settings, subtotalPennies]);

  useEffect(() => {
    if (!calc) return;

    const prev = prevIsFreeRef.current;
    prevIsFreeRef.current = calc.isFree;

    if (!prev && calc.isFree) {
      setJustUnlocked(true);
      const t = window.setTimeout(() => setJustUnlocked(false), 900);
      return () => window.clearTimeout(t);
    }
  }, [calc?.isFree]);

  if (!calc) {
    if (!loaded) {
      return (
        <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-black/50">
          Loading delivery…
        </div>
      );
    }
    return null;
  }

  const total = calc.sub + calc.shipping;

  const title = !calc.enabled
    ? "✅ Free delivery"
    : calc.isFree
    ? "✅ Free delivery unlocked"
    : `🚚 Spend ${fmtGBP(calc.remaining)} more to get FREE delivery`;

  const desc = !calc.enabled
    ? "Delivery is currently FREE on all orders."
    : calc.isFree
    ? `You’ve qualified for FREE delivery (over ${fmtGBP(calc.threshold)}).`
    : `Delivery is ${fmtGBP(calc.flat)} under ${fmtGBP(calc.threshold)}.`;

  const bannerClasses = [
    "relative rounded-2xl border px-4 py-3 text-sm",
    "transition-all duration-300 ease-out",
    !calc.enabled || calc.isFree
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-amber-200 bg-amber-50 text-amber-900",
    justUnlocked ? "ring-2 ring-emerald-300 animate-[pulse_0.9s_ease-out_1]" : "",
  ].join(" ");

  return (
    <div>
      <div className={bannerClasses} role="status" aria-live="polite">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-extrabold">{title}</div>
            <div className="mt-1 text-xs opacity-80">{desc}</div>

            {calc.enabled && calc.isFree ? (
              <div className={`mt-2 text-xs font-semibold ${justUnlocked ? "animate-bounce" : ""}`}>
                Free delivery unlocked 🎉
              </div>
            ) : null}
          </div>

          {ctaHref && calc.enabled && !calc.isFree ? (
            <Link
              href={ctaHref}
              onClick={() => onCtaClick?.()}
              className="inline-flex h-9 items-center justify-center rounded-full bg-black px-4 text-xs font-semibold text-white hover:opacity-90"
            >
              {ctaLabel}
            </Link>
          ) : null}
        </div>

        {calc.enabled && calc.threshold > 0 ? (
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/60">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                  calc.isFree ? "bg-emerald-400" : "bg-amber-400"
                }`}
                style={{ width: `${calc.progress}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] opacity-80">
              <span>{fmtGBP(calc.sub)}</span>
              <span>{fmtGBP(calc.threshold)}</span>
            </div>
          </div>
        ) : null}
      </div>

      {showBreakdown ? (
        <div className="mt-3 rounded-2xl border border-black/10 bg-white px-4 py-3">
          <Row label="Subtotal" value={fmtGBP(calc.sub)} />
          <Row label="Delivery" value={calc.shipping === 0 ? "£0.00" : fmtGBP(calc.shipping)} />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Total (estimate)</span>
            <span className="text-lg font-extrabold">{fmtGBP(total)}</span>
          </div>
          <div className="mt-1 text-[11px] text-black/45">Final total will be shown on Stripe Checkout.</div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2 flex items-center justify-between text-sm">
      <span className="text-black/60">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}