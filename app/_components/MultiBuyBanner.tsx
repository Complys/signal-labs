"use client";

import { useEffect, useState } from "react";

type Tier = { spendPennies: number; pct: number };

function fmt(pennies: number) {
  return `£${(pennies / 100).toFixed(0)}`;
}

export default function MultiBuyBanner({ cartPennies = 0 }: { cartPennies?: number }) {
  const [tiers, setTiers] = useState<Tier[]>([]);

  useEffect(() => {
    fetch("/api/multibuy")
      .then((r) => r.json())
      .then((d) => Array.isArray(d.tiers) && setTiers(d.tiers))
      .catch(() => {});
  }, []);

  if (!tiers.length) return null;

  // Find the next tier the customer hasn't hit yet
  const sorted = [...tiers].sort((a, b) => a.spendPennies - b.spendPennies);
  const activeTier = sorted.filter((t) => cartPennies >= t.spendPennies).at(-1);
  const nextTier = sorted.find((t) => cartPennies < t.spendPennies);
  const toNext = nextTier ? nextTier.spendPennies - cartPennies : 0;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2">
        Multi-buy discounts
      </div>

      {/* Tier list */}
      <div className="space-y-1 mb-3">
        {sorted.map((t) => {
          const hit = cartPennies >= t.spendPennies;
          return (
            <div key={t.spendPennies} className="flex items-center gap-2 text-sm">
              <span className={hit ? "text-emerald-600" : "text-amber-700"}>
                {hit ? "✓" : "○"}
              </span>
              <span className={hit ? "font-semibold text-emerald-700" : "text-amber-800"}>
                Spend {fmt(t.spendPennies)} — get {t.pct}% off
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress message */}
      {activeTier ? (
        <p className="text-xs font-semibold text-emerald-700">
          {activeTier.pct}% discount applied to your order.
          {nextTier ? ` Spend ${fmt(toNext)} more to unlock ${nextTier.pct}% off.` : " You have the best discount!"}
        </p>
      ) : nextTier ? (
        <p className="text-xs text-amber-700">
          Spend {fmt(toNext)} more to unlock {nextTier.pct}% off your order.
        </p>
      ) : null}
    </div>
  );
}
