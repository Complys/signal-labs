"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import React, { useMemo } from "react";

const OPTIONS = [7, 14, 28, 90, 180, 365] as const;

type Props = {
  valueDays: number;
  paramKey?: string;          // e.g. "days" or "revDays"
  label?: string;
  compact?: boolean;

  // If provided, show a "Use global" button that removes paramKey from URL
  globalKey?: string;         // usually "days"
  showUseGlobal?: boolean;

  // If provided, clicking any option will ALSO remove these keys (reset overrides)
  resetKeys?: string[];
};

export default function RangePicker({
  valueDays,
  paramKey = "days",
  label = "Range",
  compact = false,
  globalKey = "days",
  showUseGlobal = false,
  resetKeys = [],
}: Props) {
  const pathname = usePathname();
  const sp = useSearchParams();

  const current = useMemo(() => {
    return OPTIONS.includes(valueDays as any) ? valueDays : 14;
  }, [valueDays]);

  function makeHref(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    mutator(params);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function hrefFor(days: number) {
    return makeHref((params) => {
      // reset keys (used by top/global picker)
      for (const k of resetKeys) params.delete(k);
      params.set(paramKey, String(days));
    });
  }

  function hrefUseGlobal() {
    return makeHref((params) => {
      params.delete(paramKey); // removing override means it follows global days
      // If paramKey is actually the global key, keep it (no-op)
      if (paramKey === globalKey) params.set(globalKey, String(current));
    });
  }

  const isOverrideActive = (() => {
    const raw = sp?.get(paramKey);
    return !!raw && paramKey !== globalKey;
  })();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={"text-xs text-white/60 " + (compact ? "mr-1" : "mr-2")}>
        {label}
      </span>

      {showUseGlobal && paramKey !== globalKey ? (
        <Link
          href={hrefUseGlobal()}
          prefetch={false}
          className={
            "rounded-full px-3 py-1 text-xs transition " +
            (!isOverrideActive
              ? "bg-white text-black"
              : "bg-white/10 text-white hover:bg-white/15")
          }
          title="Remove override and follow the top Range"
        >
          Use global
        </Link>
      ) : null}

      {OPTIONS.map((d) => {
        const active = d === current;
        return (
          <Link
            key={d}
            href={hrefFor(d)}
            prefetch={false}
            className={
              "rounded-full px-3 py-1 text-xs transition " +
              (active
                ? "bg-white text-black"
                : "bg-white/10 text-white hover:bg-white/15")
            }
          >
            {d}d
          </Link>
        );
      })}
    </div>
  );
}