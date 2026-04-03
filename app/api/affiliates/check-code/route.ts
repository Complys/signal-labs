import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") || "").trim().toUpperCase();

  if (!code || code.length < 2) {
    return NextResponse.json({ available: false, error: "Code too short" });
  }

  const existing = await prisma.affiliate.findUnique({
    where: { code },
    select: { id: true },
  });

  const application = await prisma.affiliateApplication.findFirst({
    where: { requestedCode: code, status: "PENDING" },
    select: { id: true },
  });

  return NextResponse.json({ available: !existing && !application });
}
