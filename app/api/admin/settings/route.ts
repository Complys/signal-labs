// app/api/admin/settings/shipping/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Accepts numbers or numeric strings (e.g. from <input />)
 */
const IntLike = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must be an integer" });
    return z.NEVER;
  }
  return n;
});

const UpdateSchema = z.object({
  enabled: z.boolean(),
  flatRatePennies: IntLike.refine((n) => n >= 0, "Must be >= 0"),
  freeOverPennies: IntLike.refine((n) => n >= 0, "Must be >= 0"),
});

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function toDTO(s: {
  id: number;
  enabled: boolean;
  flatRatePennies: number;
  freeOverPennies: number;
  updatedAt: Date;
}) {
  return {
    id: String(s.id),
    enabled: s.enabled,
    flatRatePennies: s.flatRatePennies,
    freeOverPennies: s.freeOverPennies,
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
  return NextResponse.json({ ok: true, settings: toDTO(s) }, { status: 200 });
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
      { ok: false, error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Single call: upsert ensures row exists, and updates it
  const updated = await prisma.shippingSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      enabled: parsed.data.enabled,
      flatRatePennies: parsed.data.flatRatePennies,
      freeOverPennies: parsed.data.freeOverPennies,
    },
    update: {
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

  return NextResponse.json({ ok: true, settings: toDTO(updated) }, { status: 200 });
}