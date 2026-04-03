"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SIZES = [
  { v: "4x6", label: "4x6 in (thermal)" },
  { v: "6x4", label: "6x4 in (thermal)" },
  { v: "A6", label: "A6 (105×148mm)" },
  { v: "A4", label: "A4 sheet (grid)" },
] as const;

export default function LabelControls() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const size = sp.get("size") || "4x6";
  const copies = Math.max(1, Math.min(30, Number(sp.get("copies") || 1)));
  const cols = Math.max(1, Math.min(6, Number(sp.get("cols") || 2)));
  const rows = Math.max(1, Math.min(10, Number(sp.get("rows") || 4)));

  const isA4 = size === "A4";

  const qs = useMemo(() => new URLSearchParams(sp.toString()), [sp]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(qs.toString());
    next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <select
        className="rounded-xl border border-black/20 bg-white px-3 py-2 text-sm font-semibold"
        value={size}
        onChange={(e) => setParam("size", e.target.value)}
      >
        {SIZES.map((s) => (
          <option key={s.v} value={s.v}>
            {s.label}
          </option>
        ))}
      </select>

      {isA4 ? (
        <>
          <label className="text-sm">
            <span className="mr-2 font-semibold">Cols</span>
            <input
              className="w-16 rounded-xl border border-black/20 px-3 py-2 text-sm"
              type="number"
              min={1}
              max={6}
              value={cols}
              onChange={(e) => setParam("cols", e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mr-2 font-semibold">Rows</span>
            <input
              className="w-16 rounded-xl border border-black/20 px-3 py-2 text-sm"
              type="number"
              min={1}
              max={10}
              value={rows}
              onChange={(e) => setParam("rows", e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mr-2 font-semibold">Copies</span>
            <input
              className="w-20 rounded-xl border border-black/20 px-3 py-2 text-sm"
              type="number"
              min={1}
              max={30}
              value={copies}
              onChange={(e) => setParam("copies", e.target.value)}
            />
          </label>
        </>
      ) : null}

      <button
        className="rounded-xl border border-black/20 bg-white px-4 py-2 text-sm font-extrabold hover:opacity-80"
        onClick={() => window.print()}
      >
        Print
      </button>
    </div>
  );
}
