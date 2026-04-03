import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";

type Ctx = { params: Promise<{ id: string }> };

function clean(v: unknown) {
  return String(v ?? "").trim();
}

export async function PATCH(req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const action = clean(body?.action); // "approve" | "reject"
  const defaultRateBps = Number(body?.defaultRateBps ?? 500);

  const app = await prisma.affiliateApplication.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      requestedCode: true,
      name: true,
      email: true,
    },
  });

  if (!app) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  if (action === "reject") {
    const updated = await prisma.affiliateApplication.update({
      where: { id },
      data: { status: "REJECTED" },
      select: { id: true, status: true },
    });
    return NextResponse.json({ ok: true, application: updated });
  }

  if (action !== "approve") {
    return NextResponse.json({ ok: false, error: "Invalid action." }, { status: 400 });
  }

  if (app.status !== "PENDING") {
    return NextResponse.json({ ok: false, error: "Only PENDING applications can be approved." }, { status: 400 });
  }

  // ensure code still available
  const existsAffiliate = await prisma.affiliate.findUnique({
    where: { code: app.requestedCode },
    select: { id: true },
  });
  if (existsAffiliate) {
    return NextResponse.json({ ok: false, error: "That code is already taken." }, { status: 409 });
  }

  // transaction: create Affiliate + mark application approved
  const result = await prisma.$transaction(async (tx) => {
    const affiliate = await tx.affiliate.create({
      data: {
        code: app.requestedCode,
        name: app.name,
        isActive: true,
        defaultRateBps: Number.isFinite(defaultRateBps) ? Math.max(0, Math.min(5000, Math.trunc(defaultRateBps))) : 500,
      },
      select: { id: true, code: true, name: true, isActive: true, defaultRateBps: true, createdAt: true, updatedAt: true },
    });

    const application = await tx.affiliateApplication.update({
      where: { id: app.id },
      data: { status: "APPROVED", affiliateId: affiliate.id },
      select: { id: true, status: true, affiliateId: true },
    });

    return { affiliate, application };
  });

  return NextResponse.json({ ok: true, ...result });
}