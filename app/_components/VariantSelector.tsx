"use client";

export type ProductVariant = {
  label: string;
  pricePennies: number;
  image?: string;
  stock?: number;
};

type Props = {
  variants: ProductVariant[];
  selectedIndex: number;
  onChange: (index: number) => void;
};

export default function VariantSelector({ variants, selectedIndex, onChange }: Props) {
  if (!variants.length) return null;

  return (
    <div className="mt-2">
      <p className="text-sm text-black/60 mb-1.5">Size</p>
      <div className="flex flex-wrap gap-1.5">
        {variants.map((v, i) => {
          const outOfStock = typeof v.stock === "number" && v.stock <= 0;
          const selected = selectedIndex === i;

          let cls = "rounded-full border px-4 py-1.5 text-sm font-semibold transition ";

          if (selected && outOfStock) {
            cls += "border-rose-500 bg-rose-500 text-white";
          } else if (selected) {
            cls += "border-green-600 bg-green-600 text-white ring-2 ring-green-300";
          } else if (outOfStock) {
            cls += "border-black/10 bg-white text-black/25 line-through cursor-not-allowed";
          } else {
            cls += "border-green-500 bg-green-50 text-green-800 hover:bg-green-100 hover:border-green-600";
          }

          return (
            <button key={i} type="button" onClick={() => onChange(i)} className={cls}>
              {v.label}
            </button>
          );
        })}
      </div>
      {(() => {
        const sel = variants[selectedIndex];
        const outOfStock = sel && typeof sel.stock === "number" && sel.stock <= 0;
        if (outOfStock) return (
          <p className="mt-1.5 text-xs text-rose-600 font-medium">
            This size is out of stock — you can still place a back order.
          </p>
        );
        return (
          <p className="mt-1.5 text-xs text-green-700 font-medium">
            ✓ In stock — ready to ship
          </p>
        );
      })()}
    </div>
  );
}
