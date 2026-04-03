// app/(public)/quality/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quality Assurance & Independent Testing | Signal Labs",
  description:
    "Learn how Signal Labs approaches analytical verification, batch transparency, and independent UK testing standards for research-use compounds.",
  openGraph: {
    title: "Quality Assurance & Independent Testing | Signal Labs",
    description:
      "Analytical verification, batch traceability, and transparent documentation for research-use compounds.",
    type: "website",
  },
};

export default function QualityPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Quality and Testing</h1>
      <p className="mt-3 text-sm text-neutral-600">
        All products are supplied strictly for <strong>research use only</strong>.
      </p>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">Our commitment to quality and transparency</h2>
        <p>
          Signal Labs prioritises analytical verification, batch consistency, and transparent documentation to support responsible laboratory research.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">Independent analytical testing</h2>
        <p>Batches may be verified using analytical methods such as:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>High-Performance Liquid Chromatography (HPLC)</li>
          <li>Mass Spectrometry (MS)</li>
          <li>Identity confirmation / method-dependent verification</li>
        </ul>
        <p>
          Independent verification can provide additional confidence beyond manufacturer-issued
          documentation.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">Understanding purity percentages</h2>
        <p>
          Purity percentages may vary slightly between laboratories due to differences in method
          parameters, calibration standards, integration thresholds, and sample preparation.
        </p>
        <p>
          We focus on documented verification and chromatographic clarity rather than headline
          marketing claims.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">Batch traceability</h2>
        <p>
          Batches are tracked with a batch reference and linked documentation to support laboratory record-keeping and reproducibility.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">Storage & handling standards</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Stored in controlled environments where applicable</li>
          <li>Protected from excess heat, moisture, and light exposure</li>
          <li>Packaged to minimise environmental exposure during transit</li>
          <li>Shipped securely within the UK</li>
        </ul>
        <p>
          Researchers should follow appropriate laboratory storage guidance after receipt to
          maintain stability.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">Certificates of Analysis (COA)</h2>
        <p>
          Where available, COAs may include method references, purity results, batch identifiers,
          and testing dates.
        </p>
      </section>

      <section className="mt-10 space-y-4 rounded-xl border p-5">
        <h2 className="text-xl font-semibold">Research use only</h2>
        <p>
          Signal Labs supplies products strictly for <strong>laboratory and analytical research</strong>.
          Products are not medicines and are not intended for human consumption.
        </p>
      </section>
    </main>
  );
}