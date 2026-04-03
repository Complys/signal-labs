import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any) as any;
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;

  const affiliate = await prisma.affiliate.findFirst({
    where: { userId, isActive: true },
    include: { wallet: true },
  });

  if (!affiliate || !affiliate.wallet) {
    return NextResponse.json({ ok: false, error: "No active affiliate account found." }, { status: 404 });
  }

  if (affiliate.wallet.availablePennies < 2500) {
    return NextResponse.json({ ok: false, error: "Minimum withdrawal is £25." }, { status: 400 });
  }

  const form = await req.formData();
  const accountName = String(form.get("accountName") || "").trim();
  const sortCode = String(form.get("sortCode") || "").trim();
  const accountNumber = String(form.get("accountNumber") || "").trim();

  if (!accountName || !sortCode || !accountNumber) {
    return NextResponse.json({ ok: false, error: "Bank details are required." }, { status: 400 });
  }

  const amountPennies = affiliate.wallet.availablePennies;

  // Create withdrawal request
  await prisma.$transaction([
    prisma.affiliatePayoutRequest.create({
      data: {
        affiliateId: affiliate.id,
        amountPennies,
        accountName,
        sortCode,
        accountNumber,
        status: "PENDING",
      },
    }),
    prisma.affiliateTransaction.create({
      data: {
        walletId: affiliate.wallet.id,
        affiliateId: affiliate.id,
        type: "WITHDRAWAL",
        status: "PENDING",
        amountPennies,
        note: "Withdrawal request submitted",
      },
    }),
    prisma.affiliateWallet.update({
      where: { id: affiliate.wallet.id },
      data: { availablePennies: 0 },
    }),
  ]);

  // Notify admin
  try {
    await sendEmail({
      to: "support@signallaboratories.co.uk",
      subject: `Withdrawal request — ${affiliate.code} — £${(amountPennies / 100).toFixed(2)}`,
      text: `Affiliate ${affiliate.name} (${affiliate.code}) has requested a withdrawal of £${(amountPennies / 100).toFixed(2)}.\n\nBank details:\nName: ${accountName}\nSort code: ${sortCode}\nAccount: ${accountNumber}\n\nReview in admin: https://signallaboratories.co.uk/admin/affiliate-payouts`,
    });
  } catch (e) {
    console.error("Failed to send withdrawal notification:", e);
  }

  return NextResponse.json({ ok: true });
}
