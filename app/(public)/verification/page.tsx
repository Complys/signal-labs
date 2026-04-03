// app/(public)/verification/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verification Standards & Analytical Variance | Signal Labs",
  description:
    "Why different laboratories may report different purity percentages and why verification methodology matters.",
};

export default function VerificationPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Verification Standards</h1>

      <p className="mt-4">
        In analytical testing, purity percentages can vary between laboratories due to differences
        in methodology. This is normal and is one reason we focus on documentation transparency and
        independent verification standards.
      </p>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">Why results vary between labs</h2>
        <p>Small methodological differences can influence reported purity, including:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>HPLC method parameters (column type, gradient, detection wavelength)</li>
          <li>Integration thresholds</li>
          <li>Calibration standards</li>
          <li>Sample preparation procedures</li>
        </ul>
        <p>
          Minor methodological differences can account for approximately <strong>±1% analytical variance</strong>{" "}
          in reported purity.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">Why we prioritise verification over “marketing numbers”</h2>
        <p>
          A purity percentage alone does not capture testing methodology, chromatographic resolution,
          or independent accountability. We therefore prioritise:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Third-party testing where applicable</li>
          <li>Clear documentation and traceability</li>
          <li>Transparent research-use-only policies</li>
          <li>Consistent storage and handling standards</li>
        </ul>
      </section>

      <section className="mt-10 space-y-4 rounded-xl border p-5">
        <h2 className="text-xl font-semibold">Research use only</h2>
        <p>
          All Signal Labs products are supplied strictly for research purposes only and are not
          intended for human consumption.
        </p>
      </section>
    </main>
  );
}