import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const totalAffiliates = await prisma.affiliate.count({ where: { isActive: true } });

  // Only show leaderboard when there are 10 or more affiliates
  if (totalAffiliates < 10) {
    return NextResponse.json({ ok: true, visible: false, entries: [] });
  }

  const entries = await prisma.affiliateTransaction.groupBy({
    by: ["affiliateId"],
    where: {
      type: "COMMISSION",
      status: { in: ["AVAILABLE", "PAID"] },
    },
    _sum: { amountPennies: true },
    orderBy: { _sum: { amountPennies: "desc" } },
    take: 10,
  }).catch(() => []);

  const affiliateIds = entries.map((e) => e.affiliateId);
  const affiliates = await prisma.affiliate.findMany({
    where: { id: { in: affiliateIds } },
    select: { id: true, code: true, name: true },
  });

  const affiliateMap = Object.fromEntries(affiliates.map((a) => [a.id, a]));

  const leaderboard = entries.map((e, i) => ({
    rank: i + 1,
    code: affiliateMap[e.affiliateId]?.code ?? "—",
    name: affiliateMap[e.affiliateId]?.name ?? "—",
    totalPennies: e._sum.amountPennies ?? 0,
  }));

  return NextResponse.json({ ok: true, visible: true, entries: leaderboard });
}
