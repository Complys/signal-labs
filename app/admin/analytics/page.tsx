// app/admin/analytics/page.tsx
import Link from "next/link";
import AnalyticsExtra from "./AnalyticsExtra";
import { prisma } from "@/lib/prisma";
import AnalyticsCharts from "./AnalyticsCharts";
import RangePicker from "./RangePicker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function gbpFromPennies(p: number) {
  const safe = Number.isFinite(p) ? p : 0;
  return `£${(safe / 100).toFixed(2)}`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function safeInt(n: unknown) {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function clean(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * IMPORTANT:
 * - These are the statuses you treat as "revenue counts"
 * - (i.e., paid-like orders that should be included in revenue/profit)
 */
const PAID_LIKE_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "FULFILLED"] as const;

const RANGE_OPTIONS = new Set([7, 14, 28, 90, 180, 365]);

function parseDays(sp: Record<string, any>, key: string, fallback: number) {
  const raw =
    typeof sp?.[key] === "string"
      ? sp[key]
      : Array.isArray(sp?.[key])
      ? sp[key][0]
      : "";

  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  if (!RANGE_OPTIONS.has(n)) return fallback;
  return n;
}

/**
 * Produces a true N-day window (today inclusive), aligned to day boundaries:
 * - start = startOfDay(today - (days-1))
 * - end   = startOfDay(tomorrow)
 */
function windowForDays(days: number, todayStart: Date) {
  const start = addDays(todayStart, -(days - 1));
  const end = addDays(todayStart, 1); // tomorrow 00:00
  return { start, end };
}

type RevenueOrderRow = {
  createdAt: Date;
  amountTotal: number | null;
  shippingChargedPennies: number | null;
  items: { lineTotal: number | null }[];
};

async function getPaidLikeOrdersBetween(from: Date, to: Date): Promise<RevenueOrderRow[]> {
  return prisma.order.findMany({
    where: {
      createdAt: { gte: from, lt: to },
      status: { in: [...PAID_LIKE_STATUSES] as any },
    },
    select: {
      createdAt: true,
      amountTotal: true,
      shippingChargedPennies: true,
      items: { select: { lineTotal: true } },
    },
  });
}

function revenueFromOrder(o: {
  amountTotal: unknown;
  shippingChargedPennies: unknown;
  items?: any[];
}) {
  const amountTotal = safeInt(o.amountTotal);
  if (amountTotal > 0) return amountTotal;

  const itemsSum = Array.isArray(o.items)
    ? o.items.reduce((acc: number, it: any) => acc + safeInt(it?.lineTotal), 0)
    : 0;

  return itemsSum + safeInt(o.shippingChargedPennies);
}

async function getRevenuePenniesBetween(from: Date, to: Date) {
  const orders = await getPaidLikeOrdersBetween(from, to);
  let total = 0;
  for (const o of orders) total += revenueFromOrder(o);
  return total;
}

async function getDailySeries(days: number, todayStart: Date) {
  const { start, end } = windowForDays(days, todayStart);

  const orders = await getPaidLikeOrdersBetween(start, end);

  // init buckets
  const buckets = new Map<string, { day: string; revenuePennies: number; orders: number }>();
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const key = isoDay(d);
    buckets.set(key, { day: key, revenuePennies: 0, orders: 0 });
  }

  for (const o of orders) {
    const dayKey = isoDay(startOfDay(new Date(o.createdAt)));
    const b = buckets.get(dayKey);
    if (!b) continue;
    b.orders += 1;
    b.revenuePennies += revenueFromOrder(o);
  }

  return Array.from(buckets.values());
}

/** ---------------- Profit helpers ---------------- */

type ProfitSums = {
  revenue: number;
  cogs: number;
  postage: number;
  affiliate: number;
  fees: number; // 0 until you add a fee field
  grossProfit: number;
  netProfit: number;
};

