"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type DTO = {
  id?: string;
  enabled: boolean;
  flatRatePennies: number;
  freeOverPennies: number;
  updatedAt?: string | null;
};

const API_URL = "/api/admin/settings/shipping";

function penniesToGBPLabel(p: number) {
  const n = Number.isFinite(p) ? p : 0;
  return `£${(n / 100).toFixed(2)}`;
}

/**
 * Parse a GBP input string safely into pennies.
 * Accepts: "30", "30.0", "30.00", " 30.00 "
 * Rejects: negatives, NaN
 */
function gbpInputToPennies(input: string) {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return 0;

  // keep only digits + dot
  const safe = trimmed.replace(/[^\d.]/g, "");
  const n = Number(safe);
  if (!Number.isFinite(n) || n < 0) return 0;

  return Math.round(n * 100);
}

/** Format pennies -> "30.00" (no £) for input fields */
function penniesToInput(p: number) {
  const n = Number.isFinite(p) ? p : 0;
  return (n / 100).toFixed(2);
}

export default function AdminShippingSettingsPage() {
  const [data, setData] = useState<DTO | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const okTimerRef = useRef<number | null>(null);

  // form state
  const [enabled, setEnabled] = useState(true);
  const [freeOverGBP, setFreeOverGBP] = useState("30.00");
  const [flatRateGBP, setFlatRateGBP] = useState("4.99");

  const payload = useMemo(() => {
    const freeOverPennies = gbpInputToPennies(freeOverGBP);
    const flatRatePennies = gbpInputToPennies(flatRateGBP);

    return {
      enabled,
      freeOverPennies,
      flatRatePennies,
    };
  }, [enabled, freeOverGBP, flatRateGBP]);

  const isDirty = useMemo(() => {
    if (!data) return false;
    return (
      data.enabled !== payload.enabled ||
      data.freeOverPennies !== payload.freeOverPennies ||
      data.flatRatePennies !== payload.flatRatePennies
    );
  }, [data, payload]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(API_URL, { cache: "no-store" });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          if (res.status === 401) throw new Error("Unauthorized (are you logged in as an admin?)");
          throw new Error(json?.error || json?.message || `Failed to load (${res.status})`);
        }

        if (cancelled) return;

        const dto: DTO = {
          id: json?.id,
          enabled: !!json?.enabled,
          flatRatePennies: Number(json?.flatRatePennies ?? 0),
          freeOverPennies: Number(json?.freeOverPennies ?? 0),
          updatedAt: json?.updatedAt ?? null,
        };

        setData(dto);
        setEnabled(dto.enabled);
        setFreeOverGBP(penniesToInput(dto.freeOverPennies));
        setFlatRateGBP(penniesToInput(dto.flatRatePennies));
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (okTimerRef.current) window.clearTimeout(okTimerRef.current);
    };
  }, []);

  function showOk(msg: string) {
    setOkMsg(msg);
    if (okTimerRef.current) window.clearTimeout(okTimerRef.current);
    okTimerRef.current = window.setTimeout(() => setOkMsg(null), 2500);
  }

  function resetToSaved() {
    if (!data) return;
    setEnabled(data.enabled);
    setFreeOverGBP(penniesToInput(data.freeOverPennies));
    setFlatRateGBP(penniesToInput(data.flatRatePennies));
    setError(null);
    setOkMsg(null);
  }

  async function onSave() {
    if (saving) return;

    setSaving(true);
    setError(null);
    setOkMsg(null);

    // basic guardrails
    if (payload.enabled && payload.freeOverPennies === 0) {
      setSaving(false);
      setError("Free threshold looks like £0.00 — set a threshold or disable shipping charges.");
      return;
    }

    try {
      const res = await fetch(API_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) throw new Error("Unauthorized (are you logged in as an admin?)");
        throw new Error(json?.error || json?.message || `Save failed (${res.status})`);
      }

      const dto: DTO = {
        id: json?.id,
        enabled: !!json?.enabled,
        flatRatePennies: Number(json?.flatRatePennies ?? payload.flatRatePennies),
        freeOverPennies: Number(json?.freeOverPennies ?? payload.freeOverPennies),
        updatedAt: json?.updatedAt ?? new Date().toISOString(),
      };

      setData(dto);
      setEnabled(dto.enabled);
      setFreeOverGBP(penniesToInput(dto.freeOverPennies));
      setFlatRateGBP(penniesToInput(dto.flatRatePennies));

      showOk("Saved.");
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const preview = useMemo(() => {
    const free = payload.freeOverPennies;
    const flat = payload.flatRatePennies;

    return {
      freeLabel: penniesToGBPLabel(free),
      flatLabel: penniesToGBPLabel(flat),
      exampleSubtotalPennies: 2500, // £25.00
      amountUntilFreePennies: Math.max(0, free - 2500),
    };
  }, [payload.freeOverPennies, payload.flatRatePennies]);

  if (loading) return <div className="p-6 text-white/80">Loading shipping settings…</div>;

  return (
    <div className="p-6 max-w-2xl space-y-6 text-white">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Shipping Settings</h1>
        <p className="text-sm text-white/60">
          Controls flat-rate delivery and the free-delivery threshold used across checkout and Quick Buy.
        </p>

        {data?.updatedAt ? (
          <p className="text-xs text-white/40">Last updated: {new Date(data.updatedAt).toLocaleString()}</p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div>
      ) : null}

      {okMsg ? (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          {okMsg}
        </div>
      ) : null}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)] space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold tracking-wide text-white/45 uppercase">Status</div>
            <div className="mt-1 text-sm text-white/80">
              Toggle whether shipping charges are applied. (If disabled, shipping is treated as £0.)
            </div>
          </div>

          <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <span className="text-sm font-semibold">{enabled ? "Enabled" : "Disabled"}</span>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <div className="text-sm font-semibold">Free delivery threshold</div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">£</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-7 py-2.5 text-sm font-semibold outline-none focus:border-white/25"
                inputMode="decimal"
                value={freeOverGBP}
                onChange={(e) => setFreeOverGBP(e.target.value)}
                placeholder="30.00"
              />
            </div>
            <div className="text-xs text-white/50">Customers get free delivery when subtotal is at or above this value.</div>
          </label>

          <label className="space-y-2">
            <div className="text-sm font-semibold">Flat rate</div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">£</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-7 py-2.5 text-sm font-semibold outline-none focus:border-white/25 disabled:opacity-60"
                inputMode="decimal"
                value={flatRateGBP}
                onChange={(e) => setFlatRateGBP(e.target.value)}
                placeholder="4.99"
                disabled={!enabled}
              />
            </div>
            <div className="text-xs text-white/50">Charged when subtotal is below the free threshold.</div>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-extrabold hover:bg-white/10 disabled:opacity-60"
            onClick={onSave}
            disabled={saving || !isDirty}
            title={!isDirty ? "No changes to save" : undefined}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>

          <button
            className="rounded-2xl border border-white/10 bg-transparent px-5 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/5 disabled:opacity-50"
            onClick={resetToSaved}
            disabled={!isDirty}
          >
            Reset
          </button>

          {isDirty ? <span className="text-xs text-white/50">Unsaved changes</span> : <span className="text-xs text-white/40">All changes saved</span>}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
        <div className="text-xs font-semibold tracking-wide text-white/45 uppercase">Preview</div>

        {payload.enabled ? (
          <div className="space-y-2 text-sm text-white/85">
            <div>
              Flat rate: <span className="font-extrabold">{preview.flatLabel}</span>
              {" • "}
              Free over <span className="font-extrabold">{preview.freeLabel}</span>
            </div>

            <div className="text-xs text-white/55">
              Example subtotal £25.00 → Spend{" "}
              <span className="font-extrabold">{penniesToGBPLabel(preview.amountUntilFreePennies)}</span> more to unlock free delivery.
            </div>
          </div>
        ) : (
          <div className="text-sm text-white/75">
            Shipping charges disabled (shipping cost treated as <span className="font-extrabold">£0.00</span>).
          </div>
        )}
      </div>
    </div>
  );
}