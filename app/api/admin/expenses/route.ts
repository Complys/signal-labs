import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function gbpToPennies(v: unknown) {
  const s = clean(v).replace("£", "").replace(/,/g, "");
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expenses = await prisma.businessExpense.findMany({
    orderBy: { incurredAt: "desc" },
    take: 300,
  });

  return NextResponse.json({ ok: true, expenses });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));

  const name = clean(body.name);
  const category = clean(body.category || "OTHER").toUpperCase();
  const notes = clean(body.notes) || null;

  const amountPennies = gbpToPennies(body.amount);
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (amountPennies === null) return NextResponse.json({ error: "Amount must be valid (0+)" }, { status: 400 });

  const incurredAtRaw = clean(body.incurredAt);
  const incurredAt = incurredAtRaw ? new Date(incurredAtRaw) : new Date();
  if (Number.isNaN(incurredAt.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const expense = await prisma.businessExpense.create({
    data: {
      name,
      category: category || "OTHER",
      amountPennies,
      incurredAt,
      notes,
    },
  });

  return NextResponse.json({ ok: true, expense }, { status: 201 });
}