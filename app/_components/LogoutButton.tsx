"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

export default function LogoutButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  async function logout() {
    if (loading) return;
    setLoading(true);

    await signOut({ redirect: false });

    const target = pathname?.startsWith("/account") ? "/login" : "/";
    router.replace(target);
    router.refresh();

    setTimeout(() => setLoading(false), 200);
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-60"
    >
      {loading ? "Signing out…" : "Logout"}
    </button>
  );
}
