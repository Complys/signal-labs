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
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i)}
              className={[
                "rounded-full border px-4 py-1.5 text-sm font-semibold transition relative",
                selected
                  ? "border-black bg-black text-white"
                  : outOfStock
                  ? "border-black/15 bg-white text-black/35 cursor-pointer"
                  : "border-black/20 bg-white text-black hover:border-black/50",
              ].join(" ")}
            >
              {outOfStock && !selected ? (
                <span className="line-through">{v.label}</span>
              ) : (
                v.label
              )}
              {outOfStock && (
                <span className="ml-1 text-[10px] font-normal text-black/40">
                  {selected ? "· back order" : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
