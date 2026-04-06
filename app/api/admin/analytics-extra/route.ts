export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "FULFILMENT") return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get("days") ?? "14");
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const abandonedCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [topPages, totalPageViews, abandonedRaw] = await Promise.all([
    prisma.pageView.groupBy({ by: ["path"], _count: { path: true }, where: { createdAt: { gte: start } }, orderBy: { _count: { path: "desc" } }, take: 20 }),
    prisma.pageView.count({ where: { createdAt: { gte: start } } }),
    prisma.cartItem.findMany({ where: { createdAt: { gte: abandonedCutoff } }, include: { product: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const bySession: Record<string, typeof abandonedRaw> = {};
  for (const item of abandonedRaw) { if (!bySession[item.sessionId]) bySession[item.sessionId] = []; bySession[item.sessionId].push(item); }
  const abandonedSessions = Object.entries(bySession).map(([sid, items]) => ({
    sessionId: sid.slice(-8), items: items.map(i => ({ name: i.product.name, variantLabel: i.variantLabel, quantity: i.quantity, pricePennies: i.pricePennies })),
    total: items.reduce((s, i) => s + i.pricePennies * i.quantity, 0), date: items[0].createdAt,
  }));
  return NextResponse.json({ topPages, totalPageViews, abandonedSessions });
}
