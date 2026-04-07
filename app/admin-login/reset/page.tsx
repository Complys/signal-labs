"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (data.ok) { setDone(true); setTimeout(() => router.push("/admin-login"), 3000); }
      else setError(data.error || "Invalid or expired reset link");
    } catch { setError("Something went wrong"); }
    setLoading(false);
  }

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="bg-white rounded-2xl border p-7 max-w-sm w-full text-center">
        <p className="text-red-600 text-sm">Invalid reset link. Please request a new one.</p>
        <button onClick={() => router.push("/admin-login")} className="mt-4 text-xs text-gray-400 hover:text-gray-600">Back to sign in</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">SL</span>
            </div>
            <span className="font-semibold text-lg">Signal Labs</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-7 shadow-sm">
          {done ? (
            <div className="text-center">
              <div className="text-3xl mb-3">✓</div>
              <h2 className="font-semibold text-lg mb-1">Password updated!</h2>
              <p className="text-sm text-gray-500">Redirecting you to sign in...</p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold mb-1">Set new password</h1>
              <p className="text-sm text-gray-500 mb-6">Choose a strong password for your admin account.</p>
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">New password</label>
                  <div className="relative">
                    <input
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirm password</label>
                  <input
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    required
                  />
                </div>
                {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700">{error}</div>}
                <button className="w-full rounded-xl bg-black text-white px-3 py-2.5 text-sm font-medium hover:bg-black/85 transition disabled:opacity-50" type="submit" disabled={loading}>
                  {loading ? "Updating..." : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPage() {
  return <Suspense><ResetPageInner /></Suspense>;
}
