// app/api/admin/settings/shipping/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  enabled: z.boolean(),
  flatRatePennies: z.number().int().nonnegative(),
  freeOverPennies: z.number().int().nonnegative(),
});

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function toDTO(s: { id: number; enabled: boolean; flatRatePennies: number; freeOverPennies: number; updatedAt: Date }) {
  return {
    id: String(s.id),
    enabled: !!s.enabled,
    flatRatePennies: Number(s.flatRatePennies ?? 0),
    freeOverPennies: Number(s.freeOverPennies ?? 0),
    updatedAt: s.updatedAt.toISOString(),
  };
}

async function getOrCreate() {
  return prisma.shippingSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      enabled: true,
      flatRatePennies: 499,
      freeOverPennies: 3000,
    },
    update: {},
    select: {
      id: true,
      enabled: true,
      flatRatePennies: true,
      freeOverPennies: true,
      updatedAt: true,
    },
  });
}

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return unauthorized();
  }

  const s = await getOrCreate();
  return NextResponse.json(toDTO(s), { status: 200 });
}

export async function PUT(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return unauthorized();
  }

  const json = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Ensure row exists
  await getOrCreate();

  const updated = await prisma.shippingSettings.update({
    where: { id: 1 },
    data: {
      enabled: parsed.data.enabled,
      flatRatePennies: parsed.data.flatRatePennies,
      freeOverPennies: parsed.data.freeOverPennies,
    },
    select: {
      id: true,
      enabled: true,
      flatRatePennies: true,
      freeOverPennies: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(toDTO(updated), { status: 200 });
}