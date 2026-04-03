import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const row = await prisma.shippingSettings.findUnique({ where: { id: 1 } });

  // defaults if DB row missing
  const enabled = Boolean(row?.enabled ?? true);
  const freeOverPennies = Number(row?.freeOverPennies ?? 3000); // £30.00
  const flatRatePennies = Number(row?.flatRatePennies ?? 499); // £4.99

  return NextResponse.json({
    enabled,
    freeOverPennies,
    flatRatePennies,

    // ✅ Optional backward compatible alias (remove later if you want)
    shippingCostPennies: flatRatePennies,

    currency: "GBP",
  });
}