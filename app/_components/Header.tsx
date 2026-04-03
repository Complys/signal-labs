// app/_components/Header.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import React, { useEffect, useRef, useState } from "react";
import { useCart } from "@/app/_components/CartProvider";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { count } = useCart();

  const [loggingOut, setLoggingOut] = useState(false);

  // Prevent hydration mismatch for cart badge
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Mobile menu
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close menu on route change
  useEffect(() => setMenuOpen(false), [pathname]);

  // Close menu when clicking outside
  useEffect(() => {
    function onDown(e: MouseEvent | TouchEvent) {
      if (!menuOpen) return;
      const el = menuRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setMenuOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("touchstart", onDown);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
    };
  }, [menuOpen]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);

    await signOut({ redirect: false });

    const target = pathname.startsWith("/account") ? "/login" : "/";
    router.replace(target);
    router.refresh();

    window.setTimeout(() => setLoggingOut(false), 200);
  }

  const isAuthed = !!session;
  const showLoading = status === "loading";
  const accountHref = isAuthed ? "/account" : "/login";
  const accountLabel = isAuthed ? "My Account" : "Login";
  const badgeCount = mounted ? count : 0;

  const linkClasses = (href: string) =>
    [
      "whitespace-nowrap leading-none",
      "transition-opacity hover:opacity-70",
      pathname === href ? "text-black font-semibold" : "text-[#0B1220]",
    ].join(" ");

  function BasketIcon() {
    return (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0B1220"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
        aria-hidden="true"
      >
        <path d="M6 8h12l-1 13H7L6 8Z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
      </svg>
    );
  }

  function CartBadge({ value }: { value: number }) {
    const text = value > 99 ? "99+" : String(value);
    return (
      <span className="flex items-center justify-center rounded-full border border-black bg-white text-black font-semibold text-[13px] w-10 h-7 leading-none">
        {text}
      </span>
    );
  }

  // Keep your spacing exactly as before
  const navItemStyle: React.CSSProperties = { margin: "0 40px" };

  // Central nav items (DESKTOP)
  // ✅ Added Blog here so you can see it on the main site
  const desktopNav = [
    { href: "/products", label: "Products" },
    { href: "/blog", label: "Blog" },
    { href: "/research-use-policy", label: "Policy" },
    { href: "/support", label: "Support" },
  ] as const;

  // Mobile dropdown items
  // ✅ Added Blog here too
  const mobileMenu = [
    { href: "/products", label: "Products" },
    { href: "/blog", label: "Blog" },
    { href: "/research-use-policy", label: "Policy" },
    { href: "/support", label: "Support" },
    { href: "/cart", label: "Cart" },
  ] as const;

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-black/10">
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-14 flex items-center text-[15px] font-medium">
          {/* Left: logo + account */}
          <div className="flex items-center gap-4 shrink-0">
            <Link
              href="/"
              className="flex items-center shrink-0"
              style={{ transform: "translateY(-2px)" }}
            >
              <Image
                src="/signal-logo.png"
                alt="Signal Labs"
                width={190}
                height={50}
                priority
                className="h-11 w-auto shrink-0"
              />
            </Link>

            {/* Account link (same on mobile + desktop, but kept your layout) */}
            <div className="lg:hidden">
              {showLoading ? (
                <span className="text-[#0B1220]/60 leading-none">…</span>
              ) : (
                <Link
                  href={accountHref}
                  className="whitespace-nowrap leading-none transition-opacity hover:opacity-70 text-[#0B1220]"
                >
                  {accountLabel}
                </Link>
              )}
            </div>

            <div className="hidden lg:block">
              {showLoading ? (
                <span className="text-[#0B1220]/60 leading-none">…</span>
              ) : (
                <Link
                  href={accountHref}
                  className="whitespace-nowrap leading-none transition-opacity hover:opacity-70 text-[#0B1220]"
                >
                  {accountLabel}
                </Link>
              )}
            </div>
          </div>

          {/* Center nav */}
          <div className="flex-1 flex justify-center">
            {/* Mobile center nav (kept as single link like you had) */}
            <nav className="lg:hidden flex items-center h-14 leading-none">
              <Link href="/products" className={linkClasses("/products")}>
                Products
              </Link>
            </nav>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center h-14 leading-none">
              {desktopNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={linkClasses(item.href)}
                  style={navItemStyle}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right: cart + logout + hamburger */}
          <div className="flex items-center justify-end gap-4 shrink-0">
            {/* Desktop cart */}
            <Link
              href="/cart"
              className="hidden lg:flex items-center gap-2 transition-opacity hover:opacity-70 leading-none"
            >
              <BasketIcon />
              <CartBadge value={badgeCount} />
            </Link>

            {/* Desktop logout */}
            <div className="hidden lg:block">
              {showLoading ? (
                <span className="text-[#0B1220]/60 leading-none">…</span>
              ) : isAuthed ? (
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="whitespace-nowrap transition-opacity hover:opacity-70 text-[#0B1220] disabled:opacity-60 leading-none"
                >
                  {loggingOut ? "Signing out…" : "Logout"}
                </button>
              ) : null}
            </div>

            {/* Mobile: cart + hamburger dropdown */}
            <div className="flex items-center gap-3 lg:hidden relative" ref={menuRef}>
              <Link
                href="/cart"
                className="flex items-center gap-2 transition-opacity hover:opacity-70 leading-none"
                aria-label="Cart"
              >
                <BasketIcon />
                <CartBadge value={badgeCount} />
              </Link>

              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex items-center justify-center rounded-xl border border-black/20 px-3 py-2 text-[#0B1220] hover:opacity-80"
                aria-label="Open menu"
                aria-expanded={menuOpen}
              >
                <span className="text-lg leading-none">{menuOpen ? "✕" : "☰"}</span>
              </button>

              {menuOpen ? (
                <div className="absolute right-0 top-12 mt-2 w-64 rounded-2xl border border-black/10 bg-white shadow-lg overflow-hidden">
                  <div className="py-2">
                    {mobileMenu.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block px-4 py-3 text-[15px] text-[#0B1220] hover:bg-black/5"
                      >
                        {item.label}
                      </Link>
                    ))}

                    {!showLoading && isAuthed ? (
                      <div className="border-t border-black/10 mt-2">
                        <button
                          onClick={handleLogout}
                          disabled={loggingOut}
                          className="w-full text-left px-4 py-3 text-[15px] text-[#0B1220] hover:bg-black/5 disabled:opacity-60"
                        >
                          {loggingOut ? "Signing out…" : "Logout"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}