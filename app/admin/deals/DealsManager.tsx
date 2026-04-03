"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number; // pennies
  image?: string | null;
  isActive: boolean;
  stock: number;
};

type Deal = {
  id: string;
  productId?: string | null;
  title: string;
  description?: string | null;
  image?: string | null;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  specialPrice: number; // pennies
  isActive: boolean;
  startsAt: string; // ISO
  endsAt?: string | null; // ISO
};

type Props = {
  products: Product[];
  dealsByProductId: Record<string, Deal>;
};

const PERKS = [
  "Free delivery",
  "Limited time",
  "Best seller",
  "New in",
  "Reduced price",
] as const;

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
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(v: string) {
  const d = new Date(v);
  return d.toISOString();
}

function parsePerks(desc?: string | null) {
  if (!desc) return new Set<string>();
  const m = desc.match(/Perks:\s*(.*)$/im);
  if (!m) return new Set<string>();
  const list = m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(list);
}

function buildDescription(base: string, perks: Set<string>) {
  const cleanBase = (base || "").replace(/Perks:.*$/im, "").trim();
  const perkLine = perks.size ? `\n\nPerks: ${Array.from(perks).join(", ")}` : "";
  return (cleanBase + perkLine).trim();
}

function dealStatusLabel(
  enabled: boolean,
  startsAtIso: string,
  endsAtIso?: string | null
) {
  if (!enabled) return { label: "Disabled", cls: "text-white/45" };

  const now = Date.now();
  const s = new Date(startsAtIso).getTime();
  const e = endsAtIso ? new Date(endsAtIso).getTime() : null;

  if (Number.isFinite(s) && s > now) return { label: "Upcoming", cls: "text-blue-300" };
  if (e && e < now) return { label: "Expired", cls: "text-red-300" };
  return { label: "Live", cls: "text-green-300" };
}

// ✅ Safe URL helper (prevents /products/www.1.co.uk ever happening again)
function normalizeExternalUrl(u: unknown): string | null {
  if (typeof u !== "string") return null;
  const raw = u.trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("www.")) return `https://${raw}`;
  return null;
}

type Row = {
  product: Product;

  dealId: string | null;
  enabled: boolean;

  title: string;
  description: string;
  perks: Set<string>;

  specialPriceGBP: string;

  startsAtLocal: string; // datetime-local
  endsAtLocal: string; // datetime-local or ""

  buttonLabel: string;
  buttonUrl: string;

  image: string; // override image URL

  saving: boolean;
  error: string;
  saved: boolean;
  dirty: boolean;
};

function buildInitialRows(products: Product[], dealsByProductId: Record<string, Deal>) {
  const nowIso = new Date().toISOString();

  return products.map((p) => {
    const d = dealsByProductId[p.id];

    const perks = d ? parsePerks(d.description) : new Set<string>();
    const title = d?.title || `${p.name} — Weekly Special`;

    const startsAtIso = d?.startsAt || nowIso;
    const endsAtIso = d?.endsAt || null;

    const overrideImage = d?.image || "";

    return {
      product: p,

      dealId: d?.id || null,
      enabled: d ? Boolean(d.isActive) : false,

      title,
      description: d?.description || "",
      perks,

      specialPriceGBP: d ? penniesToPounds(d.specialPrice) : penniesToPounds(p.price),

      startsAtLocal: toLocalInputValue(startsAtIso),
      endsAtLocal: endsAtIso ? toLocalInputValue(endsAtIso) : "",

      buttonLabel: d?.buttonLabel || "View",
      buttonUrl: d?.buttonUrl || "",

      image: overrideImage,

      saving: false,
      error: "",
      saved: false,
      dirty: false,
    } satisfies Row;
  });
}

