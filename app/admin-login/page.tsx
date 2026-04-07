"use client"

import { signIn } from "next-auth/react"
import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function LoginPageInner() {
  const router = useRouter()
  const sp = useSearchParams()
  const callbackUrl = sp.get("callbackUrl") || "/admin/dashboard"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<"login" | "reset">("login")
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    })

    setLoading(false)

    if (!res || res.error) {
      setError("Invalid email or password. Please check your details and try again.")
      return
    }

    router.push(callbackUrl)
  }

  async function onReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setResetLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.ok) {
        setResetSent(true)
      } else {
        setError(data.error || "Something went wrong")
      }
    } catch {
      setError("Something went wrong. Please try again.")
    }
    setResetLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">SL</span>
            </div>
            <span className="font-semibold text-lg">Signal Labs</span>
          </div>
          <p className="text-sm text-gray-500">Admin Portal</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-7 shadow-sm">
          {mode === "login" ? (
            <>
              <h1 className="text-xl font-semibold mb-1">Sign in</h1>
              <p className="text-sm text-gray-500 mb-6">Manage your Signal Labs store</p>

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Email address</label>
                  <input
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/30 transition"
                    placeholder="you@example.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/30 transition"
                      placeholder="Your password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  className="w-full rounded-xl bg-black text-white px-3 py-2.5 text-sm font-medium hover:bg-black/85 transition disabled:opacity-50"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              </form>

              <button
                onClick={() => { setMode("reset"); setError(null); }}
                className="mt-4 w-full text-center text-xs text-gray-400 hover:text-gray-600 transition"
              >
                Forgot your password?
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setMode("login"); setError(null); setResetSent(false); }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-4 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Back to sign in
              </button>

              <h1 className="text-xl font-semibold mb-1">Reset password</h1>
              <p className="text-sm text-gray-500 mb-6">
                Enter your email and we&apos;ll send a reset link to your inbox.
              </p>

              {resetSent ? (
                <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-4 text-sm text-green-800">
                  <p className="font-medium">Reset email sent!</p>
                  <p className="mt-1 text-green-700">Check your inbox at <strong>{email}</strong> for the reset link. It expires in 1 hour.</p>
                </div>
              ) : (
                <form onSubmit={onReset} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Email address</label>
                    <input
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/30 transition"
                      placeholder="you@example.com"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <button
                    className="w-full rounded-xl bg-black text-white px-3 py-2.5 text-sm font-medium hover:bg-black/85 transition disabled:opacity-50"
                    type="submit"
                    disabled={resetLoading}
                  >
                    {resetLoading ? "Sending..." : "Send reset link"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Signal Laboratories · Admin Portal
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}
