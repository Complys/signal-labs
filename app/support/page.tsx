import Link from "next/link";
import SupportForm from "./SupportForm";

export const metadata = {
  title: "Support | Signal Labs",
  description:
    "Contact Signal Labs regarding orders, delivery tracking, payments, or account access.",
};

export default function SupportPage() {
  const email = process.env.BUSINESS_EMAIL || "info@signallaboratories.co.uk";
  const name = process.env.BUSINESS_NAME || "Signal Labs";

  const addr1 = process.env.BUSINESS_ADDRESS_LINE1 || "";
  const addr2 = process.env.BUSINESS_ADDRESS_LINE2 || "";
  const city = process.env.BUSINESS_CITY || "";
  const postcode = process.env.BUSINESS_POSTCODE || "";
  const country = process.env.BUSINESS_COUNTRY || "United Kingdom";

  const hasAddress = Boolean(addr1 || addr2 || city || postcode);

  return (
    <main className="min-h-screen bg-[#F6F8FB] text-[#0B1220]">
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
        <div className="rounded-3xl border border-black/10 bg-white shadow-sm p-6 sm:p-10">
          {/* Header */}
          <div className="max-w-3xl">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Support and Enquiries
            </h1>

            <p className="mt-3 text-sm sm:text-base text-black/65">
              We can assist with{" "}
              <span className="font-semibold">
                orders, payments, delivery tracking, returns,
              </span>{" "}
              and <span className="font-semibold">account access</span>.
            </p>

            <p className="mt-2 text-sm text-black/55">
              We do not provide guidance regarding usage, protocols, or suitability
              for any biological or experimental application.
            </p>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
            {/* Left panel */}
            <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-6">
              <div className="text-sm font-semibold text-black/85">
                Contact details
              </div>

              <p className="mt-3 text-sm text-black/70">
                For all support enquiries, email:
              </p>

              {/* Premium email button */}
              <a
                href={`mailto:${email}`}
                className="mt-4 inline-flex items-center justify-center rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
              >
                {email}
              </a>

              <div className="mt-8">
                <div className="text-sm font-semibold text-black/85">
                  Please include
                </div>

                <ul className="mt-3 space-y-2 text-sm text-black/70">
                  <li>• Order number (if applicable)</li>
                  <li>• Email used at checkout</li>
                  <li>• Delivery postcode (for tracking enquiries)</li>
                </ul>
              </div>

              <div className="mt-8 rounded-xl border border-black/10 bg-white p-4">
                <div className="text-sm font-semibold text-black/85">
                  Response time
                </div>
                <p className="mt-2 text-sm text-black/65">
                  We aim to respond within 1 business day.
                </p>
              </div>

              {/* Business address (optional via env) */}
              <div className="mt-8 rounded-xl border border-black/10 bg-white p-4">
                <div className="text-sm font-semibold text-black/85">
                  Business details
                </div>
                <div className="mt-2 text-sm text-black/65">
                  <div className="font-medium text-black/75">{name}</div>
                  {hasAddress ? (
                    <div className="mt-2 leading-relaxed">
                      {addr1 && <div>{addr1}</div>}
                      {addr2 && <div>{addr2}</div>}
                      {(city || postcode) && (
                        <div>
                          {[city, postcode].filter(Boolean).join(", ")}
                        </div>
                      )}
                      <div>{country}</div>
                    </div>
                  ) : (
                    <div className="mt-2 text-black/55">
                      (Add address details in <span className="font-mono">.env.local</span> if you’d like them displayed.)
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 text-xs text-black/45 leading-relaxed">
                All products supplied strictly for laboratory and analytical
                research purposes only. Support is limited to order and account
                matters.
              </div>
            </div>

            {/* Right panel */}
            <div className="rounded-2xl border border-black/10 bg-white p-6">
              <div className="text-sm font-semibold text-black/85">
                Send a message
              </div>
              <p className="mt-2 text-sm text-black/65">
                Use the form below and we’ll reply by email.
              </p>

              <SupportForm />
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/research-use-policy"
              className="rounded-full border border-black/15 px-5 py-2 text-sm font-medium hover:bg-black/5"
            >
              Research-use Policy
            </Link>
            <Link
              href="/#products"
              className="rounded-full border border-black/15 px-5 py-2 text-sm font-medium hover:bg-black/5"
            >
              Products
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
