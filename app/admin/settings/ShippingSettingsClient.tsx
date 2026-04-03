"use client";

import { useEffect, useMemo, useState } from "react";

type ShippingSettingsDTO = {
  id?: string;
  enabled: boolean;
  flatRatePennies: number;
  freeOverPennies: number;
  updatedAt?: string | null;
};

const API_URL = "/api/admin/settings/shipping";

// ---- money helpers ----
function penniesToPoundsString(pennies: number) {
  const n = Number.isFinite(pennies) ? pennies : 0;
  return (n / 100).toFixed(2);
}

function poundsStringToPennies(input: string) {
  const cleaned = String(input ?? "").trim().replace(/[£,\s]/g, "");
  if (!cleaned) return 0;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100);
}

function clampPennies(n: number, min = 0, max = 1_000_000_00) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function parseDTO(data: any): ShippingSettingsDTO {
  // supports BOTH shapes:
  // 1) { enabled, flatRatePennies, freeOverPennies, updatedAt }
  // 2) { ok: true, settings: { enabled, flatRatePennies, freeOverPennies } }
  const root = data?.settings && typeof data.settings === "object" ? data.settings : data;

  return {
    id: root?.id ? String(root.id) : undefined,
    enabled: !!root?.enabled,
    flatRatePennies: Number(root?.flatRatePennies ?? 0),
    freeOverPennies: Number(root?.freeOverPennies ?? 0),
    updatedAt: root?.updatedAt ?? null,
  };
}

export default function ShippingSettingsClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [server, setServer] = useState<ShippingSettingsDTO | null>(null);

  // UI state in pounds strings
  const [enabled, setEnabled] = useState(true);
  const [flatRateGBP, setFlatRateGBP] = useState("4.99");
  const [freeOverGBP, setFreeOverGBP] = useState("30.00");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const dirty = useMemo(() => {
    if (!server) return false;
    const flat = poundsStringToPennies(flatRateGBP);
    const free = poundsStringToPennies(freeOverGBP);
    return (
      enabled !== server.enabled ||
      clampPennies(flat) !== clampPennies(server.flatRatePennies) ||
      clampPennies(free) !== clampPennies(server.freeOverPennies)
    );
  }, [server, enabled, flatRateGBP, freeOverGBP]);

  async function load() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(API_URL, { method: "GET", cache: "no-store" });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      if (!res.ok) {
        throw new Error(`Failed to load (${res.status}) from ${API_URL}: ${data?.error || data?.message || "Unknown error"}`);
      }

      const dto = parseDTO(data);

      setServer(dto);
      setEnabled(dto.enabled);
      setFlatRateGBP(penniesToPoundsString(dto.flatRatePennies));
      setFreeOverGBP(penniesToPoundsString(dto.freeOverPennies));
    } catch (e: any) {
      setError(e?.message || `Failed to load from ${API_URL}.`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const flatRatePennies = clampPennies(poundsStringToPennies(flatRateGBP));
      const freeOverPennies = clampPennies(poundsStringToPennies(freeOverGBP));

      const res = await fetch(API_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, flatRatePennies, freeOverPennies }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      if (!res.ok) {
        throw new Error(`Save failed (${res.status}) to ${API_URL}: ${data?.error || data?.message || "Unknown error"}`);
      }

      const updated = parseDTO(data);

      setServer(updated);
      setEnabled(updated.enabled);
      setFlatRateGBP(penniesToPoundsString(updated.flatRatePennies));
      setFreeOverGBP(penniesToPoundsString(updated.freeOverPennies));

      setSuccess("Saved.");
    } catch (e: any) {
      setError(e?.message || `Failed to save to ${API_URL}.`);
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    if (!server) return;
    setError(null);
    setSuccess(null);
    setEnabled(server.enabled);
    setFlatRateGBP(penniesToPoundsString(server.flatRatePennies));
    setFreeOverGBP(penniesToPoundsString(server.freeOverPennies));
  }

  const previewFlat = flatRateGBP || "0.00";
  const previewFree = freeOverGBP || "0.00";

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="h-5 w-48 animate-pulse rounded bg-neutral-100" />
        <div className="mt-3 h-10 w-full animate-pulse rounded bg-neutral-100" />
        <div className="mt-3 h-10 w-full animate-pulse rounded bg-neutral-100" />
        <div className="mt-4 h-10 w-32 animate-pulse rounded bg-neutral-100" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Checkout Shipping Rules</h2>
          <p className="mt-1 text-sm text-neutral-600">
            These values drive your checkout messaging and shipping cost calculation.
          </p>
          <p className="mt-1 text-xs text-neutral-500">API: {API_URL}</p>
        </div>

        <label className="inline-flex items-center gap-2">
          <span className="text-sm text-neutral-700">Enabled</span>
          <button
            type="button"
            onClick={() => {
              setSuccess(null);
              setError(null);
              setEnabled((v) => !v);
            }}
            className={[
              "relative h-6 w-11 rounded-full border transition",
              enabled ? "border-emerald-300 bg-emerald-400" : "border-neutral-300 bg-neutral-200",
            ].join(" ")}
            aria-pressed={enabled}
            aria-label="Toggle shipping enabled"
          >
            <span
              className={[
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                enabled ? "translate-x-5" : "translate-x-0.5",
              ].join(" ")}
            />
          </button>
        </label>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-800">Flat rate (GBP)</label>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">£</span>
            <input
              value={flatRateGBP}
              onChange={(e) => {
                setSuccess(null);
                setError(null);
                setFlatRateGBP(e.target.value);
              }}
              inputMode="decimal"
              placeholder="4.99"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            />
          </div>
          <p className="mt-1 text-xs text-neutral-500">Example: 4.99 = £4.99</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-800">Free delivery over (GBP)</label>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">£</span>
            <input
              value={freeOverGBP}
              onChange={(e) => {
                setSuccess(null);
                setError(null);
                setFreeOverGBP(e.target.value);
              }}
              inputMode="decimal"
              placeholder="30.00"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            />
          </div>
          <p className="mt-1 text-xs text-neutral-500">Example: 30 = £30.00</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
        <div className="flex flex-col gap-1">
          <div>
            <span className="font-medium">Preview:</span>{" "}
            {enabled ? (
              <>
                Shipping is <span className="font-semibold">£{previewFlat}</span>,{" "}
                <span className="font-semibold">free over £{previewFree}</span>.
              </>
            ) : (
              <>Shipping rules are currently disabled.</>
            )}
          </div>
          {server?.updatedAt ? (
            <div className="text-xs text-neutral-500">
              Last updated: {new Date(server.updatedAt).toLocaleString()}
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={load}
          disabled={saving}
          className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
        >
          Reload
        </button>

        <button
          type="button"
          onClick={onReset}
          disabled={saving || !dirty}
          className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
        >
          Reset
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={saving || !dirty}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}