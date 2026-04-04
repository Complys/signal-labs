// app/api/admin/products/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asString(v: unknown) {
  return String(v ?? "").trim();
}

function asBool(v: unknown, fallback = true) {
  if (typeof v === "boolean") return v;
  const s = asString(v).toLowerCase();
  if (s === "true" || s === "on" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "off" || s === "0" || s === "no") return false;
  return fallback;
}

function parseIntPennies(v: unknown) {
  // Accept: number or numeric string (already pennies)
  if (v === null || v === undefined || asString(v) === "") return { ok: true as const, pennies: 0 };

  const n = Number(v);
  if (!Number.isFinite(n)) return { ok: false as const, error: "Must be a valid number" };

  const pennies = Math.round(n);
  if (!Number.isInteger(pennies) || pennies < 0) {
    return { ok: false as const, error: "Must be whole pennies (0+)" };
  }
  return { ok: true as const, pennies };
}

/**
 * Price parsing:
 * - Your admin UI sends `price` as pennies (Int)
 * - Also supports legacy pounds strings like "12.99" if needed
 */
function parsePricePennies(data: Record<string, unknown>) {
  const directPennies = data.pricePennies ?? data.price_pennies ?? data.price ?? null;

  if (directPennies !== null && directPennies !== undefined && asString(directPennies) !== "") {
    const n = Number(directPennies);
    if (!Number.isFinite(n)) return { ok: false as const, error: "Price must be a valid number" };
    const pennies = Math.round(n);
    if (!Number.isInteger(pennies) || pennies < 0) {
      return { ok: false as const, error: "Price must be whole pennies (0+)" };
    }
    return { ok: true as const, pennies };
  }

  // legacy fallback
  const s = asString(data.price).replace("£", "").replace(/,/g, "");
  if (!s) return { ok: false as const, error: "Price is required" };

  if (!/^\d+(\.\d{0,2})?$/.test(s)) {
    return { ok: false as const, error: "Price must look like 12.99" };
  }

  const [pounds, pence = ""] = s.split(".");
  const pence2 = (pence + "00").slice(0, 2);
  const pennies = Number(pounds) * 100 + Number(pence2);

  if (!Number.isFinite(pennies) || pennies < 0) {
    return { ok: false as const, error: "Price must be a valid number (0+)" };
  }

  return { ok: true as const, pennies: Math.trunc(pennies) };
}

function parseStock(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return { ok: false as const, error: "Stock must be a number" };

  const stock = Math.floor(n);
  if (!Number.isInteger(stock) || stock < 0) {
    return { ok: false as const, error: "Stock must be a whole number (0+)" };
  }
  return { ok: true as const, stock };
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const json = await req.json().catch(() => ({}));
    return json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  }

  const form = await req.formData();
  const data: Record<string, unknown> = {};
  form.forEach((value, key) => {
    data[key] = typeof value === "string" ? value : value.name;
  });
  return data;
}

function getBaseUrl(req: Request) {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host");
  if (!host) return null;
  return `${proto}://${host}`;
}

async function getSessionFromApi(req: Request) {
  try {
    const base = getBaseUrl(req);
    if (!base) return null;

    const cookieHeader = req.headers.get("cookie") || "";
    const res = await fetch(`${base}/api/auth/session`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromApi(req);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await readBody(req);

    const name = asString(data.name);
    const description = asString(data.description) || null;
    const image = asString(data.imageUrl ?? data.image) || null;
    const isActive = asBool(data.isActive, true);

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const priceParsed = parsePricePennies(data);
    if (!priceParsed.ok) return NextResponse.json({ error: priceParsed.error }, { status: 400 });

    const stockParsed = parseStock(data.stock);
    if (!stockParsed.ok) return NextResponse.json({ error: stockParsed.error }, { status: 400 });

    // ✅ NEW: costPennies (optional)
    // Your new admin page sends `costPennies` already as pennies (Int)
    const costRaw = data.costPennies ?? data.cost_pennies ?? data.unitCostPennies ?? null;
    const costParsed = parseIntPennies(costRaw);
    if (!costParsed.ok) {
      return NextResponse.json({ error: `Cost: ${costParsed.error}` }, { status: 400 });
    }

    const initialStockNote = asString(data.initialStockNote) || null;

    // Parse variantsJson
    let variantsJson: string | null = null;
    const rawVariants = data.variantsJson;
    if (rawVariants && typeof rawVariants === "string" && rawVariants !== "[]") {
      try { JSON.parse(rawVariants); variantsJson = rawVariants; } catch {}
    }

    // ✅ IMPORTANT: transaction so product + stock purchase stay in sync
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name,
          description,
          price: priceParsed.pennies,
          image,
          stock: stockParsed.stock,
          isActive,
          costPennies: costParsed.pennies > 0 ? costParsed.pennies : null,
          variantsJson,
        },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          image: true,
          stock: true,
          isActive: true,
          costPennies: true,
          createdAt: true,
        },
      });

      // ✅ NEW: record initial inventory spend (creates “loss to start”)
      if (product.stock > 0 && (product.costPennies ?? 0) > 0) {
        await tx.stockPurchase.create({
          data: {
            productId: product.id,
            qtyAdded: product.stock,
            unitCostPennies: product.costPennies!, // safe due to check above
            totalCostPennies: product.stock * product.costPennies!,
            note: initialStockNote || "Initial stock set on product creation",
          },
        });
      }

      return product;
    });

    return NextResponse.json({ product: result }, { status: 201 });
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}