import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

const DEFAULT_TIERS = [
  { spendPennies: 5000,  pct: 10 },
  { spendPennies: 15000, pct: 20 },
  { spendPennies: 50000, pct: 30 },
];

export async function GET() {
  const row = await prisma.siteSetting.findUnique({ where: { key: "multibuy_tiers" } });
  const tiers = row?.value ? JSON.parse(row.value) : DEFAULT_TIERS;
  return NextResponse.json({ tiers });
}
