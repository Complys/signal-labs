"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

function gbp(pennies: number) {
  return `£${(pennies / 100).toFixed(2)}`;
}

type Stats = {
  code: string;
  pendingPennies: number;
  availablePennies: number;
  totalEarnedPennies: number;
  clicks: number;
  orders: number;
  transactions: {
    id: string;
    type: string;
    status: string;
    amountPennies: number;
    orderRef: string | null;
    availableAt: string | null;
    createdAt: string;
    note: string | null;
  }[];
};

export default function AffiliateDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [leaderboard, setLeaderboard] = useState<{rank: number; code: string; name: string; totalPennies: number}[]>([]);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/affiliate/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    Promise.all([
      fetch("/api/affiliate/dashboard").then((r) => r.json()),
      fetch("/api/affiliate/leaderboard").then((r) => r.json()),
    ]).then(([d, l]) => {
      if (d.ok) setStats(d.stats);
      else setErr(d.error || "Failed to load dashboard.");
      if (l.ok && l.visible) {
        setLeaderboard(l.entries);
        setLeaderboardVisible(true);
      }
    }).catch(() => setErr("Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen bg-[#0B1220] text-white flex items-center justify-center">
        <p className="text-white/50 text-sm">Loading...</p>
      </main>
    );
  }

  if (err) {
    return (
      <main className="min-h-screen bg-[#0B1220] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-sm">{err}</p>
          <p className="mt-2 text-white/40 text-xs">
            If you are not yet approved, please wait for your application to be reviewed.
          </p>
        </div>
      </main>
    );
  }

  const referralUrl = stats ? `https://signallaboratories.co.uk/?ref=${stats.code}` : "";

  return (
    <main className="min-h-screen bg-[#0B1220] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <Image src="/signal-logo.png" alt="Signal Labs" width={140} height={36} className="h-8 w-auto" />
          <div className="flex items-center gap-4 text-sm">
            <span className="text-white/50">{(session?.user as any)?.email}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/affiliate/login" })}
              className="text-white/50 hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Affiliate Dashboard</h1>
        <p className="mt-1 text-sm text-white/50">
          Your code: <span className="font-mono text-yellow-400">{stats?.code}</span>
        </p>

        {/* Referral link */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm font-semibold text-white/80">Your referral link</div>
          <div className="mt-2 flex items-center gap-3">
            <code className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-yellow-400 font-mono break-all">
              {referralUrl}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(referralUrl)}
              className="shrink-0 rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5"
            >
              Copy
            </button>
          </div>
          <p className="mt-2 text-xs text-white/40">
            Share this link. You earn 10% commission on every new customer order placed through it.
          </p>
        </div>

        {/* Wallet */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/50 uppercase tracking-wide">Pending</div>
            <div className="mt-2 text-3xl font-bold text-white">
              {gbp(stats?.pendingPennies ?? 0)}
            </div>
            <div className="mt-1 text-xs text-white/40">Held for 30 days from order date</div>
          </div>

          <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-5">
            <div className="text-xs text-yellow-400/70 uppercase tracking-wide">Available</div>
            <div className="mt-2 text-3xl font-bold text-yellow-400">
              {gbp(stats?.availablePennies ?? 0)}
            </div>
            <div className="mt-1 text-xs text-white/40">Ready to withdraw (min £25)</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/50 uppercase tracking-wide">Total earned</div>
            <div className="mt-2 text-3xl font-bold text-white">
              {gbp(stats?.totalEarnedPennies ?? 0)}
            </div>
            <div className="mt-1 text-xs text-white/40">All time</div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/50 uppercase tracking-wide">Clicks</div>
            <div className="mt-2 text-2xl font-bold">{stats?.clicks ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/50 uppercase tracking-wide">Orders</div>
            <div className="mt-2 text-2xl font-bold">{stats?.orders ?? 0}</div>
          </div>
        </div>

        {/* Withdraw button */}
        {(stats?.availablePennies ?? 0) >= 2500 ? (
          <div className="mt-6">
            <Link
              href="/affiliate/withdraw"
              className="inline-block rounded-full bg-yellow-400 text-black px-6 py-3 text-sm font-semibold hover:opacity-95"
            >
              Request withdrawal
            </Link>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/50">
            You need at least £25 available to request a withdrawal.
          </div>
        )}

        {/* Transactions */}
        <div className="mt-10">
          <h2 className="text-lg font-semibold">Transaction history</h2>
          {!stats?.transactions?.length ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/50">
              No transactions yet. Share your referral link to start earning.
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10 bg-white/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs text-white/50 font-medium">Date</th>
                    <th className="px-4 py-3 text-left text-xs text-white/50 font-medium">Type</th>
                    <th className="px-4 py-3 text-left text-xs text-white/50 font-medium">Order</th>
                    <th className="px-4 py-3 text-left text-xs text-white/50 font-medium">Status</th>
                    <th className="px-4 py-3 text-right text-xs text-white/50 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.transactions.map((t) => (
                    <tr key={t.id} className="border-b border-white/5">
                      <td className="px-4 py-3 text-white/60">
                        {new Date(t.createdAt).toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-4 py-3 text-white/80 capitalize">{t.type.toLowerCase()}</td>
                      <td className="px-4 py-3 font-mono text-white/60">{t.orderRef ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          t.status === "AVAILABLE" ? "bg-yellow-400/20 text-yellow-400" :
                          t.status === "PAID" ? "bg-green-500/20 text-green-400" :
                          t.status === "REVERSED" ? "bg-red-500/20 text-red-400" :
                          "bg-white/10 text-white/50"
                        }`}>
                          {t.status.toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {t.type === "WITHDRAWAL" ? "-" : "+"}{gbp(t.amountPennies)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {leaderboardVisible && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold">Top affiliates</h2>
            <p className="mt-1 text-sm text-white/40">Commission earned all time.</p>
            <div className="mt-4 rounded-2xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10 bg-white/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs text-white/50 font-medium">Rank</th>
                    <th className="px-4 py-3 text-left text-xs text-white/50 font-medium">Code</th>
                    <th className="px-4 py-3 text-right text-xs text-white/50 font-medium">Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry) => (
                    <tr key={entry.rank} className={`border-b border-white/5 ${entry.code === stats?.code ? "bg-yellow-400/5" : ""}`}>
                      <td className="px-4 py-3 font-bold text-white/60">
                        {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
                      </td>
                      <td className="px-4 py-3 font-mono text-yellow-400">
                        {entry.code}
                        {entry.code === stats?.code && <span className="ml-2 text-xs text-white/40">(you)</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-white">
                        £{(entry.totalPennies / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-10 text-xs text-white/30">
          All products sold by Signal Labs are for laboratory and analytical research purposes only.
        </div>
      </div>
    </main>
  );
}
