"use client";

import { useState } from "react";

export default function StockNotifyButton({ productId }: { productId: string }) {
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/stock-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, email }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setErr(json?.error || "Failed. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setErr("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        ✓ We will email you when this is back in stock.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-full border border-black/20 bg-white px-4 py-2.5 text-sm font-medium text-black/70 hover:bg-black/5"
      >
        Notify me when available
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        className="w-full rounded-xl border border-black/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-black/30"
      />
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-full bg-black text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Saving..." : "Notify me"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-black/15 px-4 py-2.5 text-sm hover:bg-black/5"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
