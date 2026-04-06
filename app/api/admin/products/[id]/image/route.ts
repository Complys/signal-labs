export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies, headers } from "next/headers";

async function requireAdmin() {
  try {
    const h = await headers();
    const c = await cookies();
    const host = h.get("host");
    if (!host) return null;
    const proto = host.includes("localhost") ? "http" : "https";
    const res = await fetch(`${proto}://${host}/api/auth/session`, {
      headers: { cookie: c.toString() }, cache: "no-store",
    });
    if (!res.ok) return null;
    const session = await res.json();
    return session?.user?.role === "ADMIN" ? session : null;
  } catch { return null; }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await Promise.resolve(ctx.params);
  const id = String((params as any)?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const image = typeof body.image === "string" ? body.image.trim() || null : null;

  const product = await prisma.product.update({
    where: { id },
    data: { image },
    select: { id: true, name: true, image: true },
  });

  return NextResponse.json({ product }, { status: 200 });
}
