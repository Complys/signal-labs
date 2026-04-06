export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function extractKeyword(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    // Google, Bing, DuckDuckGo etc
    const q = url.searchParams.get("q") || url.searchParams.get("query") || url.searchParams.get("p");
    if (q) return q;
    if (url.hostname.includes("google")) return "(google — keyword hidden)";
    if (url.hostname.includes("bing")) return "(bing — keyword hidden)";
  } catch {}
  return null;
}

function friendlyReferrer(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    return url.hostname.replace("www.", "");
  } catch {}
  return referrer.slice(0, 50);
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "FULFILMENT") return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get("days") ?? "14");
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const abandonedCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [pageViewsRaw, totalPageViews, abandonedRaw, allProducts] = await Promise.all([
    prisma.pageView.groupBy({
      by: ["path"],
      _count: { path: true },
      where: { createdAt: { gte: start } },
      orderBy: { _count: { path: "desc" } },
      take: 20,
    }),
    prisma.pageView.count({ where: { createdAt: { gte: start } } }),
    prisma.cartItem.findMany({
      where: { createdAt: { gte: abandonedCutoff } },
      include: { product: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.product.findMany({ select: { id: true, name: true } }),
  ]);

  // Build product ID -> name map
  const productMap: Record<string, string> = {};
  for (const p of allProducts) productMap[p.id] = p.name;

  // Resolve product names in paths
  const topPages = pageViewsRaw.map(p => {
    const productMatch = p.path.match(/^\/products\/(.+)$/);
    const productName = productMatch ? productMap[productMatch[1]] : null;
    return { path: p.path, count: p._count.path, productName };
  });

  // Get referrers and keywords
  const referrers = await prisma.pageView.groupBy({
    by: ["referrer"],
    _count: { referrer: true },
    where: { createdAt: { gte: start }, referrer: { not: null } },
    orderBy: { _count: { referrer: "desc" } },
    take: 20,
  });

  const topReferrers = referrers
    .filter(r => r.referrer)
    .map(r => ({
      referrer: friendlyReferrer(r.referrer),
      keyword: extractKeyword(r.referrer),
      count: r._count.referrer,
      raw: r.referrer,
    }))
    .filter(r => r.referrer && !r.referrer.includes("signallaboratories"));

  // Group abandoned by session
  const bySession: Record<string, typeof abandonedRaw> = {};
  for (const item of abandonedRaw) {
    if (!bySession[item.sessionId]) bySession[item.sessionId] = [];
    bySession[item.sessionId].push(item);
  }
  const abandonedSessions = Object.entries(bySession).map(([sid, items]) => ({
    sessionId: sid.slice(-8),
    items: items.map(i => ({ name: i.product.name, variantLabel: i.variantLabel, quantity: i.quantity, pricePennies: i.pricePennies })),
    total: items.reduce((s, i) => s + i.pricePennies * i.quantity, 0),
    date: items[0].createdAt,
  }));

  return NextResponse.json({ topPages, totalPageViews, topReferrers, abandonedSessions });
}
