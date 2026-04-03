import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

const DEFAULT_TIERS = [
  { spendPennies: 5000,  pct: 5  },
  { spendPennies: 10000, pct: 10 },
  { spendPennies: 15000, pct: 15 },
];

export async function GET() {
  const row = await prisma.siteSetting.findUnique({ where: { key: "multibuy_tiers" } });
  const tiers = row?.value ? JSON.parse(row.value) : DEFAULT_TIERS;
  return NextResponse.json({ tiers });
}
