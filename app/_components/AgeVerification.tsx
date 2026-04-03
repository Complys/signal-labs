"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const COOKIE = "sl_age_verified";

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : null;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

export default function AgeVerification() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState(false);

  // Only show on /products pages
  const isProductsPage =
    pathname === "/products" || pathname?.startsWith("/products/");

  useEffect(() => {
    if (!isProductsPage) return;
    if (getCookie(COOKIE) === "1") return;
    setShow(true);
  }, [isProductsPage]);

  if (!show) return null;

  function handleConfirm() {
    if (!checked) {
      setError(true);
      return;
    }
    setCookie(COOKIE, "1", 365);
    setShow(false);
  }

  function handleDecline() {
    window.location.href = "/";
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-8 shadow-2xl">
        {/* Logo / heading */}
        <div className="mb-6 text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-black/40 mb-2">
            Signal Laboratories
          </div>
          <h2 className="text-2xl font-bold text-[#0B1220] leading-tight">
            Age Verification Required
          </h2>
          <p className="mt-2 text-sm text-black/55 leading-relaxed">
            You must be 18 or over to access this page. Our products are supplied
            strictly for scientific research purposes only.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="rounded-2xl border border-black/10 bg-[#F6F8FB] p-4 text-xs text-black/60 leading-relaxed mb-5">
          All products are provided for laboratory and analytical research purposes
          only. Not for human or veterinary consumption. By continuing you confirm
          you understand and accept our{" "}
          <a href="/research-use-policy" className="underline hover:text-black">
            Research-use Policy
          </a>
          .
        </div>

        {/* Checkbox */}
        <label className="flex items-start gap-3 cursor-pointer mb-1">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => { setChecked(e.target.checked); setError(false); }}
            className="mt-0.5 h-4 w-4 rounded border-black/30 accent-black shrink-0"
          />
          <span className="text-sm text-black/70 leading-snug">
            I confirm I am 18 years of age or older and I am purchasing for
            scientific research purposes only.
          </span>
        </label>

        {error && (
          <p className="mt-1 mb-3 text-xs font-semibold text-rose-600">
            Please tick the box to continue.
          </p>
        )}

        {/* Buttons */}
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={handleConfirm}
            className="w-full h-11 rounded-full bg-[#0B1220] text-white text-sm font-bold hover:bg-black/80 transition"
          >
            I confirm — enter site
          </button>
          <button
            onClick={handleDecline}
            className="w-full h-11 rounded-full border border-black/15 text-sm font-medium text-black/60 hover:bg-black/5 transition"
          >
            I am under 18 — leave
          </button>
        </div>
      </div>
    </div>
  );
}
