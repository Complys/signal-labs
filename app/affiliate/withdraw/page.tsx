"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

function gbp(pennies: number) {
  return `£${(pennies / 100).toFixed(2)}`;
}

export default function WithdrawPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [availablePennies, setAvailablePennies] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [accountName, setAccountName] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/affiliate/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/affiliate/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setAvailablePennies(d.stats.availablePennies);
        else setErr(d.error || "Failed to load balance.");
      })
      .catch(() => setErr("Failed to load balance."))
      .finally(() => setLoading(false));
  }, [status]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!accountName.trim()) return setErr("Account name is required.");
    if (!sortCode.trim()) return setErr("Sort code is required.");
    if (!accountNumber.trim()) return setErr("Account number is required.");
    if (!idFile) return setErr("Photo ID is required.");
    if (availablePennies < 2500) return setErr("Minimum withdrawal is £25.");

    setSubmitting(true);

    try {
      const form = new FormData();
      form.append("accountName", accountName.trim());
      form.append("sortCode", sortCode.trim());
      form.append("accountNumber", accountNumber.trim());
      form.append("idFile", idFile);

      const res = await fetch("/api/affiliate/withdraw", {
        method: "POST",
        body: form,
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setErr(json?.error || "Withdrawal request failed.");
        return;
      }

      setDone(true);
    } catch {
      setErr("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="min-h-screen bg-[#0B1220] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-2xl font-semibold">Withdrawal requested</h1>
          <p className="mt-3 text-sm text-white/60 max-w-sm mx-auto">
            Your request has been submitted. We will review it and process payment within 5 business days.
            You will receive a confirmation email once it has been approved.
          </p>
          <Link
            href="/affiliate/dashboard"
            className="mt-8 inline-block rounded-full bg-yellow-400 text-black px-6 py-3 text-sm font-semibold hover:opacity-95"
          >
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B1220] text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto max-w-xl flex items-center justify-between">
          <Image src="/signal-logo.png" alt="Signal Labs" width={140} height={36} className="h-8 w-auto brightness-0 invert" />
          <Link href="/affiliate/dashboard" className="text-sm text-white/50 hover:text-white">
            Back to dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Request withdrawal</h1>
        <p className="mt-1 text-sm text-white/50">
          Available balance: <span className="text-yellow-400 font-semibold">{gbp(availablePennies)}</span>
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-white/40">Loading...</p>
        ) : availablePennies < 2500 ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/60">
              You need at least £25 available to request a withdrawal.
              Your current available balance is {gbp(availablePennies)}.
            </p>
            <Link
              href="/affiliate/dashboard"
              className="mt-4 inline-block text-sm text-yellow-400 underline"
            >
              Back to dashboard
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 grid gap-5">

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-white/80">Bank details</p>
              <p className="mt-1 text-xs text-white/40">
                Enter the account you want payment sent to. Details are used for this withdrawal only.
              </p>

              <div className="mt-4 grid gap-4">
                <label className="grid gap-1.5">
                  <span className="text-xs text-white/60">Account holder name</span>
                  <input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Full name on account"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/25 placeholder:text-white/25"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs text-white/60">Sort code</span>
                    <input
                      value={sortCode}
                      onChange={(e) => setSortCode(e.target.value)}
                      placeholder="00-00-00"
                      maxLength={8}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/25 placeholder:text-white/25"
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs text-white/60">Account number</span>
                    <input
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="12345678"
                      maxLength={8}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/25 placeholder:text-white/25"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-white/80">Photo ID</p>
              <p className="mt-1 text-xs text-white/40">
                Upload a clear photo of a valid passport or driving licence. Required for all withdrawals.
              </p>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
                className="mt-3 w-full text-sm text-white/60 file:mr-4 file:rounded-full file:border file:border-white/20 file:bg-white/5 file:px-4 file:py-2 file:text-xs file:text-white/70 file:cursor-pointer"
              />
              {idFile && (
                <p className="mt-2 text-xs text-green-400">✓ {idFile.name}</p>
              )}
            </div>

            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-xs text-yellow-400/80">
              You are requesting a withdrawal of <strong>{gbp(availablePennies)}</strong>.
              Withdrawals are reviewed manually and processed within 5 business days.
            </div>

            {err && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-yellow-400 text-black px-6 py-3 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit withdrawal request"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
