export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { productId, on } = await req.json();

  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }

  // Turn ON: create an active deal (simple weekly special)
  if (on) {
    await prisma.deal.create({
      data: {
        productId,
        title: "Weekly Special",
        specialPrice: 0,
        isActive: true,
        startsAt: new Date(),
        endsAt: null,
      },
    });

    return NextResponse.json({ ok: true });
  }

  // Turn OFF: deactivate active deals for this product
  await prisma.deal.updateMany({
    where: { productId, isActive: true },
    data: { isActive: false, endsAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
