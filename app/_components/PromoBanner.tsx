"use client";

import { useEffect, useState } from "react";

type Tier = { spendPennies: number; pct: number };

function fmt(pennies: number) {
  return `£${(pennies / 100).toFixed(0)}`;
}

export default function PromoBanner() {
  const [tiers, setTiers] = useState<Tier[]>([]);

  useEffect(() => {
    fetch("/api/multibuy")
      .then((r) => r.json())
      .then((d) => Array.isArray(d.tiers) && setTiers(d.tiers))
      .catch(() => {});
  }, []);

  if (!tiers.length) return null;

  const sorted = [...tiers].sort((a, b) => a.spendPennies - b.spendPennies);

  // Build the ticker items
  const items = sorted.map(
    (t) => `Spend ${fmt(t.spendPennies)} for ${t.pct}% Off`
  );

  // Repeat items for seamless loop
  const repeated = [...items, ...items, ...items];

  return (
    <div className="w-full bg-[#0B1220] text-white overflow-hidden">
      <div className="flex animate-ticker whitespace-nowrap py-2.5">
        {repeated.map((text, i) => (
          <span key={i} className="inline-flex items-center gap-2 px-8 text-sm font-semibold">
            <span className="text-yellow-400">★</span>
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
