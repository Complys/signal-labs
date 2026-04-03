"use client";

import { useEffect, useMemo, useState } from "react";

type Promo = { enabled: boolean; headline: string; code: string };

export default function PromoPopup() {
  const [open, setOpen] = useState(false);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const storageKey = useMemo(() => "promo_popup_dismissed_v1", []);

  useEffect(() => {
    const dismissed = typeof window !== "undefined" && localStorage.getItem(storageKey);
    if (dismissed) return;

    (async () => {
      const res = await fetch("/api/promo", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as Promo;
      setPromo(data);
      if (data.enabled) setOpen(true);
    })();
  }, [storageKey]);

  function close() {
    setOpen(false);
    localStorage.setItem(storageKey, "1");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Something went wrong.");

      setRevealedCode(data.code);
      localStorage.setItem(storageKey, "1"); // don’t show again after signup
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !promo) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* backdrop */}
      <button
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-black/60"
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0B1220] text-white shadow-2xl">
        <button
          onClick={close}
          className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/15"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="p-7">
          <div className="text-center">
            <p className="text-2xl font-semibold tracking-tight">{promo.headline}</p>
            <p className="mt-2 text-sm text-white/70">
              Join the list to receive your code and future offers.
            </p>
          </div>

          {revealedCode ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
              <p className="text-sm text-white/70">Your discount code</p>
              <p className="mt-2 text-3xl font-bold tracking-widest">{revealedCode}</p>
              <p className="mt-3 text-xs text-white/60">
                Use this at checkout. (Saved — you won’t see this popup again.)
              </p>
              <button
                onClick={close}
                className="mt-5 w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"
              >
                Continue
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="w-full rounded-2xl bg-white px-4 py-3 text-sm text-black outline-none"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                type="email"
                required
                className="w-full rounded-2xl bg-white px-4 py-3 text-sm text-black outline-none"
              />

              {error ? <p className="text-sm text-red-300">{error}</p> : null}

              <button
                disabled={submitting}
                className="w-full rounded-full bg-blue-500 px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Reveal Code"}
              </button>

              <p className="text-center text-xs text-white/50">
                Research-use products only. Unsubscribe anytime.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
