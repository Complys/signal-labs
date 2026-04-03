"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

function AffiliateLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/affiliate/dashboard",
      });

      if (result?.error) {
        setErr("Invalid email or password.");
        return;
      }

      router.push("/affiliate/dashboard");
    } catch {
      setErr("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0B1220] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Image src="/signal-logo.png" alt="Signal Labs" width={160} height={42} className="h-10 w-auto" />
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <h1 className="text-xl font-semibold">Affiliate Login</h1>
          <p className="mt-2 text-sm text-white/60">
            Sign in to view your earnings and referral dashboard.
          </p>

          <form onSubmit={submit} className="mt-6 grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs text-white/60">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/25 placeholder:text-white/25"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs text-white/60">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/25 placeholder:text-white/25"
              />
            </label>

            {err && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-yellow-400 text-black px-6 py-3 text-sm font-semibold hover:opacity-95 disabled:opacity-60 mt-2"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-xs text-white/40 text-center">
            Not an affiliate yet?{" "}
            <Link href="/affiliates/apply" className="underline text-white/60">
              Apply here
            </Link>
          </p>
        </div>

        <p className="mt-6 text-xs text-white/30 text-center">
          Signal Labs products are for research use only.
        </p>
      </div>
    </main>
  );
}

export default function AffiliateLoginPage() {
  return (
    <Suspense>
      <AffiliateLoginForm />
    </Suspense>
  );
}
