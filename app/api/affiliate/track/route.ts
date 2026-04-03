import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("ref") || "").toUpperCase().trim();
  const landingPath = searchParams.get("path") || "/";
  const referrer = req.headers.get("referer") || "";
  const ua = req.headers.get("user-agent") || "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";

  if (!code) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const affiliate = await prisma.affiliate.findUnique({
    where: { code },
    select: { id: true, isActive: true },
  });

  if (!affiliate || !affiliate.isActive) {
    return NextResponse.json({ ok: false, error: "Invalid code" }, { status: 404 });
  }

  // Record click
  await prisma.affiliateClick.create({
    data: {
      affiliateId: affiliate.id,
      landingPath,
      referrer: referrer || null,
      ipHash: ip ? crypto.createHash("sha256").update(ip).digest("hex") : null,
      userAgent: ua || null,
    },
  });

  const res = NextResponse.json({ ok: true });

  // Set 30-day cookie
  res.cookies.set("aff_ref", code, {
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return res;
}
