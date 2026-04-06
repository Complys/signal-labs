export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.role === "ADMIN" ? session : null;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const params = await Promise.resolve(ctx.params);
  const id = (params as any).id;
  const { role } = await req.json().catch(() => ({}));
  const validRoles = ["ADMIN", "FULFILMENT", "USER"];
  if (!validRoles.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  const user = await prisma.user.update({ where: { id }, data: { role }, select: { id: true, role: true } });
  return NextResponse.json({ user });
}

export async function DELETE(
  _: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const params = await Promise.resolve(ctx.params);
  const id = (params as any).id;
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
