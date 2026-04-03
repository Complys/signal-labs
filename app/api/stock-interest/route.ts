import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { productId, email } = await req.json().catch(() => ({}));

    if (!productId || !email || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "Valid email and product required." }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, stock: true },
    });

    if (!product) {
      return NextResponse.json({ ok: false, error: "Product not found." }, { status: 404 });
    }

    if (product.stock > 0) {
      return NextResponse.json({ ok: false, error: "Product is back in stock." }, { status: 400 });
    }

    await prisma.stockInterest.upsert({
      where: { productId_email: { productId, email: email.toLowerCase() } },
      create: { productId, email: email.toLowerCase() },
      update: {},
    });

    return NextResponse.json({ ok: true, message: "You will be notified when this product is back in stock." });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error." }, { status: 500 });
  }
}
