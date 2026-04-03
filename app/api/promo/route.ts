export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const enabled = await prisma.siteSetting.findUnique({ where: { key: "promo_enabled" } });
  const headline = await prisma.siteSetting.findUnique({ where: { key: "promo_headline" } });
  const code = await prisma.siteSetting.findUnique({ where: { key: "promo_code" } });

  return NextResponse.json({
    enabled: (enabled?.value ?? "true") === "true",
    headline: headline?.value ?? "Get 10% off your first order",
    code: code?.value ?? "WELCOME10",
  });
}
