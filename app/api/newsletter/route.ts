import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !email.includes("@") || email.length < 5) {
    return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  }

  try {
    await prisma.lead.upsert({
      where: { email },
      update: { source: "newsletter" },
      create: { email, source: "newsletter" },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
