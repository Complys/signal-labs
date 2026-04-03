"use client";

export type ProductVariant = {
  label: string;
  pricePennies: number;
  image?: string;
};

type Props = {
  variants: ProductVariant[];
  selectedIndex: number;
  onChange: (index: number) => void;
};

export default function VariantSelector({ variants, selectedIndex, onChange }: Props) {
  if (!variants.length) return null;

  return (
    <div className="mt-4">
      <p className="text-sm text-black/60 mb-2">Size</p>
      <div className="flex flex-wrap gap-2">
        {variants.map((v, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={[
              "rounded-full border px-4 py-2 text-sm font-semibold transition",
              selectedIndex === i
                ? "border-black bg-black text-white"
                : "border-black/20 bg-white text-black hover:border-black/50",
            ].join(" ")}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
