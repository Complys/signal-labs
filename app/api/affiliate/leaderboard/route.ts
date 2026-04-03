export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const totalAffiliates = await prisma.affiliate.count({ where: { isActive: true } });

    if (totalAffiliates < 10) {
      return NextResponse.json({ ok: true, visible: false, entries: [] });
    }

    const transactions = await prisma.affiliateTransaction.findMany({
      where: {
        type: "COMMISSION",
        status: { in: ["AVAILABLE", "PAID"] },
      },
      select: {
        affiliateId: true,
        amountPennies: true,
      },
    });

    // Group and sum in JS instead of DB
    const totals: Record<string, number> = {};
    for (const t of transactions) {
      totals[t.affiliateId] = (totals[t.affiliateId] || 0) + t.amountPennies;
    }

    const sorted = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const affiliateIds = sorted.map(([id]) => id);
    const affiliates = await prisma.affiliate.findMany({
      where: { id: { in: affiliateIds } },
      select: { id: true, code: true, name: true },
    });

    const affiliateMap = Object.fromEntries(affiliates.map((a) => [a.id, a]));

    const leaderboard = sorted.map(([affiliateId, totalPennies], i) => ({
      rank: i + 1,
      code: affiliateMap[affiliateId]?.code ?? "—",
      name: affiliateMap[affiliateId]?.name ?? "—",
      totalPennies,
    }));

    return NextResponse.json({ ok: true, visible: true, entries: leaderboard });
  } catch {
    return NextResponse.json({ ok: true, visible: false, entries: [] });
  }
}
