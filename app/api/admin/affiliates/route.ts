// app/api/admin/affiliates/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(v: unknown) {
  return String(v ?? "").trim();
}
function upper(v: unknown) {
  return clean(v).toUpperCase();
}
function clampInt(n: number, min: number, max: number) {
  const x = Number.isFinite(n) ? Math.trunc(n) : min;
  return Math.max(min, Math.min(max, x));
}

const TIERS = ["STANDARD", "SILVER", "GOLD", "VIP"] as const;
type Tier = (typeof TIERS)[number];

function tierDefaults(tier: Tier) {
  // You can tweak these whenever you want
  switch (tier) {
    case "STANDARD":
      return { defaultRateBps: 500, cookieDays: 30 }; // 5%
    case "SILVER":
      return { defaultRateBps: 750, cookieDays: 45 }; // 7.5%
    case "GOLD":
      return { defaultRateBps: 1000, cookieDays: 60 }; // 10%
    case "VIP":
      return { defaultRateBps: 1250, cookieDays: 90 }; // 12.5%
  }
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const affiliates = await prisma.affiliate.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        status: true,

        tier: true,
        defaultRateBps: true,
        rateOverrideBps: true,
        cookieDays: true,
        perksJson: true,

        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, affiliates });
  } catch (e: any) {
    console.error("GET /api/admin/affiliates failed:", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const code = upper(body?.code);
  const name = clean(body?.name);
  const isActive = Boolean(body?.isActive ?? true);

  const tierRaw = upper(body?.tier || "STANDARD");
  const tier: Tier = (TIERS as readonly string[]).includes(tierRaw) ? (tierRaw as Tier) : "STANDARD";

  const perksJson = clean(body?.perksJson) || null;

  // commission inputs
  const hasManualDefault = body?.defaultRateBps !== undefined && body?.defaultRateBps !== null && clean(body?.defaultRateBps) !== "";
  const hasOverride = body?.rateOverrideBps !== undefined && body?.rateOverrideBps !== null && clean(body?.rateOverrideBps) !== "";

  const td = tierDefaults(tier);

  const defaultRateBps = hasManualDefault
    ? clampInt(Number(body?.defaultRateBps), 0, 5000)
    : td.defaultRateBps;

  const rateOverrideBps = hasOverride
    ? clampInt(Number(body?.rateOverrideBps), 0, 5000)
    : null;

  const cookieDays = body?.cookieDays !== undefined && body?.cookieDays !== null && clean(body?.cookieDays) !== ""
    ? clampInt(Number(body?.cookieDays), 1, 365)
    : td.cookieDays;

  if (!code || code.length < 3 || code.length > 32) {
    return NextResponse.json({ ok: false, error: "Code must be 3–32 characters." }, { status: 400 });
  }
  if (!/^[A-Z0-9_-]+$/.test(code)) {
    return NextResponse.json({ ok: false, error: "Code can only contain A–Z, 0–9, _ or -." }, { status: 400 });
  }
  if (!name || name.length < 2 || name.length > 80) {
    return NextResponse.json({ ok: false, error: "Name must be 2–80 characters." }, { status: 400 });
  }

  try {
    const created = await prisma.affiliate.create({
      data: {
        code,
        name,
        isActive,

        status: "APPROVED",

        tier,
        defaultRateBps,
        rateOverrideBps,
        cookieDays,
        perksJson,
      },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        status: true,
        tier: true,
        defaultRateBps: true,
        rateOverrideBps: true,
        cookieDays: true,
        perksJson: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, affiliate: created });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ ok: false, error: "That code is already taken." }, { status: 409 });
    }
    console.error("POST /api/admin/affiliates failed:", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}