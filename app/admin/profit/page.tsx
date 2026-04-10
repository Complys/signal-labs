import Link from "next/link";
import { prisma } from "@/lib/prisma";
import RangePicker from "../analytics/RangePicker";

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

async function getRevenuePenniesBetween(from: Date, to: Date) {
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: from, lt: to },
      status: { in: [...PAID_LIKE_STATUSES] as any },
    },
    select: {
      amountTotal: true,
      shippingChargedPennies: true,
      items: { select: { lineTotal: true } },
    },
  });

  let total = 0;
  for (const o of orders) {
    const amountTotal = safeInt(o.amountTotal);

    if (amountTotal > 0) {
      total += amountTotal;
      continue;
    }

    const itemsSum = Array.isArray(o.items)
      ? o.items.reduce((acc, it) => acc + safeInt(it.lineTotal), 0)
      : 0;

    total += itemsSum + safeInt(o.shippingChargedPennies);
  }

  return total;
}

async function getProfitSumsBetween(from: Date, to: Date) {
  const rows = await prisma.order.findMany({
    where: {
      createdAt: { gte: from, lt: to },
      status: { in: [...PAID_LIKE_STATUSES] as any },
    },
    select: {
      amountTotal: true,
      shippingChargedPennies: true,
      cogsPennies: true,
      postageCostPennies: true,
      affiliateCommissionPennies: true,
      items: { select: { lineTotal: true } },
    },
  });

  let revenue = 0;
  let cogs = 0;
  let postage = 0;
  let affiliate = 0;
  let fees = 0;

  for (const o of rows) {
    const amountTotal = safeInt(o.amountTotal);
    if (amountTotal > 0) {
      revenue += amountTotal;
    } else {
      const itemsSum = Array.isArray(o.items)
        ? o.items.reduce((acc: number, it: any) => acc + safeInt(it.lineTotal), 0)
        : 0;
      revenue += itemsSum + safeInt(o.shippingChargedPennies);
    }

    cogs += safeInt(o.cogsPennies);
    postage += safeInt(o.postageCostPennies);
    affiliate += safeInt(o.affiliateCommissionPennies);
    // Stripe fee: 1.4% + 20p for UK cards (approximation)
    const orderRevenue = safeInt(o.amountTotal) > 0
      ? safeInt(o.amountTotal)
      : (Array.isArray(o.items) ? o.items.reduce((acc: number, it: any) => acc + safeInt(it.lineTotal), 0) : 0)
        + safeInt(o.shippingChargedPennies);
    fees += Math.round(orderRevenue * 0.014) + 20;
  }

  const grossProfit = revenue - cogs - postage;
  const netProfit = grossProfit - affiliate - fees;

  return { revenue, cogs, postage, affiliate, fees, grossProfit, netProfit };
}

async function getDailyProfitSeries(days: number, today: Date) {
  const buckets = Array.from({ length: days }).map((_, i) => {
    const from = addDays(today, -(days - 1 - i));
    const to = addDays(from, 1);
    return { from, to, label: isoDay(from) };
  });

  const rows: {
    day: string;
    revenuePennies: number;
    cogsPennies: number;
    postageCostPennies: number;
    affiliateCommissionPennies: number;
    paymentFeePennies: number;
    grossProfitPennies: number;
    netProfitPennies: number;
    orders: number;
  }[] = [];

  for (const b of buckets) {
    const [rev, sums, count] = await Promise.all([
      getRevenuePenniesBetween(b.from, b.to),
      getProfitSumsBetween(b.from, b.to),
      prisma.order.count({
        where: { createdAt: { gte: b.from, lt: b.to }, status: { in: [...PAID_LIKE_STATUSES] as any } },
      }),
    ]);

    // sums.revenue should match rev (but keep both safe)
    const revenue = rev || sums.revenue;

    rows.push({
      day: b.label,
      revenuePennies: revenue,
      cogsPennies: sums.cogs,
      postageCostPennies: sums.postage,
      affiliateCommissionPennies: sums.affiliate,
      paymentFeePennies: sums.fees,
      grossProfitPennies: sums.grossProfit,
      netProfitPennies: sums.netProfit,
      orders: count,
    });
  }

  return rows;
}

export default async function AdminProfitPage(props: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const sp = (await Promise.resolve(props.searchParams ?? {})) as Record<string, any>;
  const days = parseDays(sp, "days", 28);

  const now = new Date();
  const today = startOfDay(now);
  const from = addDays(today, -days);

  const [sums, daily] = await Promise.all([
    getProfitSumsBetween(from, now),
    getDailyProfitSeries(days, today),
  ]);

  return (
    <div className="p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Profit</h1>
          <p className="text-sm text-white/60">COGS, postage, commissions & net profit</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
          <RangePicker valueDays={days} paramKey="days" label="Range" />
          <div className="flex gap-2">
            <Link
              href="/admin/analytics"
              className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
            >
              Back to analytics
            </Link>
            <Link
              href="/admin/orders"
              className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
            >
              View orders
            </Link>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Card title="Revenue" value={gbpFromPennies(sums.revenue)} sub={`Paid-like in ${days}d`} />
        <Card title="COGS" value={gbpFromPennies(sums.cogs)} sub="Product costs" />
        <Card title="Postage cost" value={gbpFromPennies(sums.postage)} sub="Your shipping cost" />
        <Card title="Gross profit" value={gbpFromPennies(sums.grossProfit)} sub="Rev − COGS − postage" />
        <Card title="Affiliate" value={gbpFromPennies(sums.affiliate)} sub="Commission" />
        <Card title="Net profit" value={gbpFromPennies(sums.netProfit)} sub="Gross − affiliate − fees" />
      </div>

      {/* Daily table (profit per day) */}
      <div className="mt-6 rounded-2xl bg-white p-5">
        <div className="text-sm font-medium text-black">Daily profit (last {days} days)</div>
        <div className="text-xs text-black/60">
          This is the foundation for monthly profit later (we can add month bucketing next).
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-black/60">
              <tr>
                <th className="py-2 pr-4">Day</th>
                <th className="py-2 pr-4">Orders</th>
                <th className="py-2 pr-4">Revenue</th>
                <th className="py-2 pr-4">COGS</th>
                <th className="py-2 pr-4">Postage</th>
                <th className="py-2 pr-4">Affiliate</th>
                <th className="py-2 pr-4">Fees</th>
                <th className="py-2 pr-4">Gross</th>
                <th className="py-2 pr-4">Net</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.day} className="border-t border-black/10">
                  <td className="py-2 pr-4 font-medium text-black">{d.day}</td>
                  <td className="py-2 pr-4 text-black">{d.orders}</td>
                  <td className="py-2 pr-4 text-black">{gbpFromPennies(d.revenuePennies)}</td>
                  <td className="py-2 pr-4 text-black">{gbpFromPennies(d.cogsPennies)}</td>
                  <td className="py-2 pr-4 text-black">{gbpFromPennies(d.postageCostPennies)}</td>
                  <td className="py-2 pr-4 text-black">{gbpFromPennies(d.affiliateCommissionPennies)}</td>
                  <td className="py-2 pr-4 text-black">{gbpFromPennies(d.paymentFeePennies)}</td>
                  <td className="py-2 pr-4 text-black">{gbpFromPennies(d.grossProfitPennies)}</td>
                  <td className="py-2 pr-4 font-semibold text-black">{gbpFromPennies(d.netProfitPennies)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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