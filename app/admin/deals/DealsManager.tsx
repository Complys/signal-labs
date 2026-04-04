"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ProductVariant = {
  label: string;
  pricePennies: number;
  image?: string;
  stock?: number;
};

type Product = {
  id: string;
  name: string;
  price: number;
  image?: string | null;
  isActive: boolean;
  stock: number;
  variantsJson?: string | null;
};

type Deal = {
  id: string;
  productId?: string | null;
  title: string;
  description?: string | null;
  image?: string | null;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  specialPrice: number;
  variantLabel?: string | null;
  isActive: boolean;
  startsAt: string;
  endsAt?: string | null;
};

type Props = {
  products: Product[];
  dealsByKey: Record<string, Deal>;
};

type Row = {
  productId: string;
  productName: string;
  productPrice: number;
  productImage: string | null;
  variantLabel: string;       // "" = whole product, "5mg" = specific variant
  variantImage: string;       // variant-specific image
  variantPrice: number;       // variant price in pennies

  dealId: string | null;
  enabled: boolean;
  specialPriceGBP: string;
  startsAtLocal: string;
  endsAtLocal: string;

  saving: boolean;
  error: string;
  saved: boolean;
};

function penniesToPounds(p: number) {
  return (p / 100).toFixed(2);
}

function poundsToPennies(v: string) {
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100));
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(v: string) {
  return new Date(v).toISOString();
}

function dealStatus(enabled: boolean, startsAt: string, endsAt?: string | null) {
  if (!enabled) return { label: "Off", cls: "text-white/40" };
  const now = Date.now();
  const s = new Date(startsAt).getTime();
  const e = endsAt ? new Date(endsAt).getTime() : null;
  if (s > now) return { label: "Upcoming", cls: "text-blue-300" };
  if (e && e < now) return { label: "Expired", cls: "text-red-300" };
  return { label: "Live", cls: "text-emerald-300" };
}

function buildRows(products: Product[], dealsByKey: Record<string, Deal>): Row[] {
  const now = new Date().toISOString();
  const rows: Row[] = [];

  for (const p of products) {
    let variants: ProductVariant[] = [];
    try {
      if (p.variantsJson) {
        const parsed = JSON.parse(p.variantsJson);
        if (Array.isArray(parsed) && parsed.length > 0) variants = parsed;
      }
    } catch {}

    if (variants.length > 0) {
      // One row per variant
      for (const v of variants) {
        const key = `${p.id}::${v.label}`;
        const d = dealsByKey[key];
        rows.push({
          productId: p.id,
          productName: p.name,
          productPrice: p.price,
          productImage: p.image ?? null,
          variantLabel: v.label,
          variantImage: v.image ?? "",
          variantPrice: v.pricePennies,
          dealId: d?.id ?? null,
          enabled: d ? Boolean(d.isActive) : false,
          specialPriceGBP: d ? penniesToPounds(d.specialPrice) : penniesToPounds(v.pricePennies),
          startsAtLocal: toLocalInputValue(d?.startsAt ?? now),
          endsAtLocal: d?.endsAt ? toLocalInputValue(d.endsAt) : "",
          saving: false,
          error: "",
          saved: false,
        });
      }
    } else {
      // No variants — one row for whole product
      const key = `${p.id}::`;
      const d = dealsByKey[key];
      rows.push({
        productId: p.id,
        productName: p.name,
        productPrice: p.price,
        productImage: p.image ?? null,
        variantLabel: "",
        variantImage: "",
        variantPrice: p.price,
        dealId: d?.id ?? null,
        enabled: d ? Boolean(d.isActive) : false,
        specialPriceGBP: d ? penniesToPounds(d.specialPrice) : penniesToPounds(p.price),
        startsAtLocal: toLocalInputValue(d?.startsAt ?? now),
        endsAtLocal: d?.endsAt ? toLocalInputValue(d.endsAt) : "",
        saving: false,
        error: "",
        saved: false,
      });
    }
  }

  return rows;
}

