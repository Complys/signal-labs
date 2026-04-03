// app/admin/products/[id]/edit/page.tsx
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import EditProductForm from "./EditProductForm";

type FieldKey =
  | "name"
  | "description"
  | "price"
  | "cost"
  | "stock"
  | "image"
  | "specialPrice";

export type EditActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<Record<FieldKey, string>>;
};

function formatGBPFromPennies(value: number) {
  return `£${(value / 100).toFixed(2)}`;
}

function penniesToPoundsString(value: number | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return (n / 100).toFixed(2);
}

function parseGBPToPennies(value: unknown): number | null {
  const raw = String(value ?? "").replace("£", "").replace(/,/g, "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function parseStockInt(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw && raw !== "0") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function activeDealWhere(productId: string) {
  const now = new Date();
  return {
    productId,
    isActive: true,
    startsAt: { lte: now },
    OR: [{ endsAt: null }, { endsAt: { gte: now } }],
  };
}

export default async function AdminEditProductPage(props: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const params = await Promise.resolve(props.params);
  const id = String((params as any)?.id ?? "").trim();
  if (!id) notFound();

  const [product, currentDeal] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        stock: true,
        image: true,
        isActive: true,
        costPennies: true,
      },
    }),
    prisma.deal.findFirst({ where: activeDealWhere(id) }),
  ]);

  if (!product) notFound();

  async function updateProductAction(
    _prev: EditActionState,
    formData: FormData
  ): Promise<EditActionState> {
    "use server";

    const fieldErrors: EditActionState["fieldErrors"] = {};

    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const image = String(formData.get("image") ?? "").trim();

    const isActive = formData.get("isActive") === "on";
    const onSpecial = formData.get("onSpecial") === "on";

    const pricePennies = parseGBPToPennies(formData.get("price"));

    const costRaw = String(formData.get("cost") ?? "").trim();
    // cost optional: blank => null (clears)
    const costPennies = costRaw ? parseGBPToPennies(costRaw) : null;

    const stock = parseStockInt(formData.get("stock"));

    const specialRaw = String(formData.get("specialPrice") ?? "").trim();
    const specialPennies = specialRaw ? parseGBPToPennies(specialRaw) : null;

    // Validation (match your current behaviour)
    if (!name) fieldErrors.name = "Name is required";
    if (!description) fieldErrors.description = "Description is required";
    if (!image) fieldErrors.image = "Image URL is required";

    if (pricePennies === null || pricePennies < 0) {
      fieldErrors.price = "Enter a valid £ amount (0+)";
    }

    if (costRaw) {
      if (costPennies === null || costPennies < 0) {
        fieldErrors.cost = "Enter a valid cost £ amount (0+) or leave blank";
      }
      if (
        typeof pricePennies === "number" &&
        typeof costPennies === "number" &&
        costPennies > pricePennies
      ) {
        fieldErrors.cost = "Cost is higher than selling price (check this is correct)";
      }
    }

    if (stock === null) {
      fieldErrors.stock = "Stock must be a whole number (0+)";
    }

    if (onSpecial) {
      if (specialPennies !== null) {
        if (specialPennies < 1) {
          fieldErrors.specialPrice =
            "Special price must be at least £0.01 (or leave blank).";
        }
        if (typeof pricePennies === "number" && specialPennies >= pricePennies) {
          fieldErrors.specialPrice =
            "Special price must be lower than the normal price.";
        }
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return {
        ok: false,
        message: "Please fix the highlighted fields.",
        fieldErrors,
      };
    }

    const safePrice = pricePennies!;
    const safeStock = stock!;

    try {
      await prisma.$transaction(async (tx) => {
        // ✅ read previous stock + previous cost inside the transaction
        const before = await tx.product.findUnique({
          where: { id },
          select: { stock: true, costPennies: true, name: true },
        });
        if (!before) throw Object.assign(new Error("Not found"), { code: "P2025" });

        const prevStock = Number.isFinite(Number(before.stock)) ? Number(before.stock) : 0;
        const nextStock = safeStock;

        // ✅ update product
        const updated = await tx.product.update({
          where: { id },
          data: {
            name,
            description,
            price: safePrice,
            stock: nextStock,
            image,
            isActive,
            costPennies: costPennies, // nullable; blank clears
          },
          select: { id: true, stock: true, costPennies: true, name: true },
        });

        // ✅ NEW: record stock purchase ONLY if stock increased
        const delta = nextStock - prevStock;
        if (delta > 0) {
          // Use new cost if provided, else fallback to existing cost (before update or updated)
          const unitCost =
            (typeof costPennies === "number" ? costPennies : null) ??
            (typeof before.costPennies === "number" ? before.costPennies : null) ??
            (typeof updated.costPennies === "number" ? updated.costPennies : null);

          if (typeof unitCost === "number" && unitCost > 0) {
            await tx.stockPurchase.create({
              data: {
                productId: updated.id,
                qtyAdded: delta,
                unitCostPennies: unitCost,
                totalCostPennies: delta * unitCost,
                note: `Stock increased via admin edit (+${delta})`,
              },
            });
          }
          // If unitCost is missing, we silently skip the purchase row
          // (you can force an error instead if you prefer)
        }

        // Deals logic (unchanged)
        if (onSpecial) {
          const now = new Date();
          const finalSpecialPrice =
            specialPennies !== null ? specialPennies : safePrice;

          const activeDeal = await tx.deal.findFirst({
            where: activeDealWhere(id),
          });

          const dealData = {
            title: `${name} (Special)`,
            description,
            image,
            buttonLabel: "Shop deal",
            buttonUrl: "/products",
            specialPrice: finalSpecialPrice,
            isActive: true,
            startsAt: now,
            endsAt: null as Date | null,
          };

          if (activeDeal) {
            await tx.deal.update({
              where: { id: activeDeal.id },
              data: dealData,
            });
          } else {
            await tx.deal.create({
              data: {
                productId: id,
                ...dealData,
              },
            });
          }
        } else {
          await tx.deal.updateMany({
            where: { productId: id, isActive: true },
            data: { isActive: false, endsAt: new Date() },
          });
        }
      });

      return { ok: true, message: "Saved successfully." };
    } catch (e: any) {
      if (e?.code === "P2025") return { ok: false, message: "Product no longer exists." };
      return { ok: false, message: "Save failed. Please try again." };
    }
  }

  const isOnSpecial = Boolean(currentDeal);

  return (
    <main className="min-h-screen bg-black text-white p-6 sm:p-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-white/50 text-sm">Signal Admin</p>
            <h1 className="text-3xl font-semibold mt-1">Edit product</h1>
            <p className="text-white/60 mt-2">
              <span className="font-medium text-white">{product.name}</span>
              <span className="mx-2">•</span>
              <span>{formatGBPFromPennies(product.price)}</span>
              {typeof product.costPennies === "number" ? (
                <>
                  <span className="mx-2">•</span>
                  <span className="text-white/50">
                    Cost: {formatGBPFromPennies(product.costPennies)}
                  </span>
                </>
              ) : null}
            </p>
          </div>

          <Link
            href="/admin/products"
            className="rounded-full px-4 py-2 text-sm bg-white/10 hover:bg-white/15 border border-white/10"
          >
            Back
          </Link>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
          <EditProductForm
            action={updateProductAction}
            defaults={{
              name: product.name,
              description: product.description ?? "",
              price: penniesToPoundsString(product.price),
              cost: penniesToPoundsString(product.costPennies),
              stock: String(product.stock ?? 0),
              image: product.image ?? "",
              isActive: product.isActive,
              onSpecial: isOnSpecial,
              specialPrice: currentDeal ? penniesToPoundsString(currentDeal.specialPrice) : "",
              variants: (() => {
                try { return JSON.parse((product as any).variantsJson ?? "[]") || []; }
                catch { return []; }
              })(),
            }}
          />

          <p className="text-xs text-white/40 pt-5">
            Product price is stored in pennies. Cost is stored in pennies (COGS). When stock increases and a cost exists,
            a StockPurchase row is created for analytics.
          </p>
        </div>
      </div>
    </main>
  );
}