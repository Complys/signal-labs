// app/r/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = clean(url.searchParams.get("ref")).toUpperCase();

  // Always redirect somewhere sane
  const redirectTo = clean(url.searchParams.get("to")) || "/";

  if (!ref) {
    return NextResponse.redirect(new URL(redirectTo, url.origin));
  }

  // Only set cookie if affiliate exists and is active/approved
  const aff = await prisma.affiliate.findUnique({
    where: { code: ref },
    select: { id: true, code: true, isActive: true, status: true, cookieDays: true },
  });

  if (!aff || !aff.isActive || aff.status !== "APPROVED") {
    return NextResponse.redirect(new URL(redirectTo, url.origin));
  }

  // Log click (best-effort)
  try {
    const ua = req.headers.get("user-agent") || "";
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "";

    const landingPath = clean(url.searchParams.get("lp")) || redirectTo;
    const referrer = req.headers.get("referer") || null;

    await prisma.affiliateClick.create({
      data: {
        affiliateId: aff.id,
        landingPath,
        referrer,
        ipHash: ip ? sha256(ip) : null,
        userAgent: ua || null,
      },
    });
  } catch {
    // swallow
  }

  const days = Number.isFinite(aff.cookieDays) ? Math.max(1, Math.min(365, aff.cookieDays)) : 30;
  const maxAge = days * 24 * 60 * 60;

  const res = NextResponse.redirect(new URL(redirectTo, url.origin));
  res.cookies.set("aff_ref", aff.code, {
    httpOnly: false, // readable by server or client if needed
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  return res;
}