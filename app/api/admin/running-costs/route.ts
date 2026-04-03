import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeInt(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.runningCost.findMany({
    orderBy: { incurredAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const name = safeStr(body?.name);
  const category = safeStr(body?.category) || null;
  const notes = safeStr(body?.notes) || null;

  // accept either amountPennies, or amountGbp as string/number
  const amountPennies =
    safeInt(body?.amountPennies) ||
    Math.round(Number(body?.amountGbp ?? 0) * 100);

  const incurredAtRaw = safeStr(body?.incurredAt); // YYYY-MM-DD
  const incurredAt =
    incurredAtRaw ? new Date(`${incurredAtRaw}T12:00:00.000Z`) : new Date();

  if (!name) return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
  if (!Number.isFinite(amountPennies) || amountPennies <= 0)
    return NextResponse.json({ ok: false, error: "Amount must be > 0" }, { status: 400 });

  const created = await prisma.runningCost.create({
    data: { name, category, notes, amountPennies, incurredAt },
  });

  return NextResponse.json({ ok: true, row: created });
}