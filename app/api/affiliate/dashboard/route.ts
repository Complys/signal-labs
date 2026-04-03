import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions as any) as any;
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;

  const affiliate = await prisma.affiliate.findFirst({
    where: { userId, isActive: true },
    include: {
      wallet: {
        include: {
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 50,
          },
        },
      },
    },
  });

  if (!affiliate) {
    return NextResponse.json(
      { ok: false, error: "No active affiliate account found." },
      { status: 404 }
    );
  }

  // Release pending commissions older than 30 days
  const now = new Date();
  if (affiliate.wallet) {
    const toRelease = await prisma.affiliateTransaction.findMany({
      where: {
        walletId: affiliate.wallet.id,
        status: "PENDING",
        availableAt: { lte: now },
      },
    });

    if (toRelease.length > 0) {
      const releaseTotal = toRelease.reduce((s, t) => s + t.amountPennies, 0);
      await prisma.$transaction([
        ...toRelease.map((t) =>
          prisma.affiliateTransaction.update({
            where: { id: t.id },
            data: { status: "AVAILABLE" },
          })
        ),
        prisma.affiliateWallet.update({
          where: { id: affiliate.wallet!.id },
          data: {
            pendingPennies: { decrement: releaseTotal },
            availablePennies: { increment: releaseTotal },
          },
        }),
      ]);

      // Refresh wallet data
      affiliate.wallet = await prisma.affiliateWallet.findUnique({
        where: { id: affiliate.wallet.id },
        include: {
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 50,
          },
        },
      }) as any;
    }
  }

  const clicks = await prisma.affiliateClick.count({
    where: { affiliateId: affiliate.id },
  });

  const orders = await prisma.affiliateTransaction.count({
    where: {
      affiliateId: affiliate.id,
      type: "COMMISSION",
    },
  });

  const totalEarned = await prisma.affiliateTransaction.aggregate({
    where: {
      affiliateId: affiliate.id,
      type: "COMMISSION",
      status: { in: ["AVAILABLE", "PAID"] },
    },
    _sum: { amountPennies: true },
  });

  return NextResponse.json({
    ok: true,
    stats: {
      code: affiliate.code,
      pendingPennies: affiliate.wallet?.pendingPennies ?? 0,
      availablePennies: affiliate.wallet?.availablePennies ?? 0,
      totalEarnedPennies: totalEarned._sum.amountPennies ?? 0,
      clicks,
      orders,
      transactions: affiliate.wallet?.transactions ?? [],
    },
  });
}
