"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function AffiliateSettingsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (status === "unauthenticated") {
    router.push("/affiliate/login");
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (newPass.length < 8) return setErr("New password must be at least 8 characters.");
    if (newPass !== confirm) return setErr("Passwords do not match.");

    setLoading(true);
    try {
      const res = await fetch("/api/affiliate/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: newPass }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setErr(json?.error || "Failed to change password.");
        return;
      }
      setOk("Password updated successfully.");
      setCurrent("");
      setNewPass("");
      setConfirm("");
    } catch {
      setErr("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0B1220] text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto max-w-xl flex items-center justify-between">
          <Image src="/signal-logo.png" alt="Signal Labs" width={140} height={36} className="h-8 w-auto" />
          <Link href="/affiliate/dashboard" className="text-sm text-white/50 hover:text-white">
            Back to dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Account settings</h1>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-base font-semibold">Change password</h2>
          <p className="mt-1 text-sm text-white/50">
            If you received a temporary password, change it here.
          </p>

          <form onSubmit={submit} className="mt-5 grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs text-white/60">Current password</span>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/25 placeholder:text-white/25"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs text-white/60">New password</span>
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/25 placeholder:text-white/25"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs text-white/60">Confirm new password</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/25 placeholder:text-white/25"
              />
            </label>

            {err && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {err}
              </div>
            )}
            {ok && (
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                {ok}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-yellow-400 text-black px-6 py-3 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
            >
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
