"use client";

import Link from "next/link";

export default function PrintBar({ backHref }: { backHref: string }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
      <button
        className="rounded-xl border border-black/20 bg-white px-4 py-2 text-sm font-extrabold hover:opacity-80"
        onClick={() => window.print()}
      >
        Print
      </button>
      <Link
        className="rounded-xl border border-black/20 bg-white px-4 py-2 text-sm font-semibold hover:opacity-80"
        href={backHref}
      >
        Back to order
      </Link>
    </div>
  );
}
