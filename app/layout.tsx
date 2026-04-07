// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Link from "next/link";
import NewsletterSignup from "./_components/NewsletterSignup";
import { Providers } from "./providers";
import SiteChrome from "./_components/SiteChrome";
import PageTracker from "./_components/PageTracker";
import DisclaimerWall from "./_components/DisclaimerWall";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "Signal Laboratories | Research Peptides UK",
    template: "%s | Signal Laboratories",
  },
  description: "Signal Laboratories supplies HPLC-verified research peptides for laboratory and analytical research. UK-based. Secure checkout and tracked dispatch.",
  applicationName: "Signal Laboratories",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Signal Laboratories",
    title: "Signal Laboratories | Research Peptides UK",
    description: "Signal Laboratories supplies HPLC-verified research peptides for laboratory and analytical research. UK-based. Secure checkout and tracked dispatch.",
    url: "/",
    images: [{ url: "/signal-banner.png", width: 1200, height: 630, alt: "Signal Laboratories" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Signal Laboratories | Research Peptides UK",
    description: "Signal Laboratories supplies HPLC-verified research peptides for laboratory and analytical research. UK-based. Secure checkout and tracked dispatch.",
    images: ["/signal-banner.png"],
  },
  keywords: [
    "research peptides UK",
    "buy research peptides UK",
    "BPC-157 UK",
    "TB-500 UK",
    "peptide purity HPLC",
    "research use only peptides",
    "laboratory research compounds UK",
    "analytical research peptides",
    "GHK-Cu UK",
    "ipamorelin UK",
  ],
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Signal Laboratories",
  url: "https://signallaboratories.co.uk",
  logo: "https://signallaboratories.co.uk/signal-banner.png",
  description: "UK supplier of HPLC-verified research peptides for laboratory and analytical research purposes.",
  address: { "@type": "PostalAddress", addressCountry: "GB" },
  contactPoint: {
    "@type": "ContactPoint",
    email: "support@signallaboratories.co.uk",
    contactType: "customer support",
  },
  sameAs: [],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Signal Laboratories",
  url: "https://signallaboratories.co.uk",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://signallaboratories.co.uk/products?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <Providers>
          <SiteChrome />
          <Suspense fallback={null}><PageTracker />
        <DisclaimerWall /></Suspense>
          <main>{children}</main>
          <footer className="mt-20 border-t border-black/10 bg-white">
            <div className="mx-auto max-w-7xl px-6 py-12">
              <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                <div>
                  <p className="text-sm font-semibold text-[#0B1220]">Signal Laboratories</p>
                  <p className="mt-3 text-xs leading-relaxed text-[#0B1220]/60">
                    HPLC-verified research peptides for laboratory and analytical research purposes.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0B1220]">Products</p>
                  <ul className="mt-3 space-y-2">
                    <li><Link href="/products" className="text-xs text-[#0B1220]/60 hover:text-[#0B1220]">All Products</Link></li>
                    <li><Link href="/quality" className="text-xs text-[#0B1220]/60 hover:text-[#0B1220]">Quality &amp; Purity</Link></li>
                    <li><Link href="/verification" className="text-xs text-[#0B1220]/60 hover:text-[#0B1220]">Verification</Link></li>
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0B1220]">Research</p>
                  <ul className="mt-3 space-y-2">
                    <li><Link href="/blog" className="text-xs text-[#0B1220]/60 hover:text-[#0B1220]">Research Articles</Link></li>
                    <li><Link href="/research-use-policy" className="text-xs text-[#0B1220]/60 hover:text-[#0B1220]">Research Use Policy</Link></li>
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0B1220]">Support</p>
                  <ul className="mt-3 space-y-2">
                    <li><Link href="/support" className="text-xs text-[#0B1220]/60 hover:text-[#0B1220]">Contact</Link></li>
                    <li><Link href="/affiliates/apply" className="text-xs text-[#0B1220]/60 hover:text-[#0B1220]">Affiliates</Link></li>
                  </ul>
                </div>
              </div>
              <div className="mt-8 border-t border-black/10 pt-8">
                <NewsletterSignup />
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-black/10 pt-8">
                <p className="text-xs text-[#0B1220]/50">
                  &copy; {new Date().getFullYear()} Signal Laboratories. For research use only.
                </p>
                <p className="text-xs text-[#0B1220]/50">
                  All products are for laboratory and analytical research purposes only. Not for human or veterinary use.
                </p>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
