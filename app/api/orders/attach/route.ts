// app/api/orders/attach/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function normEmail(v: unknown) {
  return clean(v).toLowerCase();
}

function normStatus(v: unknown) {
  return clean(v).toUpperCase();
}

const ATTACHABLE_STATUSES = new Set(["PAID", "PROCESSING", "SHIPPED", "FULFILLED", "REFUNDED"]);

// ✅ Optional: stop 405 noise if anything hits this as GET
export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Use POST" },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    const userId = (session?.user as any)?.id as string | undefined;
    const userEmail = normEmail((session?.user as any)?.email);

    if (!userId || !userEmail) {
      return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
    }

    // Extra safety: ensure user still exists (email could change, user could be deleted)
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true },
    });

    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));
    const stripeSessionId = clean(body?.stripeSessionId);
    const orderId = clean(body?.orderId);

    if (!stripeSessionId && !orderId) {
      return NextResponse.json(
        { ok: false, error: "Missing stripeSessionId (or orderId)" },
        { status: 400 }
      );
    }

    // Find the order (we need status + current userId)
    const order = await prisma.order.findFirst({
      where: stripeSessionId ? { stripeSessionId } : { id: orderId },
      select: { id: true, userId: true, status: true },
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
    }

    const status = normStatus(order.status);
    if (!ATTACHABLE_STATUSES.has(status)) {
      return NextResponse.json(
        { ok: false, error: `Order not attachable (status=${status})` },
        { status: 400 }
      );
    }

    // Already attached to this user -> idempotent success
    if (order.userId === userId) {
      return NextResponse.json({ ok: true, attached: true, already: true, orderId: order.id });
    }

    // Attached to someone else -> block
    if (order.userId && order.userId !== userId) {
      return NextResponse.json({ ok: false, error: "Order already attached" }, { status: 409 });
    }

    // Attach safely (prevents race conditions)
    // Only attach if currently null
    const updated = await prisma.order.updateMany({
      where: { id: order.id, userId: null },
      data: { userId },
    });

    if (updated.count === 0) {
      // Someone else attached it between read and update
      const now = await prisma.order.findUnique({
        where: { id: order.id },
        select: { userId: true },
      });

      if (now?.userId === userId) {
        return NextResponse.json({ ok: true, attached: true, already: true, orderId: order.id });
      }

      return NextResponse.json({ ok: false, error: "Order already attached" }, { status: 409 });
    }

    return NextResponse.json({ ok: true, attached: true, already: false, orderId: order.id });
  } catch (e) {
    console.error("Attach order error:", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}