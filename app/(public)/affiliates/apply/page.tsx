"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function upper(v: unknown) {
  return clean(v).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-black/70">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm text-[#0B1220] outline-none focus:border-black/30 focus:ring-2 focus:ring-black/5 placeholder:text-black/30";

export default function AffiliateApplyPage() {
  const [requestedCode, setRequestedCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [youtube, setYoutube] = useState("");
  const [facebook, setFacebook] = useState("");
  const [notes, setNotes] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [codeStatus, setCodeStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const checkCode = useCallback(async (code: string) => {
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (!clean || clean.length < 2) return setCodeStatus("idle");
    setCodeStatus("checking");
    try {
      const res = await fetch(`/api/affiliates/check-code?code=${encodeURIComponent(clean)}`);
      const json = await res.json().catch(() => null);
      setCodeStatus(json?.available ? "available" : "taken");
    } catch {
      setCodeStatus("idle");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => checkCode(requestedCode), 500);
    return () => clearTimeout(timer);
  }, [requestedCode, checkCode]);

  async function submit() {
    setErr(null);
    setOk(null);

    if (!clean(name)) return setErr("Name is required.");
    if (!clean(email)) return setErr("Email is required.");
    if (!clean(requestedCode)) return setErr("Referral code is required.");
    if (!acceptTerms) return setErr("You must agree to the affiliate terms.");

    setLoading(true);

    const payload = {
      requestedCode: upper(requestedCode),
      name: clean(name),
      email: clean(email).toLowerCase(),
      website: clean(website) || null,
      instagram: clean(instagram) || null,
      tiktok: clean(tiktok) || null,
      youtube: clean(youtube) || null,
      facebook: clean(facebook) || null,
      notes: clean(notes) || null,
      acceptTerms,
      termsVersion: "v1",
    };

    try {
      const res = await fetch("/api/affiliates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json || json.ok !== true) {
        setErr(json?.error || "Submission failed. Please try again.");
        return;
      }

      setOk("Application submitted. You will receive an email once your application has been reviewed.");
    } catch (e: any) {
      setErr(e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (ok) {
    return (
      <main className="min-h-screen bg-[#F6F8FB] text-[#0B1220]">
        <div className="mx-auto max-w-xl px-4 py-20 sm:px-6 text-center">
          <div className="rounded-3xl border border-black/10 bg-white shadow-sm p-10">
            <div className="text-4xl mb-4">✓</div>
            <h1 className="text-2xl font-semibold">Application submitted</h1>
            <p className="mt-3 text-sm text-black/65 max-w-sm mx-auto">
              Thank you for applying. We will review your application and email you once a decision has been made.
            </p>
            <Link
              href="/"
              className="mt-8 inline-block rounded-full bg-black text-white px-6 py-2.5 text-sm font-medium hover:opacity-90"
            >
              Back to Signal Labs
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F6F8FB] text-[#0B1220]">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="rounded-3xl border border-black/10 bg-white shadow-sm p-6 sm:p-10">

          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Affiliate Application
          </h1>
          <p className="mt-2 text-sm text-black/60 max-w-lg">
            Apply to promote Signal Labs. If approved, your referral code will go live and you can track earnings and request payouts from your dashboard.
          </p>

          <div className="mt-6 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
            <p className="text-xs text-black/60">
              Signal Labs products are for <strong>research use only</strong>. All affiliate promotional content must reflect this.
              Read the <Link href="/affiliate-terms" target="_blank" rel="noopener noreferrer" className="underline">affiliate terms</Link> before applying.
            </p>
          </div>

          <div className="mt-8 grid gap-5">

            <Field label="Preferred referral code *">
              <input
                className={inputClass}
                value={requestedCode}
                onChange={(e) => setRequestedCode(e.target.value)}
                placeholder="e.g. TIM10"
                maxLength={20}
              />
              <div className="flex items-center gap-2 text-xs">
                {codeStatus === "checking" && <span className="text-black/45">Checking availability...</span>}
                {codeStatus === "available" && <span className="text-green-600 font-medium">✓ Available</span>}
                {codeStatus === "taken" && <span className="text-red-600 font-medium">✗ Already taken — try another</span>}
                {codeStatus === "idle" && <span className="text-black/45">Letters, numbers, hyphens and underscores only. This becomes your unique link.</span>}
              </div>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Full name *">
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                />
              </Field>
              <Field label="Email address *">
                <input
                  className={inputClass}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                />
              </Field>
            </div>

            <Field label="Website (optional)">
              <input
                className={inputClass}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourwebsite.com"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Instagram (optional)">
                <input
                  className={inputClass}
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@handle"
                />
              </Field>
              <Field label="TikTok (optional)">
                <input
                  className={inputClass}
                  value={tiktok}
                  onChange={(e) => setTiktok(e.target.value)}
                  placeholder="@handle"
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="YouTube (optional)">
                <input
                  className={inputClass}
                  value={youtube}
                  onChange={(e) => setYoutube(e.target.value)}
                  placeholder="Channel URL"
                />
              </Field>
              <Field label="Facebook (optional)">
                <input
                  className={inputClass}
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  placeholder="Page or profile URL"
                />
              </Field>
            </div>

            <Field label="Tell us about your audience (optional)">
              <textarea
                className={inputClass}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Describe your audience, platforms, content style, and why you want to promote Signal Labs."
              />
            </Field>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-black/20"
              />
              <span className="text-sm text-black/70">
                I have read and agree to the{" "}
                <Link href="/affiliate-terms" target="_blank" rel="noopener noreferrer" className="underline font-medium text-black">
                  affiliate terms and conditions
                </Link>
                , including the research-use-only promotional restrictions.
              </span>
            </label>

            {err && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {err}
              </div>
            )}

            <button
              onClick={submit}
              disabled={loading}
              className="rounded-full bg-yellow-400 text-black px-6 py-3 text-sm font-semibold hover:opacity-95 disabled:opacity-60 w-full sm:w-auto"
            >
              {loading ? "Submitting..." : "Submit application"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
