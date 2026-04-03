import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function toInt(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clampRateBps(v: unknown) {
  return Math.max(0, Math.min(10_000, toInt(v, 0)));
}

export async function PATCH(req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const affiliateId = clean(id);
  if (!affiliateId) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

  const data: any = {};

  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.defaultRateBps !== undefined) data.defaultRateBps = clampRateBps(body.defaultRateBps);
  if (body.name !== undefined) data.name = clean(body.name) || null;

  const updated = await prisma.affiliate.update({
    where: { id: affiliateId },
    data,
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      defaultRateBps: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, affiliate: updated }, { status: 200 });
}