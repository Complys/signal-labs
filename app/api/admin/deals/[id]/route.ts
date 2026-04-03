export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type PatchBody = {
  productId?: string | null;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  specialPrice?: number | null; // pennies
  isActive?: boolean;
  startsAt?: string | null; // ISO
  endsAt?: string | null;   // ISO or null
};

async function unwrapParamsId(
  params: { id?: string } | Promise<{ id?: string }> | undefined
) {
  if (!params) return undefined;
  // If params is a Promise in your Next version, await it
  if (typeof (params as any).then === "function") {
    const p = await (params as Promise<{ id?: string }>);
    return p?.id;
  }
  return (params as { id?: string })?.id;
}

export async function PATCH(
  req: Request,
  ctx: { params: { id?: string } } | { params: Promise<{ id?: string }> }
) {
  const id = await unwrapParamsId((ctx as any).params);

  if (!id) {
    return NextResponse.json(
      { ok: false, message: "Missing deal id in route params." },
      { status: 400 }
    );
  }

  const body = (await req.json()) as PatchBody;

  const startsAt =
    body.startsAt !== undefined && body.startsAt !== null
      ? new Date(body.startsAt)
      : undefined;

  const endsAt =
    body.endsAt === undefined
      ? undefined
      : body.endsAt === null
      ? null
      : new Date(body.endsAt);

  try {
    const deal = await prisma.deal.update({
      where: { id },
      data: {
        ...(body.productId !== undefined ? { productId: body.productId } : {}),
        ...(body.title !== undefined ? { title: body.title ?? "" } : {}),
        ...(body.description !== undefined ? { description: body.description ?? "" } : {}),
        ...(body.image !== undefined ? { image: body.image ?? "" } : {}),
        ...(body.buttonLabel !== undefined ? { buttonLabel: body.buttonLabel ?? "" } : {}),
        ...(body.buttonUrl !== undefined ? { buttonUrl: body.buttonUrl ?? "" } : {}),
        ...(body.specialPrice !== undefined ? { specialPrice: body.specialPrice ?? 0 } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(startsAt !== undefined ? { startsAt } : {}),
        ...(endsAt !== undefined ? { endsAt } : {}),
      },
    });

    return NextResponse.json({ ok: true, deal });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "Failed to update deal." },
      { status: 500 }
    );
  }
}

