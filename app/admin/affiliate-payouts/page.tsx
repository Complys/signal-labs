import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function gbp(pennies: number) {
  return `£${(pennies / 100).toFixed(2)}`;
}

async function markAsPaid(id: string) {
  "use server";

  const payout = await prisma.affiliatePayoutRequest.findUnique({
    where: { id },
    include: { affiliate: { include: { wallet: true } } },
  });

  if (!payout || payout.status !== "PENDING") return;

  await prisma.$transaction([
    prisma.affiliatePayoutRequest.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date() },
    }),
    prisma.affiliateTransaction.updateMany({
      where: {
        affiliateId: payout.affiliateId,
        type: "WITHDRAWAL",
        status: "PENDING",
      },
      data: { status: "PAID" },
    }),
  ]);

  revalidatePath("/admin/affiliate-payouts");
}

export default async function AffiliatePayoutsPage() {
  const payouts = await prisma.affiliatePayoutRequest.findMany({
    orderBy: { requestedAt: "desc" },
    take: 100,
    include: {
      affiliate: { select: { code: true, name: true, email: true } },
    },
  });

  const pending = payouts.filter((p) => p.status === "PENDING");
  const paid = payouts.filter((p) => p.status === "PAID");

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Affiliate Payouts</h1>
      <p className="mt-1 text-sm text-white/50">
        {pending.length} pending, {paid.length} paid
      </p>

      {pending.length === 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/50">
          No pending withdrawal requests.
        </div>
      )}

      {pending.length > 0 && (
        <div className="mt-6 grid gap-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Pending withdrawals</h2>
          {pending.map((p) => (
            <div key={p.id} className="rounded-2xl border border-yellow-400/20 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-base font-semibold text-white">{p.affiliate.name}</div>
                  <div className="text-sm text-white/60">{p.affiliate.email}</div>
                  <div className="mt-1 font-mono text-xs text-yellow-400">{p.affiliate.code}</div>
                  <div className="mt-2 text-2xl font-bold text-yellow-400">{gbp(p.amountPennies)}</div>
                  <div className="mt-1 text-xs text-white/40">Requested {formatDate(p.requestedAt)}</div>
                </div>
                <form action={markAsPaid.bind(null, p.id)}>
                  <button
                    type="submit"
                    className="rounded-full bg-yellow-400 text-black px-5 py-2.5 text-sm font-semibold hover:opacity-90"
                  >
                    Mark as paid
                  </button>
                </form>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 grid gap-1 text-sm">
                <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Bank details</div>
                <div className="text-white/80">Name: <span className="font-medium">{p.accountName}</span></div>
                <div className="text-white/80">Sort code: <span className="font-mono">{p.sortCode}</span></div>
                <div className="text-white/80">Account: <span className="font-mono">{p.accountNumber}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {paid.length > 0 && (
        <div className="mt-10 grid gap-3">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Paid</h2>
          {paid.map((p) => (
            <div key={p.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-4">
              <div>
                <span className="text-sm font-medium text-white">{p.affiliate.name}</span>
                <span className="ml-2 text-sm text-white/40">{formatDate(p.requestedAt)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-white">{gbp(p.amountPennies)}</span>
                <span className="rounded-full bg-green-500/20 text-green-400 px-3 py-1 text-xs font-semibold">paid</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
