import Image from "next/image";
import Link from "next/link";
import WeeklySpecialsSection from "./_components/WeeklySpecialsSection";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Signal Laboratories | Research Peptides UK — HPLC Verified",
  description:
    "Signal Laboratories supplies HPLC-verified research peptides for laboratory and analytical research. BPC-157, TB-500, GHK-Cu, Ipamorelin and 40+ compounds. UK-based, tracked dispatch.",
};

const badges = [
  { label: "Tracked Delivery", desc: "Royal Mail tracked on every order" },
  { label: "Secure Checkout", desc: "Encrypted payment processing" },
  { label: "UK Dispatch", desc: "Dispatched from the United Kingdom" },
  { label: "HPLC Verified", desc: "Greater than or equal to 98% purity guaranteed" },
];

const categories = [
  {
    title: "GH Axis Peptides",
    desc: "CJC-1295, Ipamorelin, GHRP-2, GHRP-6, Sermorelin, Tesamorelin",
    href: "/products",
  },
  {
    title: "Tissue Biology",
    desc: "BPC-157, TB-500, GHK-Cu, MGF, PEG MGF, LL-37",
    href: "/products",
  },
  {
    title: "Longevity Research",
    desc: "NAD+, MOTS-c, SS-31, Epithalon, FOXO4-DRI, SLU-PP-322",
    href: "/products",
  },
  {
    title: "Melanocortin",
    desc: "KPV, Kisspeptin-10, DSIP, Selank, Semax",
    href: "/products",
  },
  {
    title: "Metabolic Research",
    desc: "AICAR, AOD9604, Retatrutide, Adipotide, 5-Amino-1MQ",
    href: "/products",
  },
  {
    title: "Neuropeptides",
    desc: "Semax, Selank, DSIP, Dermorphin, Oxytocin Acetate",
    href: "/products",
  },
];

const featuredPosts = [
  { slug: "bpc-157-research", title: "BPC-157 Research Guide" },
  { slug: "tb-500-thymosin-beta-4-research", title: "TB-500 Research Guide" },
  { slug: "ghk-cu-research", title: "GHK-Cu Research Guide" },
  { slug: "ipamorelin-research", title: "Ipamorelin Research Guide" },
  { slug: "longevity-peptides-research-guide", title: "Longevity Peptides Overview" },
  { slug: "peptide-storage-stability-guide", title: "Peptide Storage Guide" },
];

