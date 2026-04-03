"use client";

import { usePathname } from "next/navigation";
import Header from "@/app/_components/Header";
import PromoPopup from "@/app/_components/PromoPopup";
import AnnouncementBar from "@/app/_components/AnnouncementBar";
import AgeVerification from "@/app/_components/AgeVerification";

export default function SiteChrome() {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin")) return null;
  if (pathname?.startsWith("/affiliate")) return null;
  if (pathname?.startsWith("/admin-login")) return null;

  return (
    <>
      <AgeVerification />
      <AnnouncementBar />
      <Header />
      <PromoPopup />
    </>
  );
}
