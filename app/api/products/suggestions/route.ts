import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const maxPricePennies = Number(searchParams.get("maxPricePennies") || "0");
  const take = Math.min(12, Math.max(1, Number(searchParams.get("take") || "6")));

  if (!Number.isFinite(maxPricePennies) || maxPricePennies <= 0) {
    return NextResponse.json({ items: [] });
  }

  const items = await prisma.product.findMany({
    where: {
      isActive: true,
      stock: { gt: 0 },
      price: { lte: maxPricePennies },
    },
    orderBy: [{ price: "desc" }],
    take,
    select: {
      id: true,
      name: true,
      image: true,
      price: true,
    },
  });

  return NextResponse.json({ items });
}