export default async function HomePage() {
  const productsCount = await prisma.product.count({ where: { isActive: true } });

  return (
    <main className="min-h-screen bg-[#F6F8FB] text-[#0B1220]">

      {/* HERO */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 pt-8">
        <div className="rounded-3xl border border-black/10 bg-white shadow-sm overflow-hidden">
          <div className="relative w-full h-[clamp(170px,18vw,260px)] bg-white">
            <Image
              src="/signal-banner.png"
              alt="Signal Laboratories — Research Peptides UK"
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
            Research Peptides UK — HPLC Verified, Laboratory Grade
          </h1>

          <p className="mt-3 text-sm sm:text-base text-black/65 max-w-3xl leading-relaxed">
            Signal Laboratories supplies {productsCount}+ HPLC-verified research peptides for laboratory and analytical research. Every compound is verified to greater than or equal to 98% purity by reverse-phase HPLC before dispatch. UK-based with tracked delivery on every order.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="rounded-full bg-black text-white px-5 py-2 text-sm font-medium hover:opacity-90"
            >
              View All Products
            </Link>
            <Link
              href="/blog"
              className="rounded-full border border-black/15 bg-white px-5 py-2 text-sm font-medium hover:bg-black/5"
            >
              Research Articles
            </Link>
            <Link
              href="/research-use-policy"
              className="rounded-full border border-black/15 bg-white px-5 py-2 text-sm font-medium hover:bg-black/5"
            >
              Research-use Policy
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {badges.map((item) => (
              <div key={item.label} className="rounded-2xl border border-black/15 bg-black/[0.03] px-4 py-3">
                <p className="text-sm font-semibold text-black/80">{item.label}</p>
                <p className="text-xs text-black/50 mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCT CATEGORIES */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 mt-10">
        <h2 className="text-xl font-semibold tracking-tight mb-1">Research Compound Categories</h2>
        <p className="text-sm text-black/55 mb-5">Browse {productsCount} HPLC-verified research peptides across multiple research areas.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.title}
              href={cat.href}
              className="rounded-2xl border border-black/10 bg-white shadow-sm p-5 hover:shadow-md hover:border-black/20 transition-all"
            >
              <h3 className="text-sm font-semibold text-[#0B1220]">{cat.title}</h3>
              <p className="mt-1.5 text-xs text-black/55 leading-relaxed">{cat.desc}</p>
              <p className="mt-3 text-xs font-medium text-black/40">View products →</p>
            </Link>
          ))}
        </div>
      </section>

      {/* WHY SIGNAL LABS */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 mt-10">
        <div className="rounded-3xl border border-black/10 bg-white shadow-sm p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight">Why Signal Laboratories</h2>
          <p className="mt-3 text-sm text-black/65 leading-relaxed max-w-3xl">
            Signal Laboratories was established to provide the UK research community with consistently high-quality, analytically verified peptide research compounds. Every batch is characterised by reverse-phase high-performance liquid chromatography (HPLC) to confirm purity at greater than or equal to 98% before being made available. Mass spectrometry confirmation of molecular identity is available on request for specific batches.
          </p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-black/10 bg-[#F6F8FB] p-4">
              <p className="text-sm font-semibold">≥98% Purity</p>
              <p className="text-xs text-black/55 mt-1">Every compound verified by reverse-phase HPLC before dispatch. Certificate of analysis available for every batch.</p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-[#F6F8FB] p-4">
              <p className="text-sm font-semibold">Lyophilised &amp; Stable</p>
              <p className="text-xs text-black/55 mt-1">All compounds supplied as lyophilised powder in sealed vials. Stable at -20°C for 2+ years under correct storage conditions.</p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-[#F6F8FB] p-4">
              <p className="text-sm font-semibold">UK Based &amp; Tracked</p>
              <p className="text-xs text-black/55 mt-1">Dispatched from the United Kingdom via Royal Mail tracked services. Fast delivery across the UK and international shipping available.</p>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <Link href="/quality" className="rounded-full border border-black/15 px-4 py-2 text-xs font-medium hover:bg-black/5">Quality &amp; Purity</Link>
            <Link href="/verification" className="rounded-full border border-black/15 px-4 py-2 text-xs font-medium hover:bg-black/5">Verification</Link>
          </div>
        </div>
      </section>

      {/* WEEKLY SPECIALS */}
      <section className="mt-10">
        <WeeklySpecialsSection title="Weekly Specials" showViewProducts={false} />
      </section>

      {/* RESEARCH ARTICLES */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 mt-10">
        <h2 className="text-xl font-semibold tracking-tight mb-1">Research Articles</h2>
        <p className="text-sm text-black/55 mb-5">Published research guides covering mechanism of action, receptor pharmacology, and laboratory applications.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredPosts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="rounded-2xl border border-black/10 bg-white shadow-sm p-5 hover:shadow-md hover:border-black/20 transition-all"
            >
              <p className="text-sm font-semibold text-[#0B1220]">{post.title}</p>
              <p className="mt-2 text-xs font-medium text-black/40">Read article →</p>
            </Link>
          ))}
        </div>
        <div className="mt-4">
          <Link href="/blog" className="rounded-full border border-black/15 px-5 py-2 text-sm font-medium hover:bg-black/5 inline-block">
            View all {'>'}58 research articles →
          </Link>
        </div>
      </section>

      {/* DISCLAIMER + SUPPORT */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 mt-10 pb-16">
        <div className="rounded-3xl border border-black/10 bg-white shadow-sm p-6 sm:p-8">
          <h2 className="text-base font-semibold">Research Use Only</h2>
          <p className="mt-2 text-sm text-black/65 max-w-3xl leading-relaxed">
            All compounds supplied by Signal Laboratories are for laboratory and analytical research purposes only. They are not intended for human or veterinary administration, and are not medicines, supplements, or food products. By purchasing you confirm you are a qualified researcher purchasing for legitimate laboratory research use in accordance with our research-use policy.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/research-use-policy" className="rounded-full border border-black/15 px-4 py-2 text-xs font-medium hover:bg-black/5">Research-use Policy</Link>
            <Link href="/support" className="rounded-full border border-black/15 px-4 py-2 text-xs font-medium hover:bg-black/5">Contact Support</Link>
          </div>
        </div>
      </section>

    </main>
  );
}
