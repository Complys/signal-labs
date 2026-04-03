// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Link from "next/link";
import NewsletterSignup from "./_components/NewsletterSignup";
import { Providers } from "./providers";
import SiteChrome from "./_components/SiteChrome";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * NOTE:
 * - Keep ONE metadata export only
 * - metadataBase is required for absolute OG/canonical generation
 * - Uses NEXT_PUBLIC_SITE_URL (localhost in dev, production domain when live)
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "Signal Labs | Research-Use Products and Lab Supplies",
    template: "%s | Signal Labs",
  },
  description: "Signal Labs supplies research-use products for laboratory and analytical purposes. Secure checkout and tracked UK dispatch.",
  applicationName: "Signal Labs",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "Signal Labs",
    title: "Signal Labs | Research-Use Products and Lab Supplies",
    description: "Signal Labs supplies research-use products for laboratory and analytical purposes. Secure checkout and tracked UK dispatch.",
    url: "/",
    images: [
      {
        url: "/signal-banner.png",
        width: 1200,
        height: 630,
        alt: "Signal Labs",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Signal Labs | Research-Use Products and Lab Supplies",
    description: "Signal Labs supplies research-use products for laboratory and analytical purposes. Secure checkout and tracked UK dispatch.",
    images: ["/signal-banner.png"],
  },
  keywords: [
    "research peptides UK",
    "research use only peptides",
    "buy research peptides UK",
    "peptide purity testing",
    "COA peptides UK",
    "laboratory research supplies UK",
    "analytical research compounds",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <Providers>
          {/* Public site chrome (your component hides itself on /admin/*) */}
          <SiteChrome />

          <main>{children}</main>

          <footer className="mt-20 border-t border-black/10 bg-white">
            <div className="mx-auto max-w-6xl px-6 py-10">
              <div className="grid gap-8 sm:grid-cols-3 text-sm">
                <div>
                  <div className="font-semibold text-black/80 mb-3">Signal Labs</div>
                  <div className="space-y-2 text-black/55">
                    <div><Link href="/products" className="hover:text-black">Products</Link></div>
                    <div><Link href="/quality" className="hover:text-black">Quality and Testing</Link></div>
                    <div><Link href="/verification" className="hover:text-black">Verification Standards</Link></div>
                    <div><Link href="/research-use-policy" className="hover:text-black">Research-use Policy</Link></div>
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-black/80 mb-3">Resources</div>
                  <div className="space-y-2 text-black/55">
                    <div><Link href="/blog" className="hover:text-black">Research Articles</Link></div>
                    <div><Link href="/blog/guides/what-are-research-peptides-uk" className="hover:text-black">What Are Research Peptides?</Link></div>
                    <div><Link href="/support" className="hover:text-black">Support</Link></div>
                    <div><Link href="/affiliates/apply" className="hover:text-black">Affiliate Programme</Link></div>
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-black/80 mb-3">Legal</div>
                  <div className="space-y-2 text-black/55">
                    <div><Link href="/research-use-policy" className="hover:text-black">Research-use Policy</Link></div>
                    <div><Link href="/affiliate-terms" className="hover:text-black">Affiliate Terms</Link></div>
                  </div>
                  <div className="mt-4 text-xs text-black/40 leading-relaxed">
                    All products supplied strictly for laboratory and analytical research purposes only. Not for human or veterinary consumption.
                  </div>
                </div>
              </div>
              <div className="mt-8 border-t border-black/10 pt-6">
                <div className="mb-6 rounded-2xl border border-black/10 bg-[#F6F8FB] px-6 py-5">
                  <div className="text-sm font-semibold text-black/80 mb-1">Stay updated</div>
                  <p className="text-xs text-black/55 mb-3">Research updates, new products, and restock notifications.</p>
                  <NewsletterSignup />
                </div>
                <div className="text-center text-xs text-black/40">
                © {new Date().getFullYear()} Signal Labs. All rights reserved.
                </div>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}