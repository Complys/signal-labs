"use client";

import { useEffect, useState } from "react";

type Tier = { spendPennies: number; pct: number };

const DEFAULT: Tier[] = [
  { spendPennies: 5000,  pct: 5  },
  { spendPennies: 10000, pct: 10 },
  { spendPennies: 15000, pct: 15 },
];

function penniesTo(p: number) { return (p / 100).toFixed(2); }
function toPennies(s: string) { return Math.round(parseFloat(s.replace(/[^0-9.]/g, "")) * 100) || 0; }

export default function MultiBuySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tiers, setTiers] = useState<Tier[]>(DEFAULT);

  useEffect(() => {
    fetch("/api/admin/settings/multibuy")
      .then((r) => r.json())
      .then((d) => Array.isArray(d.tiers) && setTiers(d.tiers))
      .catch(() => setErr("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  function updateTier(i: number, field: keyof Tier, val: string) {
    setTiers((prev) => prev.map((t, idx) =>
      idx !== i ? t : { ...t, [field]: field === "pct" ? parseInt(val) || 0 : toPennies(val) }
    ));
  }

  function addTier() {
    setTiers((prev) => [...prev, { spendPennies: 0, pct: 0 }]);
  }

  function removeTier(i: number) {
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSave() {
    setSaving(true); setSaved(false); setErr(null);
    try {
      const res = await fetch("/api/admin/settings/multibuy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tiers }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json.error || "Save failed"); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-1">Multi-buy Discounts</h1>
      <p className="text-sm text-white/55 mb-6">
        Spend-based discount tiers. Applied automatically at checkout when cart total reaches the threshold.
      </p>

      {loading ? (
        <div className="text-sm text-white/50">Loading…</div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
          {err && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-400">
              {err}
            </div>
          )}

          <div className="space-y-3">
            {tiers.map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <label className="block">
                    <div className="text-[10px] font-bold text-white/50 mb-1">Spend over (£)</div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={penniesTo(t.spendPennies)}
                      onBlur={(e) => updateTier(i, "spendPennies", e.target.value)}
                      className="w-full h-9 rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-white outline-none focus:border-white/30"
                    />
                  </label>
                  <label className="block">
                    <div className="text-[10px] font-bold text-white/50 mb-1">Discount (%)</div>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={t.pct}
                      onChange={(e) => updateTier(i, "pct", e.target.value)}
                      className="w-full h-9 rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-white outline-none focus:border-white/30"
                    />
                  </label>
                </div>
                <button
                  onClick={() => removeTier(i)}
                  className="mt-4 text-red-400 hover:text-red-300 text-lg leading-none"
                  title="Remove tier"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addTier}
            className="text-xs font-bold text-white/60 hover:text-white border border-white/15 rounded-full px-4 py-2"
          >
            + Add tier
          </button>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onSave}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-full bg-[#f5c400] px-5 text-xs font-extrabold text-black disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save tiers"}
            </button>
            {saved && <span className="text-xs font-semibold text-emerald-400">Saved</span>}
          </div>
        </div>
      )}
    </div>
  );
}
