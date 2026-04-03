// app/(public)/blog/guides/what-are-research-peptides-uk/page.tsx
import type { Metadata } from "next";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { absUrl } from "@/lib/site";

export const dynamic = "force-static";

const SLUG = "/blog/guides/what-are-research-peptides-uk";

const TITLE = "What Are Research Peptides? A UK Scientific Guide";
const DESC =
  "A detailed UK guide explaining what research peptides are, how they’re studied, how purity and documentation are assessed, and what Research-Use-Only means in practice.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: absUrl(SLUG) },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: absUrl(SLUG),
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
  },
};

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-3 py-1 text-[11px] font-semibold text-[#0B1220]/70 backdrop-blur">
      {children}
    </span>
  );
}

function Card({
  title,
  children,
  subtle,
}: {
  title?: string;
  children: React.ReactNode;
  subtle?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border border-black/10 p-5",
        subtle ? "bg-black/[0.02]" : "bg-white",
      ].join(" ")}
    >
      {title ? (
        <div className="text-sm font-semibold text-[#0B1220]">{title}</div>
      ) : null}
      <div
        className={
          title
            ? "mt-3 text-sm text-[#0B1220]/75 leading-7"
            : "text-sm text-[#0B1220]/75 leading-7"
        }
      >
        {children}
      </div>
    </div>
  );
}

function SectionTitle({
  id,
  eyebrow,
  title,
  subtitle,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header id={id} className="scroll-mt-28">
      {eyebrow ? (
        <div className="text-xs font-semibold uppercase tracking-wider text-[#0B1220]/60">
          {eyebrow}
        </div>
      ) : null}
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0B1220]">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-2 text-sm text-[#0B1220]/70 leading-7">{subtitle}</p>
      ) : null}
    </header>
  );
}

function Divider() {
  return <div className="my-10 h-px w-full bg-black/10" />;
}

function formatDateISO(d: string) {
  // expects YYYY-MM-DD
  const s = clean(d);
  return s || "";
}

