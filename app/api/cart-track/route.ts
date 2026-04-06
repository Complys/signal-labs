export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { sessionId, productId, variantLabel, quantity, pricePennies } = await req.json().catch(() => ({}));
    if (!sessionId || !productId) return NextResponse.json({ ok: false });
    await prisma.cartItem.upsert({
      where: { sessionId_productId_variantLabel: { sessionId, productId, variantLabel: variantLabel ?? "" } },
      create: { sessionId, productId, variantLabel, quantity: quantity ?? 1, pricePennies: pricePennies ?? 0 },
      update: { quantity: quantity ?? 1, pricePennies: pricePennies ?? 0, updatedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false }); }
}

export async function DELETE(req: Request) {
  try {
    const { sessionId, productId, variantLabel } = await req.json().catch(() => ({}));
    if (!sessionId || !productId) return NextResponse.json({ ok: false });
    await prisma.cartItem.deleteMany({ where: { sessionId, productId, variantLabel: variantLabel ?? "" } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false }); }
}
