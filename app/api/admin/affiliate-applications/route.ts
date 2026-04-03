import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const applications = await prisma.affiliateApplication.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      requestedCode: true,
      name: true,
      email: true,
      website: true,
      instagram: true,
      tiktok: true,
      youtube: true,
      notes: true,
      affiliateId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, applications });
}