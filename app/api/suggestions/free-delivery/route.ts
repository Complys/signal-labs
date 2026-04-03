// app/api/suggestions/free-delivery/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toInt(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clampInt(v: unknown, min: number, max: number) {
  return Math.min(max, Math.max(min, toInt(v, min)));
}

function strParam(url: URL, key: string) {
  const v = url.searchParams.get(key);
  return v && v.trim() ? v.trim() : null;
}

function effectivePricePennies(price: number, specialPrice: number | null) {
  const base = Number.isFinite(price) ? price : 0;
  const sp = typeof specialPrice === "number" && Number.isFinite(specialPrice) ? specialPrice : null;
  if (sp != null && sp > 0 && sp < base) return sp;
  return base;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const subtotalPennies = clampInt(url.searchParams.get("subtotalPennies"), 0, 10_000_000);
    const limit = clampInt(url.searchParams.get("limit"), 1, 20); // keep small for UI
    const excludeProductId = strParam(url, "excludeProductId");

    // ✅ Read shipping settings (code-friendly fields)
    const ship =
      (await prisma.shippingSettings.findUnique({
        where: { id: 1 },
        select: { freeOverPennies: true, flatRatePennies: true, enabled: true },
      })) ?? { freeOverPennies: 3000, flatRatePennies: 499, enabled: true };

    if (!ship.enabled) {
      return NextResponse.json({
        ok: true,
        enabled: false,
        remainingPennies: 0,
        suggestions: [],
      });
    }

    const threshold = Math.max(0, Number(ship.freeOverPennies || 0));
    const remainingPennies = Math.max(0, threshold - subtotalPennies);

    // Already free → hide upsell
    if (remainingPennies <= 0) {
      return NextResponse.json({
        ok: true,
        enabled: true,
        remainingPennies: 0,
        suggestions: [],
      });
    }

    // Reduce DB work:
    // show “small add-ons” by capping to remaining + buffer
    const bufferPennies = 500; // +£5 gives more choices
    const maxPricePennies = Math.min(10_000_000, remainingPennies + bufferPennies);

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        stock: { gt: 0 },
        ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
        // cap on base price; specials are handled in code
        price: { lte: maxPricePennies },
      },
      select: {
        id: true,
        name: true,
        price: true,
        specialPrice: true,
        image: true,
        stock: true,
      },
      // grab a bit more than needed then refine in JS
      take: limit * 6,
      orderBy: [{ price: "asc" }],
    });

    const candidates = products
      .map((p) => {
        const eff = effectivePricePennies(p.price, p.specialPrice ?? null);
        return {
          id: p.id,
          name: p.name,
          image: p.image ?? null,
          pricePennies: eff,
          stock: p.stock,
        };
      })
      .filter((p) => p.pricePennies > 0)
      .sort((a, b) => a.pricePennies - b.pricePennies);

    // Prefer items that unlock free delivery in one go
    const unlockNow = candidates.filter((p) => p.pricePennies >= remainingPennies);

    const suggestions = (unlockNow.length ? unlockNow : candidates).slice(0, limit);

    return NextResponse.json({
      ok: true,
      enabled: true,
      remainingPennies,
      suggestions,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load suggestions" },
      { status: 500 }
    );
  }
}