// app/api/orders/lookup/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = (url.searchParams.get("session_id") || "").trim();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    // Prefer findUnique if stripeSessionId is unique in your schema.
    // If it isn't unique, switch to findFirst.
    const order =
      (await prisma.order
        .findUnique({
          where: { stripeSessionId: sessionId },
          select: {
            stripeSessionId: true,
            email: true,
            amountTotal: true,
            currency: true,
            status: true,
            createdAt: true,
          },
        })
        .catch(() => null)) ??
      (await prisma.order.findFirst({
        where: { stripeSessionId: sessionId },
        orderBy: { createdAt: "desc" },
        select: {
          stripeSessionId: true,
          email: true,
          amountTotal: true,
          currency: true,
          status: true,
          createdAt: true,
        },
      }));

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      stripeSessionId: order.stripeSessionId,
      email: order.email ?? null,
      amountTotal: order.amountTotal ?? 0,
      currency: order.currency ?? "gbp",
      status: order.status ?? "PAID",
      createdAt: order.createdAt?.toISOString?.() ?? null,
      receiptUrl: null, // you aren’t storing one yet
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Lookup failed" },
      { status: 500 }
    );
  }
}
