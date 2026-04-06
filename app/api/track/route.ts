export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { path } = await req.json().catch(() => ({}));
    if (!path || typeof path !== "string") return NextResponse.json({ ok: false });

    // Skip admin paths
    if (path.startsWith("/admin")) return NextResponse.json({ ok: true, skipped: true });

    const referrer = req.headers.get("referer") ?? undefined;
    const country = req.headers.get("x-vercel-ip-country") ?? undefined;

    await prisma.pageView.create({
      data: { path: path.slice(0, 200), referrer: referrer?.slice(0, 500), country },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
