import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const KEY = "multibuy_tiers";

export const DEFAULT_TIERS = [
  { spendPennies: 5000,  pct: 10 },
  { spendPennies: 15000, pct: 20 },
  { spendPennies: 50000, pct: 30 },
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  const tiers = row?.value ? JSON.parse(row.value) : DEFAULT_TIERS;
  return NextResponse.json({ tiers });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const tiers = Array.isArray(body.tiers) ? body.tiers : DEFAULT_TIERS;
  await prisma.siteSetting.upsert({
    where: { key: KEY },
    update: { value: JSON.stringify(tiers) },
    create: { key: KEY, value: JSON.stringify(tiers) },
  });
  return NextResponse.json({ ok: true, tiers });
}
