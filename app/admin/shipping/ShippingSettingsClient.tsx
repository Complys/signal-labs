"use client";

import { useEffect, useMemo, useState } from "react";

type SettingsCore = {
  enabled: boolean;
  freeOverPennies: number;
  flatRatePennies: number;
  updatedAt?: string;
};

type ApiGet =
  | { ok: true; settings: SettingsCore }
  | SettingsCore
  | { ok: false; error?: string };

function fmtGBP(pennies: number) {
  const p = Number.isFinite(pennies) ? pennies : 0;
  return `£${(p / 100).toFixed(2)}`;
}

function unwrapSettings(json: any): SettingsCore | null {
  if (!json) return null;
  if (json.settings && typeof json.settings === "object") return json.settings as SettingsCore;
  if (typeof json.enabled === "boolean") return json as SettingsCore;
  return null;
}

function gbpToPennies(input: string, fallback: number) {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return fallback;

  const safe = trimmed.replace(/[^\d.]/g, "");
  const n = Number(safe);
  if (!Number.isFinite(n) || n < 0) return fallback;

  return Math.round(n * 100);
}

function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      disabled={disabled}
      aria-pressed={value}
      className={`relative inline-flex h-9 w-[76px] items-center rounded-full border transition ${
        disabled ? "opacity-60" : "opacity-100"
      } ${value ? "border-emerald-200 bg-emerald-100" : "border-black/10 bg-black/10"}`}
    >
      <span
        className={`absolute left-1 top-1 h-7 w-7 rounded-full bg-white shadow transition ${
          value ? "translate-x-[38px]" : "translate-x-0"
        }`}
      />
      <span className={`w-full text-center text-[11px] font-extrabold ${value ? "text-emerald-800" : "text-black/70"}`}>
        {value ? "On" : "Off"}
      </span>
    </button>
  );
}

export default function ShippingSettingsClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(true);
  const [freeOver, setFreeOver] = useState(3000);
  const [flatRate, setFlatRate] = useState(499);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [freeOverGbp, setFreeOverGbp] = useState("30.00");
  const [flatRateGbp, setFlatRateGbp] = useState("4.99");

  const canSave = useMemo(() => {
    return Number.isFinite(freeOver) && freeOver >= 0 && Number.isFinite(flatRate) && flatRate >= 0;
  }, [freeOver, flatRate]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const res = await fetch("/api/admin/settings/shipping", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ApiGet;

        if (!res.ok) {
          setErr((json as any)?.error || "Failed to load shipping settings");
          return;
        }

        const s = unwrapSettings(json);
        if (!s) {
          setErr("Unexpected response from /api/admin/settings/shipping");
          return;
        }

        if (cancelled) return;

        const nextEnabled = Boolean(s.enabled);
        const nextFreeOver = Math.max(0, Math.trunc(Number(s.freeOverPennies) || 0));
        const nextFlatRate = Math.max(0, Math.trunc(Number(s.flatRatePennies) || 0));

        setEnabled(nextEnabled);
        setFreeOver(nextFreeOver);
        setFlatRate(nextFlatRate);
        setUpdatedAt(s.updatedAt ?? null);

        setFreeOverGbp((nextFreeOver / 100).toFixed(2));
        setFlatRateGbp((nextFlatRate / 100).toFixed(2));
      } catch (e: any) {
        setErr(e?.message || "Failed to load shipping settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSave() {
    setSaving(true);
    setErr(null);

    const nextFreeOver = gbpToPennies(freeOverGbp, freeOver);
    const nextFlatRate = gbpToPennies(flatRateGbp, flatRate);

    try {
      const res = await fetch("/api/admin/settings/shipping", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          freeOverPennies: nextFreeOver,
          flatRatePennies: nextFlatRate,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setErr(json?.error || "Save failed");
        return;
      }

      const s = unwrapSettings(json?.settings ? json : json);
      if (s) {
        setFreeOver(nextFreeOver);
        setFlatRate(nextFlatRate);
        setUpdatedAt(s.updatedAt ?? null);

        setFreeOverGbp((nextFreeOver / 100).toFixed(2));
        setFlatRateGbp((nextFlatRate / 100).toFixed(2));
      }
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl rounded-2xl border border-black/10 bg-white p-5">
      {loading ? (
        <div className="text-sm font-semibold text-black/60">Loading…</div>
      ) : (
        <>
          {err ? (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {err}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-black">Shipping enabled</div>
              <div className="mt-0.5 text-xs text-black/55">
                Turn shipping off to treat delivery as free for all orders.
              </div>
            </div>

            <Toggle value={enabled} onChange={setEnabled} disabled={saving} />
          </div>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-1">
              <div className="text-xs font-bold text-black/70">Free delivery over (GBP)</div>
              <input
                value={freeOverGbp}
                onChange={(e) => setFreeOverGbp(e.target.value)}
                className="h-10 w-full rounded-xl border border-black/15 bg-white px-3 text-sm font-bold text-black placeholder:text-black/40 outline-none focus:border-black/30"
                inputMode="decimal"
                placeholder="30.00"
              />
              <div className="text-[11px] text-black/50">
                Current: <span className="font-semibold">{fmtGBP(freeOver)}</span>
              </div>
            </label>

            <label className="grid gap-1">
              <div className="text-xs font-bold text-black/70">Flat rate shipping (GBP)</div>
              <input
                value={flatRateGbp}
                onChange={(e) => setFlatRateGbp(e.target.value)}
                className="h-10 w-full rounded-xl border border-black/15 bg-white px-3 text-sm font-bold text-black placeholder:text-black/40 outline-none focus:border-black/30"
                inputMode="decimal"
                placeholder="4.99"
              />
              <div className="text-[11px] text-black/50">
                Current: <span className="font-semibold">{fmtGBP(flatRate)}</span>
              </div>
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !canSave}
              className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-xs font-extrabold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>

            {updatedAt ? (
              <div className="text-[11px] text-black/45">
                Updated: {new Date(updatedAt).toLocaleString()}
              </div>
            ) : null}
          </div>

          {!enabled ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              Shipping is disabled — your UI should treat delivery as free for all orders.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}