export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.role === "ADMIN" ? session : null;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const users = await prisma.user.findMany({
    select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { email, firstName, lastName, password, role } = await req.json().catch(() => ({}));
  if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  const validRoles = ["ADMIN", "FULFILMENT", "USER"];
  if (!validRoles.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 400 });
  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), password: hashed, firstName, lastName, role },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
  });
  return NextResponse.json({ user }, { status: 201 });
}
