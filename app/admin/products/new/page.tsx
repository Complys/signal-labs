// app/admin/products/new/page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

const UPLOAD_ENDPOINT = "/api/upload";
const CREATE_ENDPOINT = "/api/admin/products";

function poundsStringToPennies(value: string): number | null {
  const raw = String(value ?? "")
    .replace("£", "")
    .replace(/,/g, "")
    .trim();

  if (!raw) return 0;

  // allow "12", "12.", "12.3", "12.34"
  if (!/^\d+(\.\d{0,2})?$/.test(raw)) return null;

  const [pounds, pence = ""] = raw.split(".");
  const pence2 = (pence + "00").slice(0, 2);
  const pennies = Number(pounds) * 100 + Number(pence2);

  if (!Number.isFinite(pennies) || pennies < 0) return null;
  return Math.trunc(pennies);
}

function clampInt(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function isProbablyUrl(s: string) {
  const v = (s || "").trim();
  return /^https?:\/\/\S+$/i.test(v) || v.startsWith("/uploads/");
}

async function uploadFileToServer(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(UPLOAD_ENDPOINT, {
    method: "POST",
    body: fd,
    cache: "no-store",
    credentials: "same-origin",
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(data?.error || "Upload failed");

  const url = String(data?.url || "");
  if (!url) throw new Error("Upload response missing url");
  return url;
}

export default function NewProductPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // selling price
  const [price, setPrice] = useState("0.00");

  // unit cost (your cost / COGS)
  const [unitCost, setUnitCost] = useState("0.00");

  const [stock, setStock] = useState<number>(0);

  const [image, setImage] = useState<string>(""); // stored URL
  const [isActive, setIsActive] = useState(true);
  const [variants, setVariants] = useState<Array<{ label: string; pricePennies: number; image: string }>>([]);

  const [variantUploading, setVariantUploading] = useState<number | null>(null);

  async function uploadVariantImage(i: number, file: File) {
    setVariantUploading(i);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Upload failed");
      updateVariant(i, "image", data.url);
    } catch (e: any) {
      alert(e?.message || "Upload failed");
    } finally {
      setVariantUploading(null);
    }
  }

  function addVariant() { setVariants((v) => [...v, { label: "", pricePennies: 0, image: "" }]); }
  function removeVariant(i: number) { setVariants((v) => v.filter((_, idx) => idx !== i)); }
  function updateVariant(i: number, field: string, val: string) {
    setVariants((v) => v.map((item, idx) => {
      if (idx !== i) return item;
      if (field === "pricePennies") return { ...item, pricePennies: Math.round(parseFloat(val.replace(/[^0-9.]/g,"")) * 100) || 0 };
      return { ...item, [field]: val };
    }));
  }
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pricePennies = useMemo(() => poundsStringToPennies(price), [price]);
  const costPennies = useMemo(() => poundsStringToPennies(unitCost), [unitCost]);

  const canPreview = useMemo(() => isProbablyUrl(image), [image]);

  function setFieldError(key: string, msg: string) {
    setFieldErrors((prev) => ({ ...prev, [key]: msg }));
  }

  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handlePickAndUpload(file: File) {
    setError("");
    clearFieldError("image");

    try {
      setUploading(true);
      const url = await uploadFileToServer(file);
      setImage(url);
    } catch (e: any) {
      setError(e?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    await handlePickAndUpload(file);
  }

  async function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await handlePickAndUpload(file);
  }

  function validate(): boolean {
    setError("");
    setFieldErrors({});

    const n = name.trim();
    if (!n) setFieldError("name", "Name is required");

    if (pricePennies === null) setFieldError("price", "Enter a valid price (e.g. 12.99)");
    if (costPennies === null) setFieldError("unitCost", "Enter a valid cost (e.g. 4.50)");

    const st = Number(stock);
    if (!Number.isFinite(st) || st < 0) setFieldError("stock", "Stock must be 0 or more");

    if (image && !isProbablyUrl(image)) {
      setFieldError("image", "Image must be a valid URL or /uploads path");
    }

    const hasName = !!n;
    const hasPrice = pricePennies !== null;
    const hasCost = costPennies !== null;
    const hasStock = Number.isFinite(st) && st >= 0;
    const hasImage = !image || isProbablyUrl(image);

    return hasName && hasPrice && hasCost && hasStock && hasImage;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || uploading) return;
    if (!validate()) return;

    const safeStock = clampInt(Number(stock) || 0, 0, 1_000_000);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      price: pricePennies ?? 0, // pennies (Int)
      costPennies: costPennies ?? 0, // pennies (Int)  ✅ NEW
      stock: safeStock,
      image: image.trim() || null,
      isActive: !!isActive,

      // Optional: note for initial stock purchase (server can use this)
      initialStockNote:
        safeStock > 0 ? "Initial stock set on product creation" : null,
      variantsJson: JSON.stringify(variants),
    };

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(CREATE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        const msg =
          data?.error ||
          data?.message ||
          "Failed to create product. Check the API route and server logs.";
        setError(msg);

        if (data?.fieldErrors && typeof data.fieldErrors === "object") {
          setFieldErrors(data.fieldErrors);
        }
        return;
      }

      const id = data?.id || data?.product?.id;
      if (id) router.push(`/admin/products/${id}/edit`);
      else router.push("/admin/products");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Create Product</h1>
            <p className="mt-2 text-white/60">
              Add a new product to your storefront (Research Use Only).
            </p>
          </div>

          <Link
            href="/admin/products"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Back to Products
          </Link>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
        >
          {error ? (
            <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-5">
            {/* Name */}
            <div>
              <label className="mb-2 block text-sm text-white/70">Name</label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearFieldError("name");
                }}
                placeholder="e.g. BPC-157 5mg (Research Use Only)"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-yellow-400/60"
              />
              {fieldErrors.name ? (
                <p className="mt-2 text-xs text-red-300">{fieldErrors.name}</p>
              ) : null}
            </div>

            {/* Description */}
            <div>
              <label className="mb-2 block text-sm text-white/70">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short clear description"
                rows={5}
                className="w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-yellow-400/60"
              />
            </div>

            {/* Price + Unit Cost + Stock */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm text-white/70">Price (£)</label>
                <input
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => {
                    setPrice(e.target.value);
                    clearFieldError("price");
                  }}
                  placeholder="0.00"
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-yellow-400/60"
                />
                <p className="mt-2 text-xs text-white/45">Selling price (pennies stored).</p>
                {fieldErrors.price ? (
                  <p className="mt-2 text-xs text-red-300">{fieldErrors.price}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/70">Unit cost (£)</label>
                <input
                  inputMode="decimal"
                  value={unitCost}
                  onChange={(e) => {
                    setUnitCost(e.target.value);
                    clearFieldError("unitCost");
                  }}
                  placeholder="0.00"
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-yellow-400/60"
                />
                <p className="mt-2 text-xs text-white/45">
                  What you paid per unit (for profit analytics).
                </p>
                {fieldErrors.unitCost ? (
                  <p className="mt-2 text-xs text-red-300">{fieldErrors.unitCost}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/70">Stock</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={Number.isFinite(stock) ? stock : 0}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setStock(Number.isFinite(n) ? n : 0);
                    clearFieldError("stock");
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-yellow-400/60"
                />
                <p className="mt-2 text-xs text-white/45">
                  If you set stock &amp; unit cost, we can record the initial inventory spend.
                </p>
                {fieldErrors.stock ? (
                  <p className="mt-2 text-xs text-red-300">{fieldErrors.stock}</p>
                ) : null}
              </div>
            </div>

            {/* Image uploader */}
            <div>
              <label className="mb-2 block text-sm text-white/70">Product Image</label>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={onDrop}
                className="rounded-2xl border border-white/10 bg-black/40 p-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">Drag &amp; drop an image</p>
                    <p className="mt-1 text-xs text-white/45">PNG / JPG / WEBP up to 5MB</p>
                    <p className="mt-2 text-xs text-white/45">
                      {image ? (
                        <>
                          Current: <span className="text-white/80">{image}</span>
                        </>
                      ) : (
                        "No image uploaded yet."
                      )}
                    </p>
                    {fieldErrors.image ? (
                      <p className="mt-2 text-xs text-red-300">{fieldErrors.image}</p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={onFileChange}
                      disabled={uploading || submitting}
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || submitting}
                      className="rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-semibold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploading ? "Uploading..." : "Upload"}
                    </button>

                    {image ? (
                      <button
                        type="button"
                        onClick={() => setImage("")}
                        disabled={uploading || submitting}
                        className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-xs text-white/50">Or paste an image URL</label>
                  <input
                    value={image}
                    onChange={(e) => {
                      setImage(e.target.value);
                      clearFieldError("image");
                    }}
                    placeholder="https://... or /uploads/..."
                    className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-yellow-400/60"
                  />
                </div>

                {canPreview ? (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/60">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="Preview" className="h-56 w-full object-contain" />
                  </div>
                ) : null}
              </div>
            </div>

            {/* Variants */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm text-white/80 font-semibold mb-1">Size variants</div>
              <div className="text-xs text-white/50 mb-3">
                Add variants if this product comes in different sizes with different prices. Leave empty for a single-price product.
              </div>

              <div className="space-y-3">
                {variants.map((v, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Label e.g. 5mg"
                        value={v.label}
                        onChange={(e) => updateVariant(i, "label", e.target.value)}
                        className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400/60 placeholder:text-white/30"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Price £"
                        value={(v.pricePennies / 100).toFixed(2)}
                        onChange={(e) => updateVariant(i, "pricePennies", e.target.value)}
                        className="w-28 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400/60"
                      />
                      <button
                        type="button"
                        onClick={() => removeVariant(i)}
                        className="text-red-400 hover:text-red-300 text-lg px-2"
                      >
                        ×
                      </button>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="text-[11px] text-white/50 mb-2">Variant image (optional — can add later)</div>
                      {v.image ? (
                        <div className="flex items-center gap-3 mb-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={v.image} alt={v.label} className="h-12 w-12 rounded-lg object-cover border border-white/10" />
                          <button type="button" onClick={() => updateVariant(i, "image", "")} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                        </div>
                      ) : null}
                      <div
                        className="border-2 border-dashed border-white/20 rounded-xl p-3 text-center cursor-pointer hover:border-white/40 transition"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) uploadVariantImage(i, f); }}
                        onClick={() => { const inp = document.createElement("input"); inp.type="file"; inp.accept="image/png,image/jpeg,image/webp"; inp.onchange=(e)=>{ const f=(e.target as HTMLInputElement).files?.[0]; if(f) uploadVariantImage(i,f); }; inp.click(); }}
                      >
                        {variantUploading === i ? <p className="text-xs text-white/50">Uploading…</p> : <p className="text-xs text-white/40">Drop or <span className="text-yellow-400 underline">click to upload</span></p>}
                      </div>
                      <input type="text" placeholder="Or paste URL" value={v.image} onChange={(e) => updateVariant(i, "image", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-yellow-400/60 placeholder:text-white/30" />
                    </div>
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


            {/* Active */}
            <div className="flex items-center gap-3">
              <input
                id="active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-yellow-400"
              />
              <label htmlFor="active" className="text-sm text-white/70">
                Active (visible on storefront)
              </label>
            </div>

            {/* Actions */}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={submitting || uploading}
                className="rounded-2xl bg-yellow-400 px-7 py-3 text-sm font-semibold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creating..." : "Create"}
              </button>

              <Link
                href="/admin/products"
                className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm hover:bg-white/10"
              >
                Cancel
              </Link>
            </div>

            <p className="text-xs text-white/35">
              Tip: if Create fails, check your API route:{" "}
              <code className="text-white/60">{CREATE_ENDPOINT}</code>
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}