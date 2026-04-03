import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const KEY = "announcement_bar";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  return NextResponse.json({ message: row?.value ?? "" });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  await prisma.siteSetting.upsert({
    where: { key: KEY },
    update: { value: message },
    create: { key: KEY, value: message },
  });
  return NextResponse.json({ ok: true, message });
}
