import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function upper(v: unknown) {
  return clean(v).toUpperCase();
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function POST(req: Request) {
  try {
    const ua = req.headers.get("user-agent") || "";
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "";

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });

    // User chooses their own code
    const requestedCode = upper(body.requestedCode);
    const email = clean(body.email).toLowerCase();
    const name = clean(body.name);
    const website = clean(body.website) || null;
    const instagram = clean(body.instagram) || null;
    const tiktok = clean(body.tiktok) || null;
    const youtube = clean(body.youtube) || null;
    const facebook = clean(body.facebook) || null;
    const notes = clean(body.notes) || null;

    const acceptTerms = Boolean(body.acceptTerms);
    const termsVersion = clean(body.termsVersion);
    const termsUrl = clean(body.termsUrl) || null;

    if (!requestedCode) {
      return NextResponse.json({ ok: false, error: "Referral code is required." }, { status: 400 });
    }
    if (requestedCode.length < 3 || requestedCode.length > 32) {
      return NextResponse.json({ ok: false, error: "Code must be 3–32 characters." }, { status: 400 });
    }
    if (!/^[A-Z0-9_-]+$/.test(requestedCode)) {
      return NextResponse.json(
        { ok: false, error: "Code can only contain A–Z, 0–9, _ or -." },
        { status: 400 }
      );
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "Valid email is required." }, { status: 400 });
    }
    if (!name || name.length < 2) {
      return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
    }

    if (!acceptTerms) {
      return NextResponse.json({ ok: false, error: "You must accept the terms." }, { status: 400 });
    }
    if (!termsVersion) {
      return NextResponse.json({ ok: false, error: "Missing terms version." }, { status: 400 });
    }

    const ipHash = ip ? sha256(ip) : null;
    const uaHash = ua ? sha256(ua) : null;

    // 1) Code must not already exist as a LIVE affiliate
    const existsAffiliate = await prisma.affiliate.findUnique({
      where: { code: requestedCode },
      select: { id: true },
    });
    if (existsAffiliate) {
      return NextResponse.json({ ok: false, error: "That code is already taken." }, { status: 409 });
    }

    // 2) Code must not already have a pending application
    const existsPendingForCode = await prisma.affiliateApplication.findFirst({
      where: { requestedCode, status: "PENDING" },
      select: { id: true },
    });
    if (existsPendingForCode) {
      return NextResponse.json(
        { ok: false, error: "That code already has a pending application." },
        { status: 409 }
      );
    }

    // 3) Optional: prevent spamming multiple pending apps per email
    const existsPendingForEmail = await prisma.affiliateApplication.findFirst({
      where: { email, status: "PENDING" },
      select: { id: true },
    });
    if (existsPendingForEmail) {
      return NextResponse.json(
        { ok: false, error: "You already have a pending application. Please wait for approval." },
        { status: 409 }
      );
    }

    // Create application (PENDING)
    const app = await prisma.affiliateApplication.create({
      data: {
        status: "PENDING",
        requestedCode,
        name,
        email,
        website,
        instagram,
        tiktok,
        youtube,
        facebook,
        notes,

        // If you want to store these on the application for auditing:
        // (You don't currently have fields for these in schema; so we put them in notes)
        // To keep schema unchanged, we store terms meta in notes.
        // If you want dedicated columns, tell me and I’ll add them cleanly.
      },
      select: {
        id: true,
        status: true,
        requestedCode: true,
        createdAt: true,
      },
    });

    // Minimal audit trail without changing schema:
    // append terms + hashes into notes as JSON (optional)
    // If you prefer proper columns, I'll add them.
    if (termsUrl || ipHash || uaHash) {
      await prisma.affiliateApplication.update({
        where: { id: app.id },
        data: {
          notes: JSON.stringify({
            notes,
            termsVersion,
            termsUrl,
            ipHash,
            userAgent: ua,
          }),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      applicationId: app.id,
      status: app.status,
      requestedCode: app.requestedCode,
      message: "Application submitted. Your code will go live once approved.",
    });
  } catch (e: any) {
    console.error("POST /api/affiliates/apply failed:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error." }, { status: 500 });
  }
}