async function getProfitSumsBetween(from: Date, to: Date): Promise<ProfitSums> {
  const rows = await prisma.order.findMany({
    where: {
      createdAt: { gte: from, lt: to },
      status: { in: [...PAID_LIKE_STATUSES] as any },
    },
    select: {
      amountTotal: true,
      shippingChargedPennies: true,
      items: { select: { lineTotal: true } },

      cogsPennies: true,
      postageCostPennies: true,
      affiliateCommissionPennies: true,
    },
  });

  let revenue = 0;
  let cogs = 0;
  let postage = 0;
  let affiliate = 0;
  const fees = 0;

  for (const o of rows as any[]) {
    revenue += revenueFromOrder(o);
    cogs += safeInt(o?.cogsPennies);
    postage += safeInt(o?.postageCostPennies);
    affiliate += safeInt(o?.affiliateCommissionPennies);
  }

  const grossProfit = revenue - cogs - postage;
  const netProfit = grossProfit - affiliate - fees;

  return { revenue, cogs, postage, affiliate, fees, grossProfit, netProfit };
}

/** ---------------- Affiliate helpers ---------------- */

async function getAffiliateRevenuePenniesBetween(from: Date, to: Date) {
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: from, lt: to },
      status: { in: [...PAID_LIKE_STATUSES] as any },
      affiliateId: { not: null },
    },
    select: {
      amountTotal: true,
      shippingChargedPennies: true,
      items: { select: { lineTotal: true } },
    },
  });

  let total = 0;
  for (const o of orders) total += revenueFromOrder(o);
  return total;
}

async function getAffiliateCommissionEarnedPenniesBetween(from: Date, to: Date) {
  const rows = await prisma.order.findMany({
    where: {
      createdAt: { gte: from, lt: to },
      status: { in: [...PAID_LIKE_STATUSES] as any },
      affiliateId: { not: null },
    },
    select: { affiliateCommissionPennies: true },
  });

  return rows.reduce((acc, r) => acc + safeInt(r.affiliateCommissionPennies), 0);
}

async function getAffiliatePayoutSumsBetween(from: Date, to: Date) {
  const [paid, pending] = await Promise.all([
    prisma.affiliatePayoutRequest.aggregate({
      where: { requestedAt: { gte: from, lt: to }, status: "PAID" },
      _sum: { amountPennies: true },
    }),
    prisma.affiliatePayoutRequest.aggregate({
      where: { requestedAt: { gte: from, lt: to }, status: "PENDING" },
      _sum: { amountPennies: true },
    }),
  ]);

  return {
    paidPennies: safeInt(paid._sum.amountPennies),
    pendingPennies: safeInt(pending._sum.amountPennies),
  };
}

type TopAffiliateRow = {
  affiliateId: string;
  code: string;
  name: string;
  orders: number;
  revenuePennies: number;
  commissionPennies: number;
  paidOutPennies: number;
  owedPennies: number;
};

async function getTopAffiliatesBetween(from: Date, to: Date): Promise<TopAffiliateRow[]> {
  const grouped = await prisma.order.groupBy({
    by: ["affiliateId", "affiliateCode"],
    where: {
      createdAt: { gte: from, lt: to },
      status: { in: [...PAID_LIKE_STATUSES] as any },
      affiliateId: { not: null },
      affiliateCode: { not: null },
    },
    _count: { _all: true },
    _sum: {
      amountTotal: true,
      affiliateCommissionPennies: true,
    },
    orderBy: { _sum: { amountTotal: "desc" } },
    take: 10,
  });

  const ids = grouped.map((g) => String(g.affiliateId)).filter(Boolean);

  const affs = await prisma.affiliate.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, code: true },
  });

  const nameById = new Map(affs.map((a) => [a.id, a.name ?? "(Unknown)"]));
  const codeById = new Map(affs.map((a) => [a.id, a.code ?? ""]));

  const payoutsGrouped = await prisma.affiliatePayoutRequest.groupBy({
    by: ["affiliateId"],
    where: { requestedAt: { gte: from, lt: to }, status: "PAID" },
    _sum: { amountPennies: true },
  });

  const paidById = new Map(
    payoutsGrouped.map((p) => [String(p.affiliateId), safeInt(p._sum.amountPennies)])
  );

  return grouped.map((g) => {
    const affiliateId = String(g.affiliateId);
    const code =
      (g.affiliateCode ? String(g.affiliateCode) : "") ||
      (codeById.get(affiliateId) ?? "");

    const name = nameById.get(affiliateId) ?? "(Unknown)";

    const revenuePennies = safeInt(g._sum.amountTotal);
    const commissionPennies = safeInt(g._sum.affiliateCommissionPennies);
    const paidOutPennies = paidById.get(affiliateId) ?? 0;
    const owedPennies = Math.max(0, commissionPennies - paidOutPennies);

    return {
      affiliateId,
      code,
      name,
      orders: safeInt(g._count._all),
      revenuePennies,
      commissionPennies,
      paidOutPennies,
      owedPennies,
    };
  });
}

