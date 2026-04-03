// app/admin/products/[id]/edit/ImageField.tsx
"use client";

import * as React from "react";

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function ImageField({ initialUrl }: { initialUrl: string }) {
  const [url, setUrl] = React.useState(initialUrl);
  const [uploading, setUploading] = React.useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: fd,
      });

      const data: any = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || `Upload failed (${res.status})`);
      }

      setUrl(String(data?.url || ""));
    } catch (err: any) {
      alert(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div>
      <label className="text-sm text-white/70">Product image</label>

      {/* this is what gets submitted */}
      <input type="hidden" name="image" value={url} readOnly />

      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-white/20 flex items-center justify-between cursor-pointer">
          <span className="text-sm text-white/80">
            {uploading ? "Uploading..." : "Upload image"}
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
        </label>

        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-white/20 text-sm"
          placeholder="...or paste an image URL"
        />
      </div>

      {url ? (
        <div className="mt-2 text-xs text-white/50 break-all">
          Current: {url}
        </div>
      ) : (
        <div className="mt-2 text-xs text-white/50">No image set.</div>
      )}
    </div>
  );
}
