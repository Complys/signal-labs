export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const image = String(body.image ?? "").trim();
  const stripePriceId = String(body.stripePriceId ?? "").trim();

  const price = Number(body.price);
  const stock = Number(body.stock);

  const isActive = body.isActive === false ? false : true;

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });
  if (!image) return NextResponse.json({ error: "Image is required" }, { status: 400 });
  if (!stripePriceId) return NextResponse.json({ error: "Stripe URL is required" }, { status: 400 });
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "Price must be a valid number" }, { status: 400 });
  }
  if (!Number.isInteger(stock) || stock < 0) {
    return NextResponse.json({ error: "Stock must be a whole number (0+)" }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      name,
      description,
      price,
      image,
      stripePriceId,
      stock,
      isActive,
    },
  });

  return NextResponse.json({ product }, { status: 201 });
}
