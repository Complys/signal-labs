"use client";

import { useEffect, useState } from "react";

export default function AnnouncementSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings/announcement")
      .then((r) => r.json())
      .then((d) => setMessage(d.message ?? ""))
      .catch(() => setErr("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function onSave() {
    setSaving(true);
    setSaved(false);
    setErr(null);
    try {
      const res = await fetch("/api/admin/settings/announcement", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
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
      <h1 className="text-2xl font-bold text-white mb-1">Announcement Bar</h1>
      <p className="text-sm text-white/55 mb-6">
        Shown at the top of every page. Leave blank to hide it.
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

          <label className="block">
            <div className="text-xs font-bold text-white/70 mb-1">Message</div>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Due to the Easter bank holiday, orders placed after 1pm Friday will ship Tuesday."
              className="w-full h-10 rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30"
            />
            <div className="mt-1 text-[11px] text-white/40">Leave blank to hide the bar.</div>
          </label>

          <div className="flex items-center gap-3">
            <button
              onClick={onSave}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-full bg-[#f5c400] px-5 text-xs font-extrabold text-black disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && <span className="text-xs font-semibold text-emerald-400">Saved</span>}
          </div>

          {message.trim() ? (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <div className="text-[10px] font-bold text-white/40 px-3 py-1 bg-white/5">Preview</div>
              <div className="bg-[#0B1220] text-white text-sm font-medium text-center px-4 py-2.5">
                {message}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
