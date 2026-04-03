import Image from "next/image";
import Link from "next/link";
import WeeklySpecialsSection from "./_components/WeeklySpecialsSection";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Signal Labs | Research Products",
  description:
    "Signal Labs supplies research-use products for laboratory and analytical purposes. Secure ordering and tracked UK dispatch.",
};

const badges = ["Tracked Delivery", "Secure Checkout", "UK Dispatch", "Account Support"];

export default async function HomePage() {
  // Only used for the count in the “Available Products” text (no product grid on home).
  const productsCount = await prisma.product.count({
    where: { isActive: true },
  });

  return (
    <main className="min-h-screen bg-[#F6F8FB] text-[#0B1220]">
      {/* HERO */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 pt-8">
        {/* Banner */}
        <div className="rounded-3xl border border-black/10 bg-white shadow-sm overflow-hidden">
          <div className="relative w-full h-[clamp(170px,18vw,260px)] bg-white">
            <Image
              src="/signal-banner.png"
              alt="Signal Labs"
              fill
              priority
              sizes="(max-width:768px) 100vw, 1200px"
              className="object-cover"
            />
          </div>
        </div>

        {/* Intro Card */}
        <div className="mt-6 rounded-3xl border border-black/10 bg-white shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Research-use products & laboratory supplies
          </h1>

          <p className="mt-3 text-sm sm:text-base text-black/65 max-w-2xl">
            Signal Labs supplies research-use products for laboratory and analytical purposes only.
            Secure checkout and tracked UK dispatch.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            {/* IMPORTANT: this now goes to /products (not home / #products) */}
            <Link
              href="/products"
              className="rounded-full bg-black text-white px-5 py-2 text-sm font-medium hover:opacity-90"
            >
              View Products
            </Link>

            <Link
              href="/research-use-policy"
              className="rounded-full border border-black/15 bg-white px-5 py-2 text-sm font-medium hover:bg-black/5"
            >
              Research-use Policy
            </Link>
          </div>

          {/* BOLDER BADGES */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {badges.map((item) => (
              <div
                key={item}
                className="
                  rounded-2xl border border-black/15
                  bg-black/[0.03]
                  px-4 py-3
                  text-sm font-medium
                  text-black/80
                "
              >
                {item}
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm text-black/60">
            {productsCount} product{productsCount === 1 ? "" : "s"} available. See the full catalogue on the products page.
          </p>
        </div>
      </section>

      {/* WEEKLY SPECIALS (HOME = specials only) */}
      <section className="mt-10 pb-14">
        <WeeklySpecialsSection title="Weekly Specials" showViewProducts={false} />
      </section>

      {/* ORDER SUPPORT */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 pb-16">
        <div className="rounded-3xl border border-black/10 bg-white shadow-sm p-6 sm:p-8">
          <h3 className="text-base font-semibold">Order & Account Support</h3>

          <p className="mt-2 text-sm text-black/65 max-w-3xl">
            For assistance with orders, payments, delivery tracking, returns, or account access,
            please contact support.
          </p>

          <div className="mt-5">
            <Link
              href="/support"
              className="inline-block rounded-full border border-black/15 px-5 py-2 text-sm font-medium hover:bg-black/5"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