export default function DealsManager({ products, dealsByProductId }: Props) {
  const initial = useMemo(
    () => buildInitialRows(products, dealsByProductId),
    [products, dealsByProductId]
  );

  const [rows, setRows] = useState<Row[]>(initial);

  // Keep UI in sync with server props unless user has edits
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      setRows(initial);
      return;
    }

    const hasEdits = rows.some((r) => r.dirty || r.saving);
    if (!hasEdits) setRows(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const totalEnabled = rows.reduce((acc, r) => acc + (r.enabled ? 1 : 0), 0);

  function updateRow(idx: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch, dirty: true, saved: false } : r))
    );
  }

  function togglePerk(idx: number, perk: string) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const next = new Set(row.perks);
        if (next.has(perk)) next.delete(perk);
        else next.add(perk);
        return { ...row, perks: next, dirty: true, saved: false };
      })
    );
  }

  async function saveRow(idx: number) {
    const snapshot = rows[idx];
    if (!snapshot) return;

    setRows((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, saving: true, error: "", saved: false } : r
      )
    );

    const p = snapshot.product;
    const desc = buildDescription(snapshot.description, snapshot.perks);
    const specialPennies = poundsToPennies(snapshot.specialPriceGBP);

    if (specialPennies <= 0) {
      setRows((prev) =>
        prev.map((r, i) =>
          i === idx
            ? { ...r, saving: false, error: "Special price must be greater than £0.00" }
            : r
        )
      );
      return;
    }

    if (!snapshot.startsAtLocal) {
      setRows((prev) =>
        prev.map((r, i) =>
          i === idx ? { ...r, saving: false, error: "Starts date is required." } : r
        )
      );
      return;
    }

    // ✅ store sanitized external url (null unless http(s))
    const normalizedButtonUrl = normalizeExternalUrl(snapshot.buttonUrl);

    const payload = {
      productId: p.id,
      isActive: snapshot.enabled,
      title: snapshot.title.trim() || `${p.name} — Weekly Special`,
      description: desc || null,
      image: snapshot.image || null,
      buttonLabel: snapshot.buttonLabel || null,
      buttonUrl: normalizedButtonUrl, // ✅ safe
      specialPrice: specialPennies,
      startsAt: fromLocalInputValue(snapshot.startsAtLocal),
      endsAt: snapshot.endsAtLocal ? fromLocalInputValue(snapshot.endsAtLocal) : null,
    };

    try {
      const res = await fetch(
        snapshot.dealId ? `/api/admin/deals/${snapshot.dealId}` : `/api/admin/deals`,
        {
          method: snapshot.dealId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);

      const newId = data?.deal?.id || snapshot.dealId;

      setRows((prev) =>
        prev.map((r, i) =>
          i === idx
            ? {
                ...r,
                dealId: newId ?? r.dealId,
                saving: false,
                saved: true,
                error: "",
                dirty: false,
                // reflect normalized value in UI too (so it doesn't re-break later)
                buttonUrl: normalizedButtonUrl || "",
              }
            : r
        )
      );
    } catch (e: any) {
      setRows((prev) =>
        prev.map((r, i) =>
          i === idx ? { ...r, saving: false, error: e?.message || "Save failed" } : r
        )
      );
    }
  }

  function autoFillFromProduct(idx: number) {
    const row = rows[idx];
    if (!row) return;

    const productImage = row.product.image || "";
    const defaultTitle = `${row.product.name} — Weekly Special`;
    const nowLocal = toLocalInputValue(new Date().toISOString());

    updateRow(idx, {
      title: row.title?.trim() ? row.title : defaultTitle,
      specialPriceGBP: row.specialPriceGBP || penniesToPounds(row.product.price),
      startsAtLocal: row.startsAtLocal || nowLocal,
      image: row.image || productImage,
      buttonLabel: row.buttonLabel || "View",
    });
  }

  function setEnabled(idx: number, enabled: boolean) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;

        const next = { ...r, enabled, dirty: true, saved: false };
        if (enabled) {
          const nowIso = new Date().toISOString();
          if (!next.startsAtLocal) next.startsAtLocal = toLocalInputValue(nowIso);
          if (!next.specialPriceGBP) next.specialPriceGBP = penniesToPounds(r.product.price);
          if (!next.title?.trim()) next.title = `${r.product.name} — Weekly Special`;
          if (!next.buttonLabel) next.buttonLabel = "View";
        }
        return next;
      })
    );
  }

  return (
    <div className="w-full">
      {/* Top helper row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-white/70">
          {rows.length} product{rows.length === 1 ? "" : "s"} ·{" "}
          <span className="text-white/90 font-semibold">{totalEnabled}</span>{" "}
          special{totalEnabled === 1 ? "" : "s"} enabled
        </div>
        <div className="text-xs text-white/50">
          Tip: enable a deal + set <span className="font-semibold">Starts</span> in the past to make it live.
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-auto rounded-2xl border border-white/10">
        <table className="min-w-[1180px] w-full text-left text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 w-[70px]">Special</th>
              <th className="px-4 py-3 w-[360px]">Product</th>
              <th className="px-4 py-3 w-[160px]">Special price (£)</th>
              <th className="px-4 py-3 w-[220px]">Starts</th>
              <th className="px-4 py-3 w-[220px]">Ends (optional)</th>
              <th className="px-4 py-3 w-[260px]">Perks</th>
              <th className="px-4 py-3 w-[190px]">CTA</th>
              <th className="px-4 py-3 w-[160px]">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/10">
            {rows.map((row, idx) => {
              const productThumb = row.product.image || "";
              const overrideThumb = row.image || "";
              const thumbToShow = overrideThumb || productThumb;

              const startsIso = row.startsAtLocal
                ? fromLocalInputValue(row.startsAtLocal)
                : new Date().toISOString();
              const endsIso = row.endsAtLocal ? fromLocalInputValue(row.endsAtLocal) : null;

              const status = dealStatusLabel(row.enabled, startsIso, endsIso);
              const disabledInputs = !row.enabled;

              // ✅ preview: only internal product link OR safe external link
              const productHref = `/products/${row.product.id}`;
              const externalHref = normalizeExternalUrl(row.buttonUrl);
              const previewHref = externalHref || productHref;

              return (
                <tr key={row.product.id} className="bg-black/20">
                  {/* Special toggle */}
                  <td className="px-4 py-4 align-top">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) => setEnabled(idx, e.target.checked)}
                      className="h-5 w-5"
                    />
                    <div className={`mt-2 text-xs ${status.cls}`}>{status.label}</div>
                    {row.dirty && !row.saving ? (
                      <div className="mt-1 text-[11px] text-yellow-200/80">Unsaved</div>
                    ) : null}
                  </td>

                  {/* Product cell (thumbnail + details) */}
                  <td className="px-4 py-4 align-top">
                    <div className="flex items-start gap-3">
                      <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-white/5 shrink-0">
                        {thumbToShow ? (
                          <Image
                            src={thumbToShow}
                            alt={row.product.name}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="h-full w-full grid place-items-center text-[10px] text-white/40">
                            No image
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate">
                              {row.product.name}
                            </div>
                            <div className="text-xs text-white/50 mt-1">
                              Base: £{penniesToPounds(row.product.price)} · Stock:{" "}
                              {row.product.stock ?? 0}
                              {!row.product.isActive ? " · (Inactive product)" : ""}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => autoFillFromProduct(idx)}
                            className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/80 hover:bg-white/10 transition"
                          >
                            Auto-fill
                          </button>
                        </div>

                        <div className="mt-3 grid gap-2">
                          <input
                            value={row.title}
                            onChange={(e) => updateRow(idx, { title: e.target.value })}
                            placeholder="Deal title"
                            disabled={disabledInputs}
                            className={[
                              "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/35 outline-none focus:border-white/30",
                              disabledInputs ? "opacity-50" : "",
                            ].join(" ")}
                          />

                          <textarea
                            value={row.description}
                            onChange={(e) => updateRow(idx, { description: e.target.value })}
                            rows={2}
                            placeholder="Short description (optional)"
                            disabled={disabledInputs}
                            className={[
                              "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/35 outline-none focus:border-white/30",
                              disabledInputs ? "opacity-50" : "",
                            ].join(" ")}
                          />

                          {/* Override image URL */}
                          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                            <input
                              value={row.image}
                              onChange={(e) => updateRow(idx, { image: e.target.value })}
                              placeholder="Override image URL (optional)"
                              disabled={disabledInputs}
                              className={[
                                "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/35 outline-none focus:border-white/30",
                                disabledInputs ? "opacity-50" : "",
                              ].join(" ")}
                            />
                            <button
                              type="button"
                              disabled={disabledInputs || !productThumb}
                              onClick={() => updateRow(idx, { image: productThumb })}
                              className={[
                                "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/80 hover:bg-white/10 transition",
                                disabledInputs || !productThumb
                                  ? "opacity-50 cursor-not-allowed"
                                  : "",
                              ].join(" ")}
                            >
                              Use product image
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Special price */}
                  <td className="px-4 py-4 align-top">
                    <input
                      value={row.specialPriceGBP}
                      onChange={(e) => updateRow(idx, { specialPriceGBP: e.target.value })}
                      inputMode="decimal"
                      disabled={disabledInputs}
                      className={[
                        "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30",
                        disabledInputs ? "opacity-50" : "",
                      ].join(" ")}
                    />
                    <div className="mt-2 text-xs text-white/45">
                      Saved as pennies: {poundsToPennies(row.specialPriceGBP)}
                    </div>
                    <div className="mt-2 text-[11px] text-white/45">
                      Quick:{" "}
                      <button
                        type="button"
                        disabled={disabledInputs}
                        onClick={() =>
                          updateRow(idx, {
                            specialPriceGBP: penniesToPounds(
                              Math.max(0, row.product.price - 100)
                            ),
                          })
                        }
                        className={[
                          "underline underline-offset-2 hover:text-white/80",
                          disabledInputs
                            ? "opacity-50 cursor-not-allowed no-underline"
                            : "",
                        ].join(" ")}
                      >
                        −£1.00
                      </button>
                      {" · "}
                      <button
                        type="button"
                        disabled={disabledInputs}
                        onClick={() =>
                          updateRow(idx, { specialPriceGBP: penniesToPounds(row.product.price) })
                        }
                        className={[
                          "underline underline-offset-2 hover:text-white/80",
                          disabledInputs
                            ? "opacity-50 cursor-not-allowed no-underline"
                            : "",
                        ].join(" ")}
                      >
                        match base
                      </button>
                    </div>
                  </td>

                  {/* Starts */}
                  <td className="px-4 py-4 align-top">
                    <input
                      type="datetime-local"
                      value={row.startsAtLocal}
                      onChange={(e) => updateRow(idx, { startsAtLocal: e.target.value })}
                      disabled={disabledInputs}
                      className={[
                        "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-white/30",
                        disabledInputs ? "opacity-50" : "",
                      ].join(" ")}
                    />
                    <div className="mt-2 text-[11px] text-white/45">
                      Want it live now? Set a past time.
                    </div>
                  </td>

                  {/* Ends */}
                  <td className="px-4 py-4 align-top">
                    <input
                      type="datetime-local"
                      value={row.endsAtLocal}
                      onChange={(e) => updateRow(idx, { endsAtLocal: e.target.value })}
                      disabled={disabledInputs}
                      className={[
                        "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-white/30",
                        disabledInputs ? "opacity-50" : "",
                      ].join(" ")}
                    />
                    <div className="mt-2 text-xs text-white/45">
                      Leave blank for “no end date”.
                    </div>
                  </td>

                  {/* Perks */}
                  <td className="px-4 py-4 align-top">
                    <div className="grid grid-cols-1 gap-2">
                      {PERKS.map((perk) => (
                        <label
                          key={perk}
                          className={[
                            "flex items-center gap-2 text-xs text-white/80",
                            disabledInputs ? "opacity-50" : "",
                          ].join(" ")}
                        >
                          <input
                            type="checkbox"
                            checked={row.perks.has(perk)}
                            onChange={() => togglePerk(idx, perk)}
                            disabled={disabledInputs}
                            className="h-4 w-4"
                          />
                          {perk}
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 text-[11px] text-white/45">
                      Stored in description as: <span className="italic">Perks: ...</span>
                    </div>
                  </td>

                  {/* CTA */}
                  <td className="px-4 py-4 align-top">
                    <input
                      value={row.buttonLabel}
                      onChange={(e) => updateRow(idx, { buttonLabel: e.target.value })}
                      placeholder='e.g. "View"'
                      disabled={disabledInputs}
                      className={[
                        "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-white/30",
                        disabledInputs ? "opacity-50" : "",
                      ].join(" ")}
                    />

                    <input
                      value={row.buttonUrl}
                      onChange={(e) => updateRow(idx, { buttonUrl: e.target.value })}
                      placeholder="Optional external link (must start with https://)"
                      disabled={disabledInputs}
                      className={[
                        "mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-white/30",
                        disabledInputs ? "opacity-50" : "",
                      ].join(" ")}
                    />

                    <div className="mt-2 text-[11px] text-white/45">
                      If blank: links to /products/&lt;id&gt;. If you type <span className="font-semibold">www.</span> we’ll save it as <span className="font-semibold">https://</span>.
                    </div>

                    <div className="mt-2">
                      <a
                        href={previewHref}
                        target="_blank"
                        rel="noreferrer"
                        className={[
                          "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/80 hover:bg-white/10 transition",
                          disabledInputs ? "pointer-events-none opacity-50" : "",
                        ].join(" ")}
                      >
                        Preview link <span className="text-white/50">↗</span>
                      </a>
                      {row.buttonUrl && !externalHref ? (
                        <div className="mt-2 text-[11px] text-red-300">
                          External link must start with http:// or https:// (or begin with www.)
                        </div>
                      ) : null}
                    </div>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-4 align-top">
                    <button
                      type="button"
                      onClick={() => saveRow(idx)}
                      disabled={row.saving}
                      className="w-full rounded-xl bg-yellow-400 text-black px-3 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-60"
                    >
                      {row.saving ? "Saving..." : row.dealId ? "Save" : "Create"}
                    </button>

                    {row.saved ? (
                      <div className="mt-2 text-xs text-green-400">Saved</div>
                    ) : null}
                    {row.error ? (
                      <div className="mt-2 text-xs text-red-300">{row.error}</div>
                    ) : null}

                    <div className="mt-3 text-[11px] text-white/45">
                      Deal ID:{" "}
                      <span className="font-mono text-white/60">
                        {row.dealId ? row.dealId.slice(-8) : "—"}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-white/40">
        Notes: your schema requires <span className="font-semibold">startsAt</span> for every deal.
        If a deal is <span className="font-semibold">enabled</span> and startsAt is in the past (and
        endsAt is empty or in the future), it will show on the site.
      </div>
    </div>
  );
}
