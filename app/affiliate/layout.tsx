import type { ReactNode } from "react";

// Affiliate pages use their own standalone layout
// This overrides the root layout's SiteChrome (header/footer)
export default function AffiliateLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