/** ---------------- Page ---------------- */

export default async function AdminAnalyticsPage(props: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const sp = (await Promise.resolve(props.searchParams ?? {})) as Record<string, any>;

  const days = parseDays(sp, "days", 14);

  const revDays = parseDays(sp, "revDays", days);
  const ordersDays = parseDays(sp, "ordersDays", days);
  const topDays = parseDays(sp, "topDays", days);
  const emailDays = parseDays(sp, "emailDays", days);
  const tableDays = parseDays(sp, "tableDays", days);
  const affDays = parseDays(sp, "affDays", days);
  const profitDays = parseDays(sp, "profitDays", days);

  const now = new Date();
  const todayStart = startOfDay(now);

  const range = windowForDays(days, todayStart);
  const topRange = windowForDays(topDays, todayStart);
  const emailRange = windowForDays(emailDays, todayStart);
  const tableRange = windowForDays(tableDays, todayStart);
  const affRange = windowForDays(affDays, todayStart);
  const profitRange = windowForDays(profitDays, todayStart);

  const [
    ordersTotal,
    pendingCount,
    paidCount,
    processingCount,
    shippedCount,
    cancelledCount,
    refundedCount,
    failedCount,

    revenueRange,
    ordersRange,

    revDaily,
    ordersDaily,

    topProductsRange,
    emailSentRange,
    emailFailedRange,
    emailSkippedRange,

    tableDaily,

    affiliateRevenueRange,
    affiliateCommissionEarnedRange,
    affiliatePayoutSumsRange,
    topAffiliatesRange,

    profitSums,
  ] = await Promise.all([
    prisma.order.count(),

    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: "PAID" } }),
    prisma.order.count({ where: { status: "PROCESSING" } }),
    prisma.order.count({ where: { status: "SHIPPED" } }),
    prisma.order.count({ where: { status: "CANCELLED" } }),
    prisma.order.count({ where: { status: "REFUNDED" } }),
    prisma.order.count({ where: { status: "FAILED" } }),

    // Revenue is paid-like
    getRevenuePenniesBetween(range.start, range.end),

    // Orders card = created in range (all statuses) - consistent with your label "Created in range"
    prisma.order.count({ where: { createdAt: { gte: range.start, lt: range.end } } }),

    getDailySeries(revDays, todayStart),
    getDailySeries(ordersDays, todayStart),

    // Top products: safest is to only consider paid-like orders so charts match revenue reality
    prisma.orderItem
      .groupBy({
        by: ["productId", "name"],
        where: {
          order: {
            createdAt: { gte: topRange.start, lt: topRange.end },
            status: { in: [...PAID_LIKE_STATUSES] as any },
          },
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 8,
      })
      .then((rows) =>
        rows.map((r, idx) => {
          const rawName = clean(r.name) || "Unnamed product";
          const safeName = rawName.length > 26 ? rawName.slice(0, 26) + "…" : rawName;
          return { name: safeName, qty: r._sum.quantity ?? 0, _i: idx };
        })
      )
      // ensure stable, unique-ish names for chart keys if your chart uses `name` as key
      .then((rows) => {
        const seen = new Map<string, number>();
        return rows.map((r) => {
          const n = seen.get(r.name) ?? 0;
          seen.set(r.name, n + 1);
          return n === 0 ? { name: r.name, qty: r.qty } : { name: `${r.name} (${n + 1})`, qty: r.qty };
        });
      }),

    prisma.emailEvent.count({ where: { createdAt: { gte: emailRange.start, lt: emailRange.end }, status: "SENT" } }),
    prisma.emailEvent.count({ where: { createdAt: { gte: emailRange.start, lt: emailRange.end }, status: "FAILED" } }),
    prisma.emailEvent.count({ where: { createdAt: { gte: emailRange.start, lt: emailRange.end }, status: "SKIPPED" } }),

    getDailySeries(tableDays, todayStart),

    getAffiliateRevenuePenniesBetween(affRange.start, affRange.end),
    getAffiliateCommissionEarnedPenniesBetween(affRange.start, affRange.end),
    getAffiliatePayoutSumsBetween(affRange.start, affRange.end),
    getTopAffiliatesBetween(affRange.start, affRange.end),

    getProfitSumsBetween(profitRange.start, profitRange.end),
  ]);

  const aovPennies = ordersRange > 0 ? Math.round(revenueRange / ordersRange) : 0;

  const statusCounts = {
    PENDING: pendingCount,
    PAID: paidCount,
    PROCESSING: processingCount,
    SHIPPED: shippedCount,
    CANCELLED: cancelledCount,
    REFUNDED: refundedCount,
    FAILED: failedCount,
  };

  const affiliatePaidOutPennies = affiliatePayoutSumsRange.paidPennies;
  const affiliatePendingPayoutPennies = affiliatePayoutSumsRange.pendingPennies;
  const affiliateOwedPennies = Math.max(0, affiliateCommissionEarnedRange - affiliatePaidOutPennies);

  return (
    <div className="p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Analytics</h1>
          <p className="text-sm text-white/60">Orders, revenue, profit & operational health</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
          <RangePicker
            valueDays={days}
            paramKey="days"
            label="Range"
            resetKeys={["revDays", "ordersDays", "topDays", "emailDays", "tableDays", "affDays", "profitDays"]}
          />

          <div className="flex gap-2">
            <Link href="/admin/orders" className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15">
              View orders
            </Link>
            <Link href="/admin/products" className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15">
              View products
            </Link>
            <Link href="/admin/profit" className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15">
              Profit
            </Link>
          </div>
        </div>
      </div>

      {/* KPI strip (GLOBAL days) */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title={`Revenue (${days}d)`} value={gbpFromPennies(revenueRange)} sub={`${ordersRange} orders`} />
        <Card title={`Orders (${days}d)`} value={`${ordersRange}`} sub="Created in range" />
        <Card title={`AOV (${days}d)`} value={gbpFromPennies(aovPennies)} sub="Avg order value" />
        <Card title="Pending" value={`${pendingCount}`} sub="Need payment / review" />
      </div>

      {/* Profit summary (independent) */}
      <div className="mt-6 rounded-2xl bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-black">Profit summary ({profitDays}d)</div>
            <div className="text-xs text-black/60">
              Uses order snapshots (COGS, postage, affiliate commission). Fees are 0 until you add a fees field.
            </div>
          </div>
          <RangePicker valueDays={profitDays} paramKey="profitDays" label="Range" compact />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <MiniCard title="Revenue" value={gbpFromPennies(profitSums.revenue)} sub="Paid-like orders" />
          <MiniCard title="COGS" value={gbpFromPennies(profitSums.cogs)} sub="Product cost" />
          <MiniCard title="Postage cost" value={gbpFromPennies(profitSums.postage)} sub="Your shipping cost" />
          <MiniCard title="Gross profit" value={gbpFromPennies(profitSums.grossProfit)} sub="Rev − COGS − postage" />
          <MiniCard title="Affiliate" value={gbpFromPennies(profitSums.affiliate)} sub="Commission" />
          <MiniCard title="Net profit" value={gbpFromPennies(profitSums.netProfit)} sub="Gross − affiliate" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/admin/profit" className="rounded-full bg-black/10 px-4 py-2 text-sm text-black hover:bg-black/15">
            Open profit dashboard →
          </Link>
        </div>
      </div>

      {/* Charts */}
      <AnalyticsCharts
        revDaily={revDaily}
        ordersDaily={ordersDaily}
        revDays={revDays}
        ordersDays={ordersDays}
        statusCounts={statusCounts}
        topProducts={topProductsRange}
        topDays={topDays}
        globalDays={days}
      />

      {/* Affiliate Analytics */}
      <div className="mt-6 rounded-2xl bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-black">Affiliate performance ({affDays}d)</div>
            <div className="text-xs text-black/60">Revenue + commission + payout tracking</div>
          </div>
          <div className="flex items-center gap-2">
            <RangePicker valueDays={affDays} paramKey="affDays" label="Range" compact />
            <Link href="/admin/affiliates" className="rounded-full bg-black/10 px-4 py-2 text-sm text-black hover:bg-black/15">
              Manage affiliates
            </Link>
            <Link
              href="/admin/affiliate-payouts"
              className="rounded-full bg-black/10 px-4 py-2 text-sm text-black hover:bg-black/15"
            >
              Payouts
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MiniCard title="Affiliate revenue" value={gbpFromPennies(affiliateRevenueRange)} sub="Paid-like orders" />
          <MiniCard title="Commission earned" value={gbpFromPennies(affiliateCommissionEarnedRange)} sub="From orders" />
          <MiniCard title="Paid out" value={gbpFromPennies(affiliatePaidOutPennies)} sub="Payouts marked PAID" />
          <MiniCard title="Pending requests" value={gbpFromPennies(affiliatePendingPayoutPennies)} sub="Awaiting approval" />
          <MiniCard title="Estimated owed" value={gbpFromPennies(affiliateOwedPennies)} sub="Earned − paid" />
        </div>

        <div className="mt-6 overflow-x-auto">
          <div className="text-sm font-medium text-black">Top affiliates ({affDays}d)</div>
          <div className="text-xs text-black/60">Sorted by revenue (paid-like orders)</div>

          <table className="mt-3 w-full min-w-[860px] text-left text-sm">
            <thead className="text-black/60">
              <tr>
                <th className="py-2 pr-4">Code</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Orders</th>
                <th className="py-2 pr-4">Revenue</th>
                <th className="py-2 pr-4">Commission</th>
                <th className="py-2 pr-4">Paid out</th>
                <th className="py-2 pr-4">Owed</th>
              </tr>
            </thead>
            <tbody>
              {topAffiliatesRange.length === 0 ? (
                <tr className="border-t border-black/10">
                  <td className="py-3 pr-4 text-black" colSpan={7}>
                    No affiliate orders in this range yet.
                  </td>
                </tr>
              ) : (
                topAffiliatesRange.map((r) => (
                  <tr key={r.affiliateId} className="border-t border-black/10">
                    <td className="py-2 pr-4 font-medium text-black">{r.code || "—"}</td>
                    <td className="py-2 pr-4 text-black">{r.name}</td>
                    <td className="py-2 pr-4 text-black">{r.orders}</td>
                    <td className="py-2 pr-4 text-black">{gbpFromPennies(r.revenuePennies)}</td>
                    <td className="py-2 pr-4 text-black">{gbpFromPennies(r.commissionPennies)}</td>
                    <td className="py-2 pr-4 text-black">{gbpFromPennies(r.paidOutPennies)}</td>
                    <td className="py-2 pr-4 text-black">{gbpFromPennies(r.owedPennies)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email health */}
      <div className="mt-6 rounded-2xl bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-black">Email health ({emailDays}d)</div>
            <div className="text-xs text-black/60">SendGrid / idempotency results</div>
          </div>
          <RangePicker valueDays={emailDays} paramKey="emailDays" label="Range" compact />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <MiniStat label="SENT" value={emailSentRange} />
          <MiniStat label="FAILED" value={emailFailedRange} />
          <MiniStat label="SKIPPED" value={emailSkippedRange} />
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 rounded-2xl bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-black">Last {tableDays} days</div>
            <div className="text-xs text-black/60">Orders + revenue per day</div>
          </div>
          <RangePicker valueDays={tableDays} paramKey="tableDays" label="Range" compact />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-black/60">
              <tr>
                <th className="py-2 pr-4">Day</th>
                <th className="py-2 pr-4">Orders</th>
                <th className="py-2 pr-4">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {tableDaily.map((d) => (
                <tr key={d.day} className="border-t border-black/10">
                  <td className="py-2 pr-4 font-medium text-black">{d.day}</td>
                  <td className="py-2 pr-4 text-black">{d.orders}</td>
                  <td className="py-2 pr-4 text-black">{gbpFromPennies(d.revenuePennies)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 text-xs text-white/40">Total orders (all time): {ordersTotal}</div>

        <AnalyticsExtra days={days} />
    </div>
  );
}

function Card({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-5">
      <div>
        <div className="text-sm font-medium text-black">{title}</div>
        {sub ? <div className="text-xs text-black/60">{sub}</div> : null}
      </div>
      <div className="mt-3 text-3xl font-semibold text-black">{value}</div>
    </div>
  );
}

function MiniCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-black/5 p-4">
      <div>
        <div className="text-xs font-medium text-black/70">{title}</div>
        {sub ? <div className="text-[11px] text-black/50">{sub}</div> : null}
      </div>
      <div className="mt-2 text-xl font-semibold text-black">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  // Page views
  const topPages = await prisma.pageView.groupBy({
    by: ['path'],
    _count: { path: true },
    where: { createdAt: { gte: range.start, lt: range.end } },
    orderBy: { _count: { path: 'desc' } },
    take: 20,
  });
  const totalPageViews = await prisma.pageView.count({
    where: { createdAt: { gte: range.start, lt: range.end } },
  });
  const uniquePaths = await prisma.pageView.findMany({
    where: { createdAt: { gte: range.start, lt: range.end } },
    select: { path: true },
    distinct: ['path'],
  });

  // Abandoned baskets — cart items not converted to orders in last 7 days
  const abandonedCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const abandonedItems = await prisma.cartItem.findMany({
    where: { createdAt: { gte: abandonedCutoff } },
    include: { product: { select: { name: true, price: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  // Group by session
  const abandonedBySessions = abandonedItems.reduce((acc: Record<string, any[]>, item) => {
    if (!acc[item.sessionId]) acc[item.sessionId] = [];
    acc[item.sessionId].push(item);
    return acc;
  }, {});
  const abandonedSessions = Object.entries(abandonedBySessions).map(([sid, items]) => ({
    sessionId: sid.slice(-8),
    items,
    total: (items as any[]).reduce((s: number, i: any) => s + i.pricePennies * i.quantity, 0),
    date: (items as any[])[0].createdAt,
  }));

  return (
    <div className="rounded-xl bg-black/5 p-3">
      <div className="text-xs font-medium text-black/60">{label}</div>
      <div className="mt-1 text-xl font-semibold text-black">{value}</div>
    </div>
  );

        {/* PAGE VIEWS SECTION */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Page views</h2>
          <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginBottom: 16 }}>
            {totalPageViews} total views · {uniquePaths.length} unique pages in selected range
          </p>
          <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#fafafa' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: 'rgba(0,0,0,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Page</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', color: 'rgba(0,0,0,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Views</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', color: 'rgba(0,0,0,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {topPages.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: 'rgba(0,0,0,0.3)', fontSize: 13 }}>No page view data yet — tracking starts automatically once deployed</td></tr>
                )}
                {topPages.map((p, i) => (
                  <tr key={p.path} style={{ borderBottom: i < topPages.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, background: 'rgba(0,0,0,0.04)', padding: '2px 6px', borderRadius: 4 }}>{p.path}</span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>{p._count.path}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: 'rgba(0,0,0,0.4)' }}>
                      {totalPageViews > 0 ? Math.round(p._count.path / totalPageViews * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ABANDONED BASKETS SECTION */}
        <section style={{ marginTop: 40, marginBottom: 40 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Abandoned baskets</h2>
          <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginBottom: 16 }}>
            Items added to cart in the last 7 days that haven&apos;t converted to orders. {abandonedSessions.length} sessions.
          </p>
          {abandonedSessions.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 24, textAlign: 'center', color: 'rgba(0,0,0,0.3)', fontSize: 13 }}>
              No abandoned baskets yet — tracking will show here once customers add items to cart
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {abandonedSessions.map((session) => (
                <div key={session.sessionId} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', fontFamily: 'monospace' }}>Session ...{session.sessionId}</span>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>{new Date(session.date).toLocaleDateString('en-GB')} {new Date(session.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#0B1220' }}>£{(session.total / 100).toFixed(2)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(session.items as any[]).map((item: any, i: number) => (
                      <span key={i} style={{ fontSize: 12, background: 'rgba(0,0,0,0.04)', padding: '3px 10px', borderRadius: 20, color: 'rgba(0,0,0,0.7)' }}>
                        {item.product.name}{item.variantLabel ? ` (${item.variantLabel})` : ''} × {item.quantity}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
}