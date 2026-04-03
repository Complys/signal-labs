import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function requireAdmin() {
  const session = await getServerSession(authOptions as any) as any;
  if (!session || (session.user as any)?.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  const ok = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = ["promo_enabled", "promo_headline", "promo_code"];
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: keys } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return NextResponse.json({
    promo_enabled: map.promo_enabled ?? "true",
    promo_headline: map.promo_headline ?? "Get 10% off your first order",
    promo_code: map.promo_code ?? "WELCOME10",
  });
}

export async function POST(req: Request) {
  const ok = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const enabled = (body?.promo_enabled ?? "true").toString();
  const headline = (body?.promo_headline ?? "").toString();
  const code = (body?.promo_code ?? "").toString().toUpperCase();

  await prisma.siteSetting.upsert({
    where: { key: "promo_enabled" },
    update: { value: enabled },
    create: { key: "promo_enabled", value: enabled },
  });
  await prisma.siteSetting.upsert({
    where: { key: "promo_headline" },
    update: { value: headline },
    create: { key: "promo_headline", value: headline },
  });
  await prisma.siteSetting.upsert({
    where: { key: "promo_code" },
    update: { value: code },
    create: { key: "promo_code", value: code },
  });

  return NextResponse.json({ ok: true });
}
