// app/api/checkout/cart/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

type CartItem = {
  productId: string;
  qty: number;
};

function clampInt(n: unknown, min: number, max: number) {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, Math.trunc(x)));
}

function getBaseUrl(req: Request) {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_URL;

  if (envUrl) {
    const u = envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
    return u.replace(/\/$/, "");
  }

  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  return "http://localhost:3000";
}

function normalizeItems(raw: any): CartItem[] {
  const items = Array.isArray(raw?.items) ? (raw.items as any[]) : [];

  return items
    .map((it) => ({
      productId: String(it?.productId ?? "").trim(),
      qty: clampInt(it?.qty ?? it?.quantity ?? 1, 1, 99),
    }))
    .filter((it) => it.productId.length > 0);
}

/** Shipping settings (single row id=1) */
async function getShippingSettings() {
  return prisma.shippingSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
    select: { freeOverPennies: true, flatRatePennies: true, enabled: true },
  });
}

function penniesToGbp(p: number) {
  const n = Number.isFinite(p) ? p : 0;
  return (n / 100).toFixed(2);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items = normalizeItems(body);

    if (items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Fetch products from DB (never trust client price/name)
    const productIds = Array.from(new Set(items.map((i) => i.productId)));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, name: true, price: true, specialPrice: true },
    });

    const byId = new Map(products.map((p) => [p.id, p]));

    const missingIds: string[] = [];
    const invalidPriceIds: string[] = [];

    const line_items: {
      price_data: {
        currency: "gbp";
        product_data: { name: string; metadata?: Record<string, string> };
        unit_amount: number;
      };
      quantity: number;
    }[] = [];

    // Build product lines + compute subtotal from DB-trusted unit amounts
    let subtotalPennies = 0;

    for (const it of items) {
      const p = byId.get(it.productId);
      if (!p) {
        missingIds.push(it.productId);
        continue;
      }

      // pennies (Int) – do NOT *100
      const base = Math.round(Number(p.price));
      const maybeSpecial = p.specialPrice == null ? null : Math.round(Number(p.specialPrice));
      const useSpecial =
        Number.isFinite(maybeSpecial as any) &&
        (maybeSpecial as number) > 0 &&
        (maybeSpecial as number) < base;

      const unitAmount = useSpecial ? (maybeSpecial as number) : base;

      if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
        invalidPriceIds.push(p.id);
        continue;
      }

      // Stripe: keep name safe + not empty
      const safeName = String(p.name ?? "").trim().slice(0, 200) || "Product";

      line_items.push({
        price_data: {
          currency: "gbp",
          product_data: {
            name: safeName,
            metadata: {
              productId: p.id,
              kind: "product",
            },
          },
          unit_amount: unitAmount,
        },
        quantity: it.qty,
      });

      subtotalPennies += unitAmount * it.qty;
    }

    if (line_items.length === 0) {
      return NextResponse.json(
        {
          error: "No valid items to checkout",
          details:
            process.env.NODE_ENV === "development"
              ? { missingIds, invalidPriceIds }
              : undefined,
        },
        { status: 400 }
      );
    }

    if (process.env.NODE_ENV === "development") {
      if (missingIds.length) console.warn("Cart checkout missing products:", missingIds);
      if (invalidPriceIds.length) console.warn("Cart checkout invalid prices:", invalidPriceIds);
    }

    // ---------- Shipping (DB-controlled) ----------
    const ship = await getShippingSettings();

    const thresholdPennies = Math.max(0, ship.freeOverPennies ?? 0);
    const flatRatePennies = Math.max(0, ship.flatRatePennies ?? 0);

    const shippingEnabled = !!ship.enabled;

    const isFree = shippingEnabled ? subtotalPennies >= thresholdPennies : true;
    const shippingPennies = shippingEnabled ? (isFree ? 0 : flatRatePennies) : 0;

    const thresholdGbp = penniesToGbp(thresholdPennies);
    const flatGbp = penniesToGbp(flatRatePennies);

    // Customer-facing explanation in Stripe checkout
    const shippingName = isFree
      ? `Delivery (FREE over £${thresholdGbp})`
      : `Delivery (£${flatGbp}) — FREE over £${thresholdGbp}`;

    if (shippingEnabled) {
      line_items.push({
        price_data: {
          currency: "gbp",
          unit_amount: shippingPennies,
          product_data: {
            name: shippingName,
            metadata: {
              kind: "shipping",
              freeOverPennies: String(thresholdPennies),
              flatRatePennies: String(flatRatePennies),
              rule: isFree ? `free_over_${thresholdPennies}` : `flat_${flatRatePennies}`,
            },
          },
        },
        quantity: 1,
      });
    }

    const baseUrl = getBaseUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cart`,

      // helpful metadata for debugging / future order tracking
      metadata: {
        itemCount: String(line_items.length),
        subtotalPennies: String(subtotalPennies),
        shippingEnabled: String(shippingEnabled),
        shippingPennies: String(shippingPennies),
        shippingRule: shippingEnabled ? (isFree ? `free_over_${thresholdPennies}` : `flat_${flatRatePennies}`) : "disabled",
        shippingFreeOverPennies: String(thresholdPennies),
        shippingFlatRatePennies: String(flatRatePennies),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    const message =
      process.env.NODE_ENV === "development"
        ? err?.message || String(err)
        : "Something went wrong";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}