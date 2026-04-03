"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const callbackUrl = search.get("callbackUrl") || "/account";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to register");

        const login = await signIn("credentials", {
          email,
          password,
          redirect: false,
          callbackUrl,
        });

        if (login?.error) throw new Error("Registered, but login failed. Try signing in.");
        router.push(callbackUrl);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) throw new Error("Invalid email or password");
      router.push(callbackUrl);
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F6F8FB] text-[#0B1220] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-black/10 bg-white shadow-sm p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">
            {mode === "login" ? "Sign in" : "Create account"}
          </h1>

          <button
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-sm text-black/70 hover:text-black"
            type="button"
          >
            {mode === "login" ? "Register" : "Have an account?"}
          </button>
        </div>

        <p className="mt-2 text-sm text-black/60">
          {mode === "login"
            ? "Sign in to view orders, tracking and addresses."
            : "Create an account to track orders and manage your details."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div>
            <label className="text-xs text-black/60">Email</label>
            <input
              className="mt-1 w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              required
            />
          </div>

          <div>
            <label className="text-xs text-black/60">Password</label>
            <input
              className="mt-1 w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            {mode === "register" && (
              <p className="mt-2 text-[11px] text-black/50">Min 8 characters.</p>
            )}
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-full bg-black text-white px-4 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-xs text-black/55">
          By continuing, you agree to the research-use policy.{" "}
          <Link href="/research-use-policy" className="underline">
            View policy
          </Link>
        </p>

        <p className="mt-4 text-[11px] text-black/45">
          Admin? Use{" "}
          <Link className="underline" href="/admin/login">
            /admin/login
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
