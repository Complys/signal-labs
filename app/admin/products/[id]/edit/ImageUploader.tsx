"use client";

import * as React from "react";

export default function ImageUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = React.useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Upload failed");

      onChange(data.url);
    } catch (err: any) {
      alert(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className="rounded-full px-4 py-2 text-sm bg-white/10 hover:bg-white/15 border border-white/10 cursor-pointer">
          {uploading ? "Uploading..." : "Upload image"}
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
        </label>

        {value ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-white/70 underline"
          >
            View current
          </a>
        ) : (
          <span className="text-sm text-white/50">No image yet</span>
        )}
      </div>
    </div>
  );
}
