export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { email, firstName, source } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      if (!existing.subscribed) {
        await prisma.newsletterSubscriber.update({ where: { id: existing.id }, data: { subscribed: true } });
        return NextResponse.json({ ok: true, message: "Welcome back! You have been re-subscribed." });
      }
      return NextResponse.json({ ok: true, message: "You are already subscribed!" });
    }
    await prisma.newsletterSubscriber.create({
      data: { email: email.toLowerCase(), firstName: firstName || null, source: source || "website" }
    });
    return NextResponse.json({ ok: true, message: "Thank you for subscribing!" });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
