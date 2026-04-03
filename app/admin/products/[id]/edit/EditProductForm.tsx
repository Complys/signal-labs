"use client";

import React, { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import type { EditActionState } from "./page";

type Defaults = {
  name: string;
  description: string;

  price: string; // pounds string e.g. "29.99"
  cost: string;  // ✅ NEW: pounds string e.g. "12.50" or ""

  stock: string;
  image: string;
  isActive: boolean;
  variants: Array<{ label: string; pricePennies: number }>;

  // Weekly Specials / Deals
  onSpecial: boolean;
  specialPrice: string; // pounds string e.g. "24.99" or ""
};

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-full bg-yellow-400 text-black px-5 py-3 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
    >
      {pending ? "Saving..." : "Save changes"}
    </button>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-2 text-xs text-red-200/90">{msg}</p>;
}

function toNumberOrNaN(v: string) {
  const s = String(v ?? "").replace("£", "").replace(/,/g, "").trim();
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function fmt2(n: number) {
  return n.toFixed(2);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function pctOff(original: number, special: number) {
  if (!Number.isFinite(original) || original <= 0) return 0;
  if (!Number.isFinite(special) || special < 0) return 0;
  const pct = Math.round(((original - special) / original) * 100);
  return clamp(pct, 0, 99);
}

function marginPct(sell: number, cost: number) {
  if (!Number.isFinite(sell) || sell <= 0) return NaN;
  if (!Number.isFinite(cost) || cost < 0) return NaN;
  return ((sell - cost) / sell) * 100;
}

export default function EditProductForm({
  action,
  defaults,
}: {
  action: (prev: EditActionState, formData: FormData) => Promise<EditActionState>;
  defaults: Defaults;
}) {
  const router = useRouter();

  const [state, formAction] = useActionState<EditActionState, FormData>(action, {
    ok: false,
    message: "",
    fieldErrors: {},
  });

  useEffect(() => {
    if (state?.ok) {
      router.push("/admin/products");
      router.refresh();
    }
  }, [state?.ok, router]);

  const fe = state?.fieldErrors ?? {};

  const inputCls =
    "mt-2 w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-white/20";
  const inputErrCls =
    "mt-2 w-full rounded-2xl bg-black/30 border border-red-500/40 px-4 py-3 outline-none focus:border-red-500/60";

  // Live state
  const [priceLive, setPriceLive] = useState(defaults.price);
  const [costLive, setCostLive] = useState(defaults.cost); // ✅ NEW
  const [specialLive, setSpecialLive] = useState(defaults.specialPrice);
  const [onSpecialLive, setOnSpecialLive] = useState(defaults.onSpecial);
  const [percentLive, setPercentLive] = useState<string>("");
  const [variants, setVariants] = useState<Array<{ label: string; pricePennies: number }>>(defaults.variants ?? []);

  function addVariant() { setVariants((v) => [...v, { label: "", pricePennies: 0 }]); }
  function removeVariant(i: number) { setVariants((v) => v.filter((_, idx) => idx !== i)); }
  function updateVariant(i: number, field: "label" | "pricePennies", val: string) {
    setVariants((v) => v.map((item, idx) =>
      idx !== i ? item :
      field === "label" ? { ...item, label: val } :
      { ...item, pricePennies: Math.round(parseFloat(val.replace(/[^0-9.]/g,"")) * 100) || 0 }
    ));
  }

  const priceNum = useMemo(() => toNumberOrNaN(priceLive), [priceLive]);
  const costNum = useMemo(() => toNumberOrNaN(costLive), [costLive]);

  const specialIsBlank = useMemo(() => String(specialLive ?? "").trim() === "", [specialLive]);
  const specialNumRaw = useMemo(() => toNumberOrNaN(specialLive), [specialLive]);
  const specialNum = specialIsBlank ? NaN : specialNumRaw;

  // If blank special, server treats it as "same as price"
  const effectiveSpecial = Number.isFinite(specialNum) ? specialNum : priceNum;

  const showPreview =
    onSpecialLive &&
    Number.isFinite(priceNum) &&
    priceNum >= 0 &&
    Number.isFinite(effectiveSpecial) &&
    effectiveSpecial >= 0;

  const discount = showPreview ? pctOff(priceNum, effectiveSpecial) : 0;
  const isDiscounting = showPreview && effectiveSpecial < priceNum;
  const isIncreasing = showPreview && effectiveSpecial > priceNum;

  const specialInvalidHigher =
    onSpecialLive &&
    !specialIsBlank &&
    Number.isFinite(priceNum) &&
    Number.isFinite(specialNum) &&
    specialNum >= priceNum;

  const specialInvalidNaN =
    onSpecialLive && !specialIsBlank && (!Number.isFinite(specialNum) || specialNum < 0);

  const clientBlockMessage = useMemo(() => {
    if (!onSpecialLive) return "";
    if (!Number.isFinite(priceNum) || priceNum <= 0) return "Enter a valid normal price first.";
    if (specialInvalidNaN) return "Special price must be a valid number (or leave blank).";
    if (specialInvalidHigher) return "Special price must be LOWER than the normal price.";
    return "";
  }, [onSpecialLive, priceNum, specialInvalidNaN, specialInvalidHigher]);

  function applyPercent(pct: number) {
    if (!Number.isFinite(priceNum) || priceNum <= 0) return;

    const safePct = clamp(pct, 0, 99);
    const newSpecial = priceNum * (1 - safePct / 100);

    setOnSpecialLive(true);
    setSpecialLive(fmt2(Math.max(0, newSpecial)));
    setPercentLive(String(safePct));
  }

  function onPercentChange(v: string) {
    setPercentLive(v);
    const pct = toNumberOrNaN(v);
    if (!Number.isFinite(pct)) return;
    applyPercent(pct);
  }

  // ✅ simple margin preview (uses effective selling price if on special)
  const sellForMargin = showPreview ? effectiveSpecial : priceNum;
  const margin = useMemo(() => {
    if (!Number.isFinite(sellForMargin) || sellForMargin <= 0) return NaN;
    if (!Number.isFinite(costNum) || costNum < 0) return NaN;
    return marginPct(sellForMargin, costNum);
  }, [sellForMargin, costNum]);

  return (
    <form action={formAction} className="space-y-5">
      {state?.message ? (
        <div
          className={`rounded-2xl border p-3 text-sm ${
            state.ok
              ? "border-green-500/25 bg-green-500/10 text-green-100"
              : "border-red-500/25 bg-red-500/10 text-red-100"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <div>
        <label className="text-sm text-white/70">Name</label>
        <input
          name="name"
          defaultValue={defaults.name}
          className={fe.name ? inputErrCls : inputCls}
          required
        />
        <FieldError msg={fe.name} />
      </div>

      <div>
        <label className="text-sm text-white/70">Description</label>
        <textarea
          name="description"
          defaultValue={defaults.description}
          className={fe.description ? inputErrCls : inputCls}
          placeholder="Optional"
        />
        <FieldError msg={fe.description} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-sm text-white/70">Price (GBP)</label>
          <input
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaults.price}
            onChange={(e) => setPriceLive(e.target.value)}
            className={fe.price ? inputErrCls : inputCls}
            required
          />
          <FieldError msg={fe.price} />
        </div>

        <div>
          <label className="text-sm text-white/70">Cost (GBP)</label>
          <input
            name="cost"
            type="number"
            step="0.01"
            min="0"
            value={costLive}
            onChange={(e) => setCostLive(e.target.value)}
            className={fe.cost ? inputErrCls : inputCls}
            placeholder="Optional"
          />
          <FieldError msg={fe.cost} />
          <p className="mt-2 text-xs text-white/40">
            Used for profit analytics (COGS). Leave blank if unknown.
          </p>
        </div>

        <div>
          <label className="text-sm text-white/70">Stock</label>
          <input
            name="stock"
            type="number"
            step="1"
            min={0}
            defaultValue={defaults.stock}
            className={fe.stock ? inputErrCls : inputCls}
          />
          <FieldError msg={fe.stock} />
        </div>
      </div>

      {/* Margin preview */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-sm text-white/80 font-semibold">Profit preview</div>
        <div className="mt-1 text-xs text-white/60">
          Uses selling price (special if enabled) minus cost. Shipping/postage handled on order analytics.
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Sell:{" "}
            <span className="font-semibold">
              {Number.isFinite(sellForMargin) ? `£${fmt2(sellForMargin)}` : "—"}
            </span>
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Cost:{" "}
            <span className="font-semibold">
              {Number.isFinite(costNum) ? `£${fmt2(costNum)}` : "—"}
            </span>
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Margin:{" "}
            <span className={`font-extrabold ${Number.isFinite(margin) ? (margin >= 30 ? "text-emerald-300" : margin >= 10 ? "text-yellow-300" : "text-orange-300") : "text-white/50"}`}>
              {Number.isFinite(margin) ? `${Math.round(margin)}%` : "—"}
            </span>
          </span>
        </div>
      </div>

      <div>
        <label className="text-sm text-white/70">Image URL</label>
        <input
          name="image"
          defaultValue={defaults.image}
          className={fe.image ? inputErrCls : inputCls}
          placeholder="/uploads/..."
        />
        <FieldError msg={fe.image} />
      </div>

      {/* Specials are Deals */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input name="isActive" type="checkbox" defaultChecked={defaults.isActive} />
            Active
          </label>

          <label className="flex items-center gap-2 text-sm text-white/80">
            <input
              name="onSpecial"
              type="checkbox"
              checked={onSpecialLive}
              onChange={(e) => {
                const checked = e.target.checked;
                setOnSpecialLive(checked);

                if (!checked) {
                  setPercentLive("");
                  setSpecialLive("");
                }
              }}
            />
            On special (Weekly Specials)
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-white/70">Special price (GBP)</label>

            <input
              name="specialPrice"
              type="text"
              inputMode="decimal"
              value={specialLive}
              onChange={(e) => {
                setSpecialLive(e.target.value);
                setPercentLive("");
              }}
              className={(fe.specialPrice || clientBlockMessage) ? inputErrCls : inputCls}
              placeholder="Leave blank = same as price"
              disabled={!onSpecialLive}
            />

            <FieldError msg={fe.specialPrice} />

            {clientBlockMessage ? (
              <div className="mt-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-100">
                {clientBlockMessage}
              </div>
            ) : null}

            {/* Percent off */}
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs text-white/60 mb-2">
                Set discount by percentage (auto-fills special price)
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1">
                  <label className="text-xs text-white/60">Percent off (%)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="99"
                    value={percentLive}
                    onChange={(e) => onPercentChange(e.target.value)}
                    className="mt-2 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-white/20"
                    placeholder="e.g. 15"
                    disabled={!onSpecialLive}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const pct = toNumberOrNaN(percentLive);
                    if (Number.isFinite(pct)) applyPercent(pct);
                  }}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
                  disabled={!onSpecialLive}
                >
                  Apply %
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {[10, 15, 20, 25, 30].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applyPercent(p)}
                    className="rounded-full border border-yellow-400/25 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-300 hover:opacity-95 disabled:opacity-50"
                    disabled={!onSpecialLive}
                  >
                    {p}% off
                  </button>
                ))}
              </div>
            </div>

            {/* Live preview */}
            {showPreview ? (
              <div className="mt-3 text-sm">
                <div className="text-white/70">Preview</div>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-white/60">£{fmt2(priceNum)}</span>
                  <span className="text-white/40">→</span>
                  <span className="font-semibold text-white">£{fmt2(effectiveSpecial)}</span>

                  {isDiscounting ? (
                    <span className="ml-1 inline-flex items-center rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                      -{discount}%
                    </span>
                  ) : isIncreasing ? (
                    <span className="ml-1 inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200">
                      Price increased
                    </span>
                  ) : (
                    <span className="ml-1 text-xs text-white/40">(No change)</span>
                  )}
                </div>
              </div>
            ) : null}

            <p className="text-xs text-white/40 mt-2">This creates/updates a Deal for this product.</p>
          </div>

          <div className="text-sm text-white/60 leading-relaxed">
            <div className="font-semibold text-white/80 mb-2">What happens</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>Checked: a Deal is created/kept active</li>
              <li>Unchecked: any active Deal is ended</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Variants */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-sm text-white/80 font-semibold mb-1">Size variants</div>
        <div className="text-xs text-white/50 mb-3">Add variants if this product comes in different sizes with different prices. Leave empty for a single-price product.</div>

        <input type="hidden" name="variantsJson" value={JSON.stringify(variants)} />

        <div className="space-y-2">
          {variants.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Label e.g. 5mg"
                value={v.label}
                onChange={(e) => updateVariant(i, "label", e.target.value)}
                className="flex-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-white/20 placeholder:text-white/30"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Price £"
                defaultValue={(v.pricePennies / 100).toFixed(2)}
                onBlur={(e) => updateVariant(i, "pricePennies", e.target.value)}
                className="w-28 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              />
              <button type="button" onClick={() => removeVariant(i)} className="text-red-400 hover:text-red-300 text-lg px-2">×</button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addVariant}
          className="mt-3 text-xs font-bold text-white/60 hover:text-white border border-white/15 rounded-full px-4 py-1.5"
        >
          + Add variant
        </button>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton disabled={!!clientBlockMessage} />

        <Link
          href="/admin/products"
          className="rounded-full px-5 py-3 text-sm bg-white/10 hover:bg-white/15 border border-white/10"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}