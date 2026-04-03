import Link from "next/link";

export const metadata = {
  title: "Research-use Policy | Signal Labs",
  description:
    "Research-use policy for Signal Labs. Products are supplied for laboratory and analytical purposes only.",
};

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-black/40" />
      <span className="text-sm sm:text-base text-black/70">{children}</span>
    </li>
  );
}

export default function ResearchUsePolicyPage() {
  return (
    <main className="min-h-screen bg-[#F6F8FB] text-[#0B1220]">
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
        <div className="rounded-3xl border border-black/10 bg-white shadow-sm p-6 sm:p-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                Research-use Policy
              </h1>
              <p className="mt-2 text-sm sm:text-base text-black/65 max-w-3xl">
                This page explains how Signal Labs supplies products and what they may or may not be used for. Please read this before placing an order.
              </p>
            </div>

            <Link
              href="/#products"
              className="hidden sm:inline-flex rounded-full border border-black/15 px-5 py-2 text-sm font-medium hover:bg-black/5"
            >
              Browse products
            </Link>
          </div>

          {/* Key notice */}
          <div className="mt-6 rounded-2xl border border-black/10 bg-black/[0.02] p-5">
            <div className="text-sm font-semibold text-black/85">
              Important notice
            </div>
            <p className="mt-2 text-sm sm:text-base text-black/70">
              All items sold by Signal Labs are supplied for{" "}
              <span className="font-semibold">laboratory and analytical research purposes only</span>.
              Our products are{" "}
              <span className="font-semibold">not for human consumption</span>,{" "}
              <span className="font-semibold">not for veterinary use</span>, and{" "}
              <span className="font-semibold">not intended to diagnose, treat, cure, or prevent any disease</span>.
            </p>
          </div>

          {/* Sections */}
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-black/10 bg-white p-6">
              <h2 className="text-base font-semibold">Permitted use</h2>
              <ul className="mt-4 space-y-3">
                <Bullet>Laboratory research and analytical applications.</Bullet>
                <Bullet>Method development, reference work, and validation in suitable environments.</Bullet>
                <Bullet>Use by qualified persons in controlled lab settings.</Bullet>
              </ul>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white p-6">
              <h2 className="text-base font-semibold">Prohibited use</h2>
              <ul className="mt-4 space-y-3">
                <Bullet>Human consumption or use on the human body.</Bullet>
                <Bullet>Veterinary consumption or use on animals.</Bullet>
                <Bullet>Use in food, beverages, cosmetics, or household products.</Bullet>
                <Bullet>Any use that violates local laws or regulations.</Bullet>
              </ul>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white p-6">
              <h2 className="text-base font-semibold">Orders & eligibility</h2>
              <ul className="mt-4 space-y-3">
                <Bullet>
                  By placing an order, you confirm you understand and agree the products are for research use only.
                </Bullet>
                <Bullet>
                  We may refuse or cancel orders where we believe the intended use is not consistent with this policy.
                </Bullet>
                <Bullet>
                  Keep your account details accurate to avoid dispatch delays.
                </Bullet>
              </ul>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white p-6">
              <h2 className="text-base font-semibold">Support</h2>
              <p className="mt-3 text-sm sm:text-base text-black/70">
                We can help with <span className="font-semibold">orders, payments, delivery tracking, returns,</span>{" "}
                and <span className="font-semibold">account access</span>. We do not provide guidance on use,
                dosing, protocols, or suitability for any biological application.
              </p>
              <div className="mt-4">
                <Link
                  href="/support"
                  className="inline-flex rounded-full bg-black text-white px-5 py-2 text-sm font-medium hover:opacity-90"
                >
                  Contact support
                </Link>
              </div>
            </div>
          </div>

          {/* Legal / liability style section */}
          <div className="mt-8 rounded-2xl border border-black/10 bg-white p-6">
            <h2 className="text-base font-semibold">Compliance & responsibility</h2>
            <ul className="mt-4 space-y-3">
              <Bullet>
                You are responsible for ensuring that purchase, possession, and use of any product complies with
                applicable laws and regulations in your jurisdiction.
              </Bullet>
              <Bullet>
                Products must be handled, stored, and used safely by competent persons using appropriate equipment
                and procedures.
              </Bullet>
              <Bullet>
                Any misuse is strictly prohibited. Signal Labs accepts no responsibility for use outside the permitted
                scope described on this page.
              </Bullet>
            </ul>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/#products"
              className="rounded-full border border-black/15 px-5 py-2 text-sm font-medium hover:bg-black/5"
            >
              Back to products
            </Link>
            <Link
              href="/support"
              className="rounded-full border border-black/15 px-5 py-2 text-sm font-medium hover:bg-black/5"
            >
              Support
            </Link>
          </div>

          <p className="mt-6 text-xs text-black/45">
            Last updated: {new Date().toISOString().slice(0, 10)}
          </p>
        </div>
      </section>
    </main>
  );
}