export default function Page() {
  const published = "2026-03-01";
  const modified = "2026-03-01";

  const canonical = absUrl(SLUG);

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    description: DESC,
    datePublished: published,
    dateModified: modified,
    author: { "@type": "Organization", name: "Signal Labs", url: absUrl("/") },
    publisher: {
      "@type": "Organization",
      name: "Signal Labs",
      url: absUrl("/"),
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absUrl("/") },
      { "@type": "ListItem", position: 2, name: "Blog", item: absUrl("/blog") },
      {
        "@type": "ListItem",
        position: 3,
        name: "Guides",
        item: absUrl("/blog/guides"),
      },
      { "@type": "ListItem", position: 4, name: TITLE, item: canonical },
    ],
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Are research peptides medicines?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Research peptides are supplied for laboratory and analytical investigation. They are not licensed medicines and are not intended for human or veterinary use.",
        },
      },
      {
        "@type": "Question",
        name: "What does ≥99% purity mean?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "It is a laboratory measurement describing the proportion of the target peptide relative to detectable impurities/by-products, commonly assessed using analytical methods such as HPLC and confirmed with mass spectrometry.",
        },
      },
      {
        "@type": "Question",
        name: "What is a COA and why does it matter?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A Certificate of Analysis (COA) documents batch identifiers and analytical results (such as purity and identity checks). Batch-specific documentation supports traceability and reproducibility in research.",
        },
      },
      {
        "@type": "Question",
        name: "Why are peptides often supplied lyophilised?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Lyophilisation (freeze-drying) improves stability and shelf life by removing water, reducing degradation risk during storage and handling.",
        },
      },
      {
        "@type": "Question",
        name: "What does Research-Use-Only mean in the UK?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Research-Use-Only indicates a material is supplied for laboratory/analytical research and is not a licensed medicinal product. It is not intended for therapeutic, diagnostic, or consumption purposes.",
        },
      },
    ],
  };

  const toc = [
    { id: "intro", label: "Overview" },
    { id: "definition", label: "What is a peptide?" },
    { id: "why-research", label: "Why peptides matter in research" },
    { id: "synthesis", label: "How peptides are made" },
    { id: "purity", label: "Purity & identity testing" },
    { id: "coa", label: "COAs & documentation" },
    { id: "storage", label: "Storage & handling" },
    { id: "ruo", label: "Research-Use-Only (UK)" },
    { id: "supplier", label: "Evaluating suppliers" },
    { id: "faq", label: "FAQ" },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/blog"
          className="text-sm font-semibold text-[#0B1220] hover:underline"
        >
          ← Back to Research Articles
        </Link>
      </div>

      {/* HERO (premium, wide image, consistent cropping + mobile-friendly) */}
      <section className="relative overflow-hidden rounded-3xl border border-black/10 bg-white">
        {/* soft decorative background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.18),transparent_55%),radial-gradient(circle_at_90%_30%,rgba(14,165,233,0.16),transparent_45%),radial-gradient(circle_at_70%_90%,rgba(250,204,21,0.12),transparent_50%)]" />

        <div className="relative grid gap-8 p-7 md:grid-cols-12 md:p-10">
          {/* ✅ Right column first on mobile (premium editorial), right on desktop */}
          <div className="md:col-span-5 md:order-2">
            {/* ✅ Aspect-ratio hero image (mobile now wider + crop anchored left) */}
            <div className="overflow-hidden rounded-2xl border border-black/10 bg-black/[0.02]">
              <div className="relative w-full aspect-[16/10] md:aspect-[16/10] lg:aspect-[16/9]">
                <Image
                  src="/images/blog/research-peptides-hero.jpg"
                  alt="Research peptides: laboratory and analytical context"
                  fill
                  priority
                  className="object-cover object-left"
                  sizes="(max-width: 768px) 100vw, 40vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent" />
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-black/10 bg-white p-5">
              <div className="text-sm font-semibold text-[#0B1220]">
                On this page
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {toc.map((t) => (
                  <a
                    key={t.id}
                    href={`#${t.id}`}
                    className="rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-[#0B1220]/80 hover:bg-black/[0.04]"
                  >
                    {t.label}
                  </a>
                ))}
              </div>
              <div className="mt-4 text-xs text-[#0B1220]/60">
                Tip: long-form guides rank better when they’re easy to skim — use
                these jump links and come back later.
              </div>
            </div>
          </div>

          {/* Left copy (second on mobile, left on desktop) */}
          <div className="md:col-span-7 md:order-1">
            <div className="flex flex-wrap gap-2">
              <Pill>Guides</Pill>
              <Pill>UK</Pill>
              <Pill>Research use only</Pill>
              <Pill>Purity • COA • Storage</Pill>
            </div>

            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[#0B1220] md:text-5xl">
              What Are Research Peptides?
              <span className="block text-[#0B1220]/80">
                A UK Scientific Guide
              </span>
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#0B1220]/75 md:text-base">
              Research peptides are short chains of amino acids synthesised for
              scientific investigation. This guide explains what they are, how
              they’re studied in laboratory contexts, how purity and identity
              are assessed, what a COA should include, and how Research-Use-Only
              is interpreted in the UK.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-[#0B1220]/60">
              <span>Published: {formatDateISO(published)}</span>
              <span>•</span>
              <span>Updated: {formatDateISO(modified)}</span>
              <span>•</span>
              <span>Estimated reading time: ~10–12 minutes</span>
            </div>

            <div className="mt-7 grid gap-3 md:grid-cols-2">
              <Card title="Key takeaway">
                Research peptides are assessed by purity, identity confirmation,
                and batch documentation. Clear records support reproducibility
                and responsible laboratory practice.
              </Card>

              <Card title="Quick definitions">
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>Peptide:</strong> short amino-acid chain (often
                    2–50).
                  </li>
                  <li>
                    <strong>Purity:</strong> analytical composition measure
                    (often HPLC-derived %).
                  </li>
                  <li>
                    <strong>COA:</strong> batch-level documentation of results &amp;
                    identifiers.
                  </li>
                  <li>
                    <strong>RUO:</strong> supplied strictly for lab/analytical
                    research.
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN */}
      <div className="mt-10 grid gap-10 lg:grid-cols-12">
        {/* Sticky TOC */}
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="sticky top-28 rounded-2xl border border-black/10 bg-white p-5">
            <div className="text-sm font-semibold text-[#0B1220]">Contents</div>
            <nav className="mt-3 space-y-2 text-sm">
              {toc.map((t) => (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  className="block rounded-xl px-3 py-2 text-[#0B1220]/75 hover:bg-black/[0.03] hover:text-[#0B1220]"
                >
                  {t.label}
                </a>
              ))}
            </nav>

            <div className="mt-5 rounded-xl border border-black/10 bg-black/[0.02] p-3 text-xs text-[#0B1220]/65">
              <strong>Reminder:</strong> Educational content only. Research use
              only. No medical or consumption claims.
            </div>
          </div>
        </aside>

        {/* Article */}
        <article className="lg:col-span-9">
          <div className="rounded-3xl border border-black/10 bg-white p-7 md:p-10">
            {/* INTRO */}
            <SectionTitle
              id="intro"
              eyebrow="Overview"
              title="Research peptides in context"
              subtitle="A clear, compliance-friendly explanation for UK audiences."
            />
            <div className="mt-5 space-y-4 text-sm leading-7 text-[#0B1220]/80">
              <p>
                In scientific research, clarity matters. The phrase “research
                peptides” describes short, precisely synthesised amino-acid
                sequences supplied for investigation in controlled laboratory
                settings. Researchers use peptides to explore molecular
                interactions, binding behaviour, signalling pathways, and structural properties. These experiments are designed to support traceable, reproducible results.
              </p>
              <p>
                It’s also important to be explicit about what research peptides{" "}
                <strong>are not</strong>. They are not licensed medicines, and
                they are not intended for human or veterinary use. In the UK,
                you’ll often see the term{" "}
                <strong>Research-Use-Only (RUO)</strong> alongside documentation
                like Certificates of Analysis (COAs). Those labels and documents
                aren’t just formalities: they define appropriate use, support
                quality evaluation, and reinforce the expectation that materials
                are used only for laboratory and analytical investigation.
              </p>
              <p>
                This guide is designed as a long-form reference. We’ll cover
                foundational definitions, how peptides are synthesised, how
                purity and identity are assessed, what to expect from
                documentation, and how to think about storage/handling to reduce
                avoidable variability.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <Card title="Why this matters">
                Search engines reward pages that define terms precisely, answer
                follow-up questions, and present information in a structured
                way. Researchers benefit from the same structure.
              </Card>
              <Card title="Who this is for">
                Students, laboratory staff, analytical teams, and anyone
                evaluating research-grade supply standards in the UK.
              </Card>
              <Card title="What we avoid (deliberately)" subtle>
                No dosing, no therapeutic claims, and no consumption guidance.
                The focus is laboratory standards and documentation.
              </Card>
            </div>

            <Divider />

            {/* DEFINITION */}
            <SectionTitle
              id="definition"
              eyebrow="Foundations"
              title="What is a peptide?"
              subtitle="Peptides are short chains of amino acids — distinct from full proteins, but closely related."
            />
            <div className="mt-5 space-y-4 text-sm leading-7 text-[#0B1220]/80">
              <p>
                A peptide is a sequence of amino acids linked by peptide bonds.
                Amino acids are often described as “building blocks” of
                proteins, because proteins are simply longer, folded chains of
                amino acids. As a general rule, peptides are shorter (commonly
                2–50 amino acids), while proteins are longer and often fold into
                complex 3D structures.
              </p>
              <p>
                In research, peptides are useful because they can be synthesised
                with precise sequences, making them ideal for controlled
                experiments. Their size can allow for easier characterisation
                and predictable handling. Peptides can also be modified (for
                example, with labels) to suit analytical methods or experimental
                design — always within research contexts.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Card title="Peptide vs protein (quick comparison)">
                <div className="overflow-hidden rounded-xl border border-black/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-black/[0.02] text-xs text-[#0B1220]/70">
                      <tr>
                        <th className="px-4 py-3">Characteristic</th>
                        <th className="px-4 py-3">Peptides</th>
                        <th className="px-4 py-3">Proteins</th>
                      </tr>
                    </thead>
                    <tbody className="text-[#0B1220]/75">
                      <tr className="border-t border-black/10">
                        <td className="px-4 py-3 font-semibold text-[#0B1220]/85">
                          Length
                        </td>
                        <td className="px-4 py-3">
                          Typically 2–50 amino acids
                        </td>
                        <td className="px-4 py-3">
                          Often 50+ (can be thousands)
                        </td>
                      </tr>
                      <tr className="border-t border-black/10">
                        <td className="px-4 py-3 font-semibold text-[#0B1220]/85">
                          Structure
                        </td>
                        <td className="px-4 py-3">
                          Often simpler / less folded
                        </td>
                        <td className="px-4 py-3">
                          Often complex 3D folding
                        </td>
                      </tr>
                      <tr className="border-t border-black/10">
                        <td className="px-4 py-3 font-semibold text-[#0B1220]/85">
                          Research use
                        </td>
                        <td className="px-4 py-3">
                          Binding, signalling, assays
                        </td>
                        <td className="px-4 py-3">
                          Function, structure, pathways
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title="Key terms you’ll see">
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    <strong>Amino acid sequence:</strong> exact order of amino
                    acids.
                  </li>
                  <li>
                    <strong>Molecular weight:</strong> expected mass used to
                    confirm identity.
                  </li>
                  <li>
                    <strong>Purity %:</strong> analytical assessment of
                    composition.
                  </li>
                  <li>
                    <strong>Lyophilised:</strong> freeze-dried to improve
                    stability.
                  </li>
                  <li>
                    <strong>Batch:</strong> a specific production lot tied to
                    documentation.
                  </li>
                </ul>
              </Card>
            </div>

            <Divider />

            {/* WHY RESEARCH */}
            <SectionTitle
              id="why-research"
              eyebrow="Research context"
              title="Why peptides matter in laboratory research"
              subtitle="Peptides are versatile tools because they can be designed, synthesised, and characterised with precision."
            />
            <div className="mt-5 space-y-4 text-sm leading-7 text-[#0B1220]/80">
              <p>
                Peptides are widely used in biochemical and analytical research
                because they can be created with defined sequences and compared
                across experiments with relatively high consistency. Researchers
                may use peptides to investigate receptor binding, enzyme
                interactions, signalling events, or sequence-specific behaviour
                in assays.
              </p>
              <p>
                A key point for reproducibility is that peptides are evaluated
                as materials with measurable attributes: purity, identity
                confirmation (often via mass spectrometry), and batch-level
                documentation. When labs standardise inputs, results become more
                comparable across teams and time.
              </p>
              <p>
                “Research peptide” is an umbrella phrase. Different sequences
                can behave differently under storage and handling; some are more
                sensitive to moisture, temperature, or repeated exposure to
                ambient conditions. Good research practice focuses on
                controlling variables you can control — including storage
                conditions and documentation.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <Card title="Common laboratory contexts">
                <ul className="list-disc space-y-2 pl-5">
                  <li>Analytical method development</li>
                  <li>Binding and interaction assays</li>
                  <li>Signal pathway exploration</li>
                  <li>Protein/peptide mapping</li>
                  <li>Structural biology workflows</li>
                </ul>
              </Card>
              <Card title="What ‘quality’ means here">
                “Quality” isn’t a marketing word — it’s identity confirmation,
                purity assessment, batch traceability, and appropriate
                storage/handling documentation.
              </Card>
              <Card title="Why documentation wins" subtle>
                Labs can’t reproduce results if material identity is uncertain.
                Batch-specific documentation supports auditability and reduces
                avoidable variability.
              </Card>
            </div>

            <Divider />

            {/* SYNTHESIS */}
            <SectionTitle
              id="synthesis"
              eyebrow="Manufacturing overview"
              title="How research peptides are made (high level)"
              subtitle="Most research peptides are produced using solid-phase synthesis, then purified and characterised."
            />
            <div className="mt-5 space-y-4 text-sm leading-7 text-[#0B1220]/80">
              <p>
                Most research peptides are produced using{" "}
                <strong>solid-phase peptide synthesis (SPPS)</strong>. In SPPS,
                the peptide is assembled step-by-step on a solid resin. Each
                amino acid is added in sequence, typically using protecting
                groups to reduce unwanted side reactions. After the sequence is
                assembled, the peptide is cleaved from the resin and purified.
              </p>
              <p>
                Even with controlled synthesis, by-products can occur:
                incomplete sequences, side products, or truncated chains. That’s
                one reason why purification and analytical verification are
                central to research-grade supply.
              </p>
              <p>
                After synthesis, the peptide may be purified (often via
                chromatography) and characterised to confirm identity and
                estimate purity. Many peptides are supplied as lyophilised
                powders to improve stability during storage and shipping.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Card title="Typical research-grade workflow">
                <ol className="list-decimal space-y-2 pl-5">
                  <li>Sequence assembly via SPPS</li>
                  <li>Cleavage and initial cleanup</li>
                  <li>Purification (often chromatography)</li>
                  <li>Analytical verification (HPLC / MS)</li>
                  <li>Batch documentation (COA)</li>
                  <li>Lyophilisation and packaging</li>
                </ol>
              </Card>
              <Card title="Why this matters for the end user" subtle>
                Each stage affects what arrives at the lab bench. Good suppliers
                provide enough information to evaluate the material against your
                analytical workflow and documentation needs.
              </Card>
            </div>

            <Divider />

            {/* PURITY */}
            <SectionTitle
              id="purity"
              eyebrow="Analytical testing"
              title="Purity and identity: what the numbers actually mean"
              subtitle="Purity percentages and identity checks help researchers assess materials consistently."
            />
            <div className="mt-5 space-y-4 text-sm leading-7 text-[#0B1220]/80">
              <p>
                “Purity” is commonly shown as a percentage such as{" "}
                <strong>≥98%</strong> or <strong>≥99%</strong>. In simple terms,
                this is an analytical estimate of how much of the sample
                corresponds to the target peptide versus detectable impurities
                or by-products. In many contexts, purity is derived from
                chromatographic methods such as HPLC by comparing peak areas.
              </p>
              <p>
                Purity percentages can depend on the method used, detection
                settings, solvents, and integration choices. A purity number is
                best interpreted alongside identity confirmation (commonly mass
                spectrometry) and batch traceability. That’s why a COA with
                clear identifiers is more meaningful than a single number in
                isolation.
              </p>
              <p>
                A practical “research-grade” expectation is: (1) an HPLC purity
                assessment and (2) identity confirmation (often MS), tied to a
                specific batch.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <Card title="HPLC (high level)">
                HPLC separates components in a mixture. A chromatogram can show
                a main peak (target) and smaller peaks (impurities). Purity
                often reflects relative peak areas under a defined method.
              </Card>
              <Card title="Mass spectrometry (high level)">
                MS helps confirm identity by measuring mass/charge features.
                It’s commonly used to confirm the expected molecular weight of
                a peptide.
              </Card>
              <Card title="Why ‘≥99%’ isn’t magic" subtle>
                A higher number can be useful, but method context matters.
                Review the COA, confirm batch traceability, and align specs with
                your lab workflow.
              </Card>
            </div>

            <div className="mt-6 rounded-2xl border border-black/10 bg-black/[0.02] p-5">
              <div className="text-sm font-semibold text-[#0B1220]">
                Practical interpretation
              </div>
              <p className="mt-2 text-sm leading-7 text-[#0B1220]/75">
                If you’re comparing suppliers, avoid relying on purity % alone.
                Look for batch-specific COAs, clear identifiers, method
                transparency, and professional storage guidance. These factors
                correlate strongly with reproducible research.
              </p>
            </div>

            <Divider />

            {/* COA */}
            <SectionTitle
              id="coa"
              eyebrow="Documentation"
              title="Certificates of Analysis (COAs) and traceability"
              subtitle="A COA should tie what you receive to a specific batch and a set of analytical results."
            />
            <div className="mt-5 space-y-4 text-sm leading-7 text-[#0B1220]/80">
              <p>
                A <strong>Certificate of Analysis (COA)</strong> is a batch
                document that records identifying details and analytical
                results. COAs support traceability and help labs evaluate
                whether a material fits a protocol or analytical method.
              </p>
              <p>
                At a minimum, a batch COA should include a batch/lot identifier,
                a product identifier, and analytical outputs such as purity and
                identity confirmation. What matters most is that the COA is tied
                to the exact batch shipped — not a generic template.
              </p>
              <p>
                From an SEO authority standpoint, COA education is high-intent
                and evergreen. Clear explanations build trust and position
                Signal Labs as documentation-first — premium standards without
                inflated pricing.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Card title="COA checklist (what to look for)">
                <ul className="list-disc space-y-2 pl-5">
                  <li>Batch/lot number (traceability)</li>
                  <li>Product identifier (name / code / sequence reference)</li>
                  <li>Purity result (with method context if provided)</li>
                  <li>Identity confirmation (commonly MS)</li>
                  <li>Test date / report date</li>
                  <li>Supplier details and document control</li>
                </ul>
              </Card>
              <Card title="Documentation is a trust signal" subtle>
                In sensitive niches, users and platforms favour sites that set
                clear standards and boundaries. COAs and traceability aren’t
                “extras” — they’re credibility.
              </Card>
            </div>

            <Divider />

            {/* STORAGE */}
            <SectionTitle
              id="storage"
              eyebrow="Lab practice"
              title="Storage and handling (reducing avoidable variability)"
              subtitle="Good handling protects integrity and helps keep experiments comparable over time."
            />
            <div className="mt-5 space-y-4 text-sm leading-7 text-[#0B1220]/80">
              <p>
                Many research peptides are supplied as{" "}
                <strong>lyophilised (freeze-dried)</strong> powders because
                removing water generally improves stability. Even so, peptides
                can be sensitive to moisture, light, and repeated temperature
                cycling. The goal of good handling is to reduce avoidable
                variability.
              </p>
              <p>
                Storage recommendations vary by peptide and workflow. As a
                conservative general practice, labs often keep lyophilised
                materials sealed and dry, refrigerated short-term and frozen
                longer-term — while minimising thaw/freeze cycles and exposure
                to ambient humidity.
              </p>
              <p>
                This section is intentionally practical and conservative. We’re
                not providing protocols for use — only handling concepts that
                support documentation and reproducibility.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Card title="Quick handling habits (research context)">
                <ul className="list-disc space-y-2 pl-5">
                  <li>Keep containers sealed when not in use.</li>
                  <li>Minimise time at ambient temperature.</li>
                  <li>Reduce moisture exposure (cap promptly).</li>
                  <li>Label clearly: batch, date received, storage location.</li>
                  <li>Document deviations (useful for troubleshooting).</li>
                </ul>
              </Card>

              <Card title="Simple storage reference (general)" subtle>
                <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-black/[0.02] text-xs text-[#0B1220]/70">
                      <tr>
                        <th className="px-4 py-3">Scenario</th>
                        <th className="px-4 py-3">General approach</th>
                      </tr>
                    </thead>
                    <tbody className="text-[#0B1220]/75">
                      <tr className="border-t border-black/10">
                        <td className="px-4 py-3 font-semibold text-[#0B1220]/85">
                          Short-term
                        </td>
                        <td className="px-4 py-3">
                          Refrigerated, sealed, dry
                        </td>
                      </tr>
                      <tr className="border-t border-black/10">
                        <td className="px-4 py-3 font-semibold text-[#0B1220]/85">
                          Long-term
                        </td>
                        <td className="px-4 py-3">
                          Frozen storage, sealed, stable conditions
                        </td>
                      </tr>
                      <tr className="border-t border-black/10">
                        <td className="px-4 py-3 font-semibold text-[#0B1220]/85">
                          Handling
                        </td>
                        <td className="px-4 py-3">
                          Minimise exposure to heat/light/moisture
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-[#0B1220]/60">
                  Note: Always follow your lab’s SOPs and any batch
                  documentation.
                </p>
              </Card>
            </div>

            <Divider />

            {/* RUO */}
            <SectionTitle
              id="ruo"
              eyebrow="Compliance"
              title="Research-Use-Only (RUO) in the UK"
              subtitle="What RUO communicates and why clear boundaries protect both users and suppliers."
            />
            <div className="mt-5 space-y-4 text-sm leading-7 text-[#0B1220]/80">
              <p>
                In the UK, “Research-Use-Only” indicates that a product is
                supplied strictly for laboratory and analytical research. RUO
                materials are not presented as licensed medicinal products and
                are not intended for therapeutic, diagnostic, or consumption
                purposes.
              </p>
              <p>
                From a trust and SEO perspective, compliance clarity matters in
                sensitive niches. Clear boundaries reduce the risk of misleading
                interpretation, and they signal professionalism and
                documentation-first standards.
              </p>
              <p>
                Premium doesn’t have to mean expensive. It can mean trustworthy,
                consistent, and transparent — especially around intended use and
                documentation.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <Card title="RUO communicates">
                Intended use boundaries and a laboratory-first context.
              </Card>
              <Card title="RUO does not communicate" subtle>
                Any implied therapeutic purpose, consumption guidance, or
                medical claims.
              </Card>
              <Card title="Good for long-term SEO">
                It keeps your content aligned with policies and reduces the risk
                of being classified as unsafe or misleading.
              </Card>
            </div>

            <Divider />

            {/* SUPPLIER */}
            <SectionTitle
              id="supplier"
              eyebrow="Buyer education"
              title="How to evaluate a research peptide supplier (UK)"
              subtitle="A practical checklist that prioritises transparency and reproducibility."
            />
            <div className="mt-5 space-y-4 text-sm leading-7 text-[#0B1220]/80">
              <p>
                Choosing a supplier is about reducing uncertainty. In research,
                uncertainty shows up as variability: inconsistent results,
                unclear documentation, and difficulty tracing which batch was
                used. A strong supplier reduces these issues with consistent
                packaging, batch identifiers, and COA transparency.
              </p>
              <p>
                When comparing suppliers, ignore vague marketing terms. Focus on
                the boring details: batch identifiers, COA clarity, method
                transparency, and clear policies. These are often better
                predictors of reliability than flashy claims.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Card title="Supplier checklist (high signal)">
                <ul className="list-disc space-y-2 pl-5">
                  <li>Batch-specific COAs (not generic templates)</li>
                  <li>Clear identity/purity testing approach</li>
                  <li>Traceability: lot numbers and document control</li>
                  <li>Professional packaging and labelling</li>
                  <li>Clear RUO disclaimers and boundaries</li>
                  <li>Transparent policies (shipping/returns/support)</li>
                </ul>
              </Card>

              <Card title="Red flags (in research supply)" subtle>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Therapeutic claims or consumption language</li>
                  <li>No batch identifiers or unclear documentation</li>
                  <li>Generic “COA” that isn’t batch-specific</li>
                  <li>Vague claims without method context</li>
                  <li>Inconsistent naming and poor traceability</li>
                </ul>
              </Card>
            </div>

            <Divider />

            {/* FAQ */}
            <SectionTitle
              id="faq"
              eyebrow="FAQ"
              title="Frequently asked questions"
              subtitle="Clear answers in a compliance-safe, research-only context."
            />

            <div className="mt-6 space-y-4">
              <Card title="Are research peptides medicines?">
                No. Research peptides are supplied for laboratory and analytical
                investigation. They are not licensed medicines and are not
                intended for human or veterinary use.
              </Card>

              <Card title="What does ≥99% purity mean?">
                It’s an analytical estimate of composition relative to
                detectable impurities/by-products under a given method (commonly
                HPLC-derived). Purity is best interpreted alongside identity
                confirmation (often MS) and batch documentation.
              </Card>

              <Card title="What is a COA and why does it matter?">
                A COA documents batch identifiers and analytical results.
                Batch-specific COAs support traceability and help researchers
                maintain reproducibility over time.
              </Card>

              <Card title="Why are peptides often supplied lyophilised?">
                Lyophilisation (freeze-drying) improves stability by removing
                water content, generally reducing degradation risk during
                storage.
              </Card>

              <Card title="What does Research-Use-Only mean in the UK?">
                RUO indicates the product is supplied strictly for
                laboratory/analytical research and is not a licensed medicinal
                product. It is not intended for therapeutic, diagnostic, or
                consumption purposes.
              </Card>
            </div>

            {/* Cluster links */}
            <div className="mt-12 rounded-2xl border border-black/10 bg-black/[0.02] p-6">
              <div className="text-sm font-semibold text-[#0B1220]">
                Next reading (build your authority cluster)
              </div>
              <p className="mt-2 text-sm text-[#0B1220]/75">
                To strengthen topical authority, publish these next and interlink
                them:
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Link
                  href="/blog/purity-testing/understanding-peptide-purity-hplc-coa"
                  className="rounded-2xl border border-black/10 bg-white p-4 text-sm font-semibold text-[#0B1220] hover:bg-black/[0.02]"
                >
                  Understanding Peptide Purity (HPLC &amp; COA)
                  <div className="mt-1 text-xs font-normal text-[#0B1220]/65">
                    Analytical methods and what “purity %” really means.
                  </div>
                </Link>

                <Link
                  href="/blog/compliance/research-use-only-explained-uk"
                  className="rounded-2xl border border-black/10 bg-white p-4 text-sm font-semibold text-[#0B1220] hover:bg-black/[0.02]"
                >
                  Research-Use-Only Explained (UK)
                  <div className="mt-1 text-xs font-normal text-[#0B1220]/65">
                    Compliance language and trust signals in a sensitive niche.
                  </div>
                </Link>

                <Link
                  href="/blog/storage-handling/how-to-store-lyophilised-peptides"
                  className="rounded-2xl border border-black/10 bg-white p-4 text-sm font-semibold text-[#0B1220] hover:bg-black/[0.02]"
                >
                  Storage &amp; Handling Guide
                  <div className="mt-1 text-xs font-normal text-[#0B1220]/65">
                    Reduce variability with consistent storage habits.
                  </div>
                </Link>
              </div>

              <p className="mt-4 text-xs text-[#0B1220]/60">
                If these pages don’t exist yet, keep the links for now (they’ll
                404) or tell me and I’ll generate the next three pages immediately
                so everything is connected.
              </p>
            </div>

            {/* Disclaimer */}
            <div className="mt-10 rounded-xl border border-black/10 bg-white p-4 text-xs text-black/60">
              <strong>Disclaimer:</strong> Research use only. Not for human or
              veterinary use. Not intended to diagnose, treat, cure, or prevent
              disease.
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}