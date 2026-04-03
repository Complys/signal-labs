"use client";

import { usePathname } from "next/navigation";
import Header from "@/app/_components/Header";
import PromoPopup from "@/app/_components/PromoPopup";

export default function SiteChrome() {
  const pathname = usePathname();

  // Hide public site chrome on admin and affiliate pages
  if (pathname?.startsWith("/admin")) return null;
  if (pathname?.startsWith("/affiliate")) return null;
  if (pathname?.startsWith("/admin-login")) return null;

  return (
    <>
      <Header />
      <PromoPopup />
    </>
  );
}