export default function DealsManager({ products, dealsByKey }: Props) {
  const initial = useMemo(() => buildRows(products, dealsByKey), [products, dealsByKey]);
  const [rows, setRows] = useState<Row[]>(initial);

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => idx !== i ? r : { ...r, ...patch }));
  }

  async function saveRow(i: number) {
    const row = rows[i];
    if (!row) return;

    updateRow(i, { saving: true, error: "" });

    const specialPennies = poundsToPennies(row.specialPriceGBP);
    const title = row.variantLabel
      ? `${row.productName} — ${row.variantLabel} Weekly Special`
      : `${row.productName} — Weekly Special`;

    const payload = {
      productId: row.productId,
      title,
      specialPrice: specialPennies,
      variantLabel: row.variantLabel || null,
      image: row.variantImage || row.productImage || null,
      isActive: row.enabled,
      startsAt: fromLocalInputValue(row.startsAtLocal),
      endsAt: row.endsAtLocal ? fromLocalInputValue(row.endsAtLocal) : null,
      description: null,
      buttonLabel: null,
      buttonUrl: null,
    };

    try {
      const url = row.dealId ? `/api/admin/deals/${row.dealId}` : `/api/admin/deals`;
      const method = row.dealId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        updateRow(i, { saving: false, error: json?.error || "Save failed" });
        return;
      }

      const dealId = json?.deal?.id ?? json?.id ?? row.dealId;
      updateRow(i, { saving: false, saved: true, dealId, error: "" });
      setTimeout(() => updateRow(i, { saved: false }), 3000);
    } catch (e: any) {
      updateRow(i, { saving: false, error: e?.message || "Save failed" });
    }
  }

  // Group rows by product for display
  const grouped: { productName: string; productId: string; rows: { row: Row; index: number }[] }[] = [];
  for (const [i, row] of rows.entries()) {
    const last = grouped[grouped.length - 1];
    if (last && last.productId === row.productId) {
      last.rows.push({ row, index: i });
    } else {
      grouped.push({ productName: row.productName, productId: row.productId, rows: [{ row, index: i }] });
    }
  }

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <div key={group.productId} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          {/* Product header */}
          <div className="px-5 py-3 bg-white/5 border-b border-white/10">
            <h3 className="text-sm font-bold text-white">{group.productName}</h3>
          </div>

          {/* Variant rows */}
          <div className="divide-y divide-white/5">
            {group.rows.map(({ row, index: i }) => {
              const status = row.enabled
                ? dealStatus(row.enabled, fromLocalInputValue(row.startsAtLocal), row.endsAtLocal ? fromLocalInputValue(row.endsAtLocal) : null)
                : { label: "Off", cls: "text-white/40" };
              const pct = row.variantPrice > 0
                ? Math.round((1 - poundsToPennies(row.specialPriceGBP) / row.variantPrice) * 100)
                : 0;

              return (
                <div key={`${row.productId}::${row.variantLabel}`} className="px-5 py-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Enable toggle */}
                    <label className="flex items-center gap-2 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) => updateRow(i, { enabled: e.target.checked })}
                        className="h-4 w-4 accent-yellow-400"
                      />
                      <span className="text-sm font-semibold text-white/80">
                        {row.variantLabel || "Whole product"}
                      </span>
                    </label>

                    {/* Status badge */}
                    <span className={`text-xs font-semibold ${status.cls}`}>
                      {status.label}
                    </span>

                    {/* Normal price */}
                    <span className="text-xs text-white/40">
                      Normal: £{penniesToPounds(row.variantPrice)}
                    </span>

                    {/* Special price */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/60">Special price £</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.specialPriceGBP}
                        onChange={(e) => updateRow(i, { specialPriceGBP: e.target.value })}
                        disabled={!row.enabled}
                        className="w-24 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-sm text-white outline-none focus:border-yellow-400/50 disabled:opacity-40"
                      />
                      {pct > 0 && row.enabled && (
                        <span className="text-xs font-bold text-yellow-400">-{pct}%</span>
                      )}
                    </div>

                    {/* Starts at */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/60">From</span>
                      <input
                        type="datetime-local"
                        value={row.startsAtLocal}
                        onChange={(e) => updateRow(i, { startsAtLocal: e.target.value })}
                        disabled={!row.enabled}
                        className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs text-white outline-none focus:border-yellow-400/50 disabled:opacity-40"
                      />
                    </div>

                    {/* Ends at */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/60">Until</span>
                      <input
                        type="datetime-local"
                        value={row.endsAtLocal}
                        onChange={(e) => updateRow(i, { endsAtLocal: e.target.value })}
                        disabled={!row.enabled}
                        className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs text-white outline-none focus:border-yellow-400/50 disabled:opacity-40"
                      />
                      {row.endsAtLocal && (
                        <button
                          type="button"
                          onClick={() => updateRow(i, { endsAtLocal: "" })}
                          className="text-xs text-white/40 hover:text-white/70"
                        >
                          clear
                        </button>
                      )}
                    </div>

                    {/* Save button */}
                    <button
                      type="button"
                      onClick={() => saveRow(i)}
                      disabled={row.saving}
                      className="rounded-full bg-yellow-400 px-4 py-1.5 text-xs font-bold text-black hover:opacity-90 disabled:opacity-50 shrink-0"
                    >
                      {row.saving ? "Saving…" : "Save"}
                    </button>

                    {row.saved && <span className="text-xs text-emerald-400 font-semibold">Saved ✓</span>}
                    {row.error && <span className="text-xs text-red-400">{row.error}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
