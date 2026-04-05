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
  address: {
    "@type": "PostalAddress",
    addressCountry: "GB",
  },
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


const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Signal Laboratories",
  url: "https://signallaboratories.co.uk",
  logo: "https://signallaboratories.co.uk/signal-banner.png",
  description: "UK supplier of HPLC-verified research peptides for laboratory and analytical research purposes.",
  address: { "@type": "PostalAddress", addressCountry: "GB" },
  contactPoint: { "@type": "ContactPoint", email: "support@signallaboratories.co.uk", contactType: "customer support" },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Signal Laboratories",
  url: "https://signallaboratories.co.uk",
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: "https://signallaboratories.co.uk/products?q={search_term_string}" },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
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
          <main>{children}</main>
          <footer className="mt-20 border-t border-black/10 bg-white">
