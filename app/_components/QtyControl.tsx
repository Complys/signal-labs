"use client";

import React from "react";

function clampInt(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function QtyControl({
  value,
  onChange,
  min = 1,
  max = 999, // keep a silent cap (optional)
  disabled = false,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const dec = () => onChange(clampInt((value || min) - 1, min, max));
  const inc = () => onChange(clampInt((value || min) + 1, min, max));

  return (
    <div className="flex items-center rounded-full border border-black/15 bg-white overflow-hidden">
      <button
        type="button"
        onClick={dec}
        disabled={disabled || value <= min}
        className="h-11 w-12 grid place-items-center text-xl hover:bg-black/5 disabled:opacity-40"
        aria-label="Decrease quantity"
      >
        −
      </button>

      <input
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, "");
          if (raw === "") return onChange(min);
          const n = Number(raw);
          onChange(clampInt(Number.isFinite(n) ? n : min, min, max));
        }}
        inputMode="numeric"
        className="h-11 w-16 text-center text-[18px] outline-none"
        disabled={disabled}
        aria-label="Quantity"
      />

      <button
        type="button"
        onClick={inc}
        disabled={disabled || value >= max}
        className="h-11 w-12 grid place-items-center text-xl hover:bg-black/5 disabled:opacity-40"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
