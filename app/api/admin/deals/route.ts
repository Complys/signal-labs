export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isAdmin(session: any) {
  return session?.user?.role === "ADMIN";
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any) as any;
  if (!isAdmin(session)) {
    return NextResponse.json(
      { error: "Unauthorized", debugRole: session?.user?.role ?? null },
      { status: 401 }
    );
  }

  const body = await req.json();

  const deal = await prisma.deal.create({
    data: {
      productId: body.productId ?? null,
      title: body.title,
      description: body.description ?? null,
      image: body.image ?? null,
      buttonLabel: body.buttonLabel ?? null,
      buttonUrl: body.buttonUrl ?? null,
      specialPrice: Number(body.specialPrice) || 0,
      isActive: Boolean(body.isActive),
      startsAt: new Date(body.startsAt),
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    },
  });

  return NextResponse.json({ deal });
}
