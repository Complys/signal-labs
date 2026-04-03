import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SETTLED = ["PAID", "PROCESSING", "SHIPPED"] as const;
const REFUNDED = ["REFUNDED"] as const;

function toInt(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
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
function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function dayName(dow: number) {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][dow] ?? "??";
}
function getDowMondayBased(date: Date) {
  const js = date.getDay(); // 0 Sun..6 Sat
  return (js + 6) % 7; // 0 Mon..6 Sun
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const range = clamp(toInt(searchParams.get("days"), 30), 1, 365);

  const end = startOfDay(new Date());
  const start = addDays(end, -range + 1);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start, lte: addDays(end, 1) },
      status: { in: [...SETTLED, ...REFUNDED] as any },
    },
    select: {
      id: true,
      createdAt: true,
      status: true,
      amountTotal: true,
      shippingChargedPennies: true,
      postageCostPennies: true,
      affiliateCommissionPennies: true,
      receiptEmail: true,
      userId: true,
      paymentMethod: true,
      items: {
        select: {
          productId: true,
          name: true,
          quantity: true,
          unitPrice: true,
          unitCostPennies: true,
        },
      },
    },
  });

  const expenses = await prisma.businessExpense.findMany({
    where: { incurredAt: { gte: start, lte: addDays(end, 1) } },
    select: { amountPennies: true, incurredAt: true, category: true },
  });

  const series: Array<any> = [];
  const idx = new Map<string, number>();

  for (let i = 0; i < range; i++) {
    const d = addDays(start, i);
    const key = ymd(d);
    idx.set(key, i);
    series.push({
      date: key,
      revenue: 0,
      refunds: 0,
      cogs: 0,
      postageCost: 0,
      affiliate: 0,
      expenses: 0,
      profit: 0,
      orders: 0,
    });
  }

  const productAgg = new Map<string, any>();
  const spenderAgg = new Map<string, any>();
  const peakHours = Array.from({ length: 24 }, () => 0);
  const peakDays = Array.from({ length: 7 }, () => 0);
  const paymentAgg = new Map<string, number>(); // method -> pennies

  for (const o of orders) {
    const k = ymd(o.createdAt);
    const i = idx.get(k);
    if (i === undefined) continue;

    peakHours[o.createdAt.getHours()] += 1;
    peakDays[getDowMondayBased(o.createdAt)] += 1;

    const isRefund = String(o.status).toUpperCase() === "REFUNDED";
    const total = toInt(o.amountTotal, 0);

    if (isRefund) {
      series[i].refunds += total;
      continue;
    }

    series[i].revenue += total;
    series[i].postageCost += toInt(o.postageCostPennies, 0);
    series[i].affiliate += toInt(o.affiliateCommissionPennies, 0);
    series[i].orders += 1;

    // payment method
    const pm = String(o.paymentMethod || "unknown").toLowerCase();
    paymentAgg.set(pm, (paymentAgg.get(pm) || 0) + total);

    // spenders
    const spenderKey = (o.receiptEmail || o.userId || "unknown").toLowerCase();
    const s = spenderAgg.get(spenderKey) || { key: spenderKey, revenue: 0, orders: 0 };
    s.revenue += total;
    s.orders += 1;
    spenderAgg.set(spenderKey, s);

    // items: cogs + product ranking
    let orderCogs = 0;
    for (const it of o.items || []) {
      const q = toInt(it.quantity, 0);
      const unitPrice = toInt(it.unitPrice, 0);
      const unitCost = it.unitCostPennies == null ? null : toInt(it.unitCostPennies, 0);

      const lineRevenue = unitPrice * q;
      const lineCogs = unitCost == null ? 0 : unitCost * q;
      orderCogs += lineCogs;

      const pid = it.productId || `unknown:${it.name}`;
      const p = productAgg.get(pid) || {
        productId: pid,
        name: it.name || "Item",
        qty: 0,
        revenue: 0,
        cogs: 0,
        profit: 0,
        orders: 0,
      };

      p.qty += q;
      p.revenue += lineRevenue;
      p.cogs += lineCogs;
      p.profit += lineRevenue - lineCogs;
      p.orders += 1;

      productAgg.set(pid, p);
    }

    series[i].cogs += orderCogs;
  }

  for (const e of expenses) {
    const k = ymd(new Date(e.incurredAt));
    const i = idx.get(k);
    if (i === undefined) continue;
    series[i].expenses += toInt(e.amountPennies, 0);
  }

  for (const d of series) {
    const netRevenue = d.revenue - d.refunds;
    d.profit = netRevenue - d.cogs - d.postageCost - d.affiliate - d.expenses;
  }

  const totals = series.reduce(
    (a: any, d: any) => {
      a.revenue += d.revenue;
      a.refunds += d.refunds;
      a.cogs += d.cogs;
      a.postageCost += d.postageCost;
      a.affiliate += d.affiliate;
      a.expenses += d.expenses;
      a.profit += d.profit;
      a.orders += d.orders;
      return a;
    },
    { revenue: 0, refunds: 0, cogs: 0, postageCost: 0, affiliate: 0, expenses: 0, profit: 0, orders: 0 }
  );

  const topPopular = Array.from(productAgg.values()).sort((a: any, b: any) => b.qty - a.qty).slice(0, 10);
  const topProfitable = Array.from(productAgg.values()).sort((a: any, b: any) => b.profit - a.profit).slice(0, 10);
  const biggestSpenders = Array.from(spenderAgg.values())
    .filter((x: any) => x.key !== "unknown")
    .sort((a: any, b: any) => b.revenue - a.revenue)
    .slice(0, 10);

  const paymentMethods = Array.from(paymentAgg.entries())
    .map(([method, amountPennies]) => ({ method, amountPennies }))
    .sort((a, b) => b.amountPennies - a.amountPennies);

  return NextResponse.json({
    ok: true,
    rangeDays: range,
    totals,
    series,
    topPopular,
    topProfitable,
    biggestSpenders,
    peakHours: peakHours.map((count, hour) => ({ hour, count })),
    peakDays: peakDays.map((count, i) => ({ day: dayName(i), count })),
    paymentMethods,
  });
}