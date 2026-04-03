// app/cancel/page.tsx
import Link from "next/link";

export default function CancelPage() {
  return (
    <main className="min-h-screen bg-[#F6F8FB] text-[#0B1220] flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Checkout cancelled
        </h1>

        <p className="mt-3 text-sm sm:text-base text-black/70">
          No worries — you haven’t been charged. You can return to your cart or
          keep browsing.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link
            href="/cart"
            className="inline-flex items-center justify-center rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
          >
            Back to cart
          </Link>

          <Link
            href="/products"
            className="inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-5 py-2.5 text-sm font-semibold hover:bg-black/5 transition"
          >
            Return to products
          </Link>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-5 py-2.5 text-sm font-semibold hover:bg-black/5 transition"
          >
            Back to home
          </Link>
        </div>

        <p className="mt-6 text-xs text-black/50">
          If you saw an error during checkout, try again — or contact support if
          it keeps happening.
        </p>
      </div>
    </main>
  );
}

