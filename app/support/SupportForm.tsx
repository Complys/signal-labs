"use client";

import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          theme?: "light" | "dark";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string;
      reset?: (widgetId: string) => void;
    };
  }
}

type SendPayload = {
  name: string;
  email: string;
  subject: string;
  message: string;
  turnstileToken: string;
};

export default function SupportForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [token, setToken] = useState<string>("");

  const formRef = useRef<HTMLFormElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const widgetElRef = useRef<HTMLDivElement | null>(null);

  const siteKey = useMemo(() => {
    return (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string) || "";
  }, []);

  // Load & render Turnstile (explicit mode)
  useEffect(() => {
    if (!siteKey) return;

    const existing = document.querySelector(
      'script[data-turnstile="true"]'
    ) as HTMLScriptElement | null;

    if (!existing) {
      const s = document.createElement("script");
      s.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.defer = true;
      s.dataset.turnstile = "true";
      document.head.appendChild(s);
    }

    const interval = window.setInterval(() => {
      if (!widgetElRef.current) return;
      if (!window.turnstile?.render) return;

      if (!widgetIdRef.current) {
        widgetIdRef.current = window.turnstile.render(widgetElRef.current, {
          sitekey: siteKey,
          theme: "light",
          callback: (t) => setToken(t),
          "expired-callback": () => setToken(""),
          "error-callback": () => setToken(""),
        });
      }

      window.clearInterval(interval);
    }, 250);

    return () => window.clearInterval(interval);
  }, [siteKey]);

  function resetTurnstile() {
    if (widgetIdRef.current && window.turnstile?.reset) {
      window.turnstile.reset(widgetIdRef.current);
    }
    setToken("");
  }

  function readPayload(form: HTMLFormElement): SendPayload {
    const fd = new FormData(form);

    return {
      name: String(fd.get("name") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      subject: String(fd.get("subject") || "").trim(),
      message: String(fd.get("message") || "").trim(),
      turnstileToken: token || "",
    };
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // hard stop double-submits
    if (loading) return;

    setLoading(true);
    setError(null);
    setSent(null);

    // If Turnstile is enabled but no token, block submit
    if (siteKey && !token) {
      setLoading(false);
      setError("Please complete the verification check.");
      return;
    }

    const formEl = formRef.current ?? e.currentTarget;
    const payload = readPayload(formEl);

    // Optional: basic client validation (keeps your API cleaner)
    if (!payload.name || !payload.email || !payload.subject || !payload.message) {
      setLoading(false);
      setError("Please fill in all fields.");
      return;
    }

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
        resetTurnstile();
        setLoading(false);
        return;
      }

      // ✅ reset form safely (no e.currentTarget issues)
      formRef.current?.reset();
      setSent("Message sent. We’ll reply by email as soon as possible.");
      resetTurnstile();
      setLoading(false);
    } catch {
      setError("Network error. Please try again.");
      resetTurnstile();
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="mt-6 space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-black/75">Name</label>
          <input
            name="name"
            required
            className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
            placeholder="Your name"
            autoComplete="name"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-black/75">Email</label>
          <input
            name="email"
            type="email"
            required
            className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
            placeholder="you@domain.com"
            autoComplete="email"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-black/75">Subject</label>
        <input
          name="subject"
          required
          className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
          placeholder="Order / Delivery / Account"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-black/75">Message</label>
        <textarea
          name="message"
          required
          rows={6}
          className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
          placeholder="Please include your order number if applicable."
        />
      </div>

      {/* Turnstile (shows only if NEXT_PUBLIC_TURNSTILE_SITE_KEY exists) */}
      {siteKey ? (
        <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
          <div className="text-sm font-medium text-black/75">Verification</div>
          <div className="mt-3" ref={widgetElRef} />
          <p className="mt-2 text-xs text-black/45">
            This helps protect the form from spam.
          </p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-black text-white px-6 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Sending…" : "Submit enquiry"}
      </button>

      {sent && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {sent}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <p className="text-xs text-black/45">
        By submitting this form you confirm the information provided is accurate.
      </p>
    </form>
  );
}
