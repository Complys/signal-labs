import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const p = await prisma.product.findUnique({
    where: { id },
    select: { isActive: true },
  });

  if (!p) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.product.update({
    where: { id },
    data: { isActive: !p.isActive },
    select: { id: true, isActive: true },
  });

  return NextResponse.json(updated);
}
