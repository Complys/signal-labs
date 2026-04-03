import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function clean(v: unknown) {
  return String(v ?? "").trim();
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id: raw } = await ctx.params;
  const id = clean(raw);
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  await prisma.runningCost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}