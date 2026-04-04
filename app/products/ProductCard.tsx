"use client";

import Image from "next/image";
import ProductQuickActions from "@/app/_components/ProductQuickActions";

type Props = {
  product: {
    id: string;
    name: string;
    image?: string | null;
    stock: number;
  };

  // pricing
  unitPricePennies: number;

  // deal context
  dealId: string | null;
  showWeeklySpecialBadge?: boolean;
  showOnSaleBadge?: boolean;
  percentOff?: number | null;

  // permissions / state
  canView: boolean;
  maxQty?: number;
};

export default function ProductCard({
  product,
  unitPricePennies,
  dealId,
  showWeeklySpecialBadge,
  showOnSaleBadge,
  percentOff,
  canView,
  maxQty = 10,
}: Props) {
  const isBackOrder = product.stock <= 0;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <div className="relative aspect-[4/3] bg-black/5">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : null}

        <div className="absolute left-3 top-3 flex gap-2">
          {showWeeklySpecialBadge ? (
            <span className="rounded-full bg-black text-white px-3 py-1 text-xs font-semibold">
              Weekly Special
            </span>
          ) : null}

          {showOnSaleBadge ? (
            <span className="rounded-full bg-green-600 text-white px-3 py-1 text-xs font-semibold">
              On Sale
            </span>
          ) : null}
        </div>

        {typeof percentOff === "number" ? (
          <div className="absolute left-3 bottom-3">
            <span className="rounded-full bg-green-600 text-white px-3 py-1 text-xs font-semibold">
              -{percentOff}%
            </span>
          </div>
        ) : null}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold truncate">{product.name}</div>
            <div className="text-xs text-black/50 mt-1">
              {isBackOrder ? "Out of stock" : "In stock"}
            </div>
          </div>

          <div className="shrink-0 font-semibold">
            £{(unitPricePennies / 100).toFixed(2)}
          </div>
        </div>

        <div className="mt-3">
          <ProductQuickActions
            productId={product.id}
            dealId={dealId}
            canView={canView}
            isBackOrder={isBackOrder}
            name={product.name}
            image={product.image ?? null}
            unitPricePennies={unitPricePennies}
            maxQty={maxQty}
            linkLabel="Buy"
            buyLabel="Buy"
            buyLinkGoesToCheckout={true}
          />
        </div>
      </div>
    </div>
  );
}