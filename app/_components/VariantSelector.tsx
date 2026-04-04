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
            cls += "border-black bg-black text-white";
          } else if (outOfStock) {
            cls += "border-black/15 bg-white text-black/35 hover:border-rose-300";
          } else {
            cls += "border-black/20 bg-white text-black hover:border-black/50";
          }

          return (
            <button key={i} type="button" onClick={() => onChange(i)} className={cls}>
              {outOfStock ? (
                <span className="line-through">{v.label}</span>
              ) : (
                v.label
              )}
            </button>
          );
        })}
      </div>
      {(() => {
        const sel = variants[selectedIndex];
        const outOfStock = sel && typeof sel.stock === "number" && sel.stock <= 0;
        return outOfStock ? (
          <p className="mt-1.5 text-xs text-rose-600 font-medium">
            This size is out of stock — you can still place a back order.
          </p>
        ) : null;
      })()}
    </div>
  );
}
