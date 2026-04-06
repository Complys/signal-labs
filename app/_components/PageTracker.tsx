"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function PageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;

    const utmSource = searchParams?.get("utm_source") || undefined;
    const utmMedium = searchParams?.get("utm_medium") || undefined;
    const utmCampaign = searchParams?.get("utm_campaign") || undefined;
    const utmContent = searchParams?.get("utm_content") || undefined;
    const utmTerm = searchParams?.get("utm_term") || undefined;

    // Store UTMs in sessionStorage so they persist across pages
    if (utmSource) sessionStorage.setItem("utm_source", utmSource);
    if (utmMedium) sessionStorage.setItem("utm_medium", utmMedium);
    if (utmCampaign) sessionStorage.setItem("utm_campaign", utmCampaign);
    if (utmContent) sessionStorage.setItem("utm_content", utmContent);
    if (utmTerm) sessionStorage.setItem("utm_term", utmTerm);

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: pathname,
        utmSource: utmSource || sessionStorage.getItem("utm_source") || undefined,
        utmMedium: utmMedium || sessionStorage.getItem("utm_medium") || undefined,
        utmCampaign: utmCampaign || sessionStorage.getItem("utm_campaign") || undefined,
        utmContent: utmContent || sessionStorage.getItem("utm_content") || undefined,
        utmTerm: utmTerm || sessionStorage.getItem("utm_term") || undefined,
      }),
    }).catch(() => {});
  }, [pathname, searchParams]);

  return null;
}
