export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// app/api/admin/products/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies, headers } from "next/headers";

async function getSessionFromApi() {
  try {
    const h = await headers();
    const c = await cookies();

    const host = h.get("host");
    if (!host) return null;

    const proto =
      host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";

    const res = await fetch(`${proto}://${host}/api/auth/session`, {
      headers: { cookie: c.toString() },
      cache: "no-store",
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function normalizeId(idRaw: unknown) {
  const id = String(idRaw ?? "").trim();
  return id.length ? id : null;
}

async function requireAdmin() {
  const session = await getSessionFromApi();
  if (!session?.user || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const params = await Promise.resolve(ctx.params);
    const id = normalizeId(params.id);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ product }, { status: 200 });
  } catch (e) {
    console.error("GET /api/admin/products/[id] error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const params = await Promise.resolve(ctx.params);
    const id = normalizeId(params.id);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json().catch(() => ({} as any));
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "isActive must be boolean" }, { status: 400 });
    }

    const product = await prisma.product.update({
      where: { id },
      data: { isActive: body.isActive },
      select: { id: true, isActive: true },
    });

    return NextResponse.json({ product }, { status: 200 });
  } catch (e) {
    console.error("PATCH /api/admin/products/[id] error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const params = await Promise.resolve(ctx.params);
    const id = normalizeId(params.id);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    // Clean up related rows first (prevents FK problems if enabled)
    await prisma.orderItem.deleteMany({ where: { productId: id } });
    await prisma.deal.deleteMany({ where: { productId: id } });

    await prisma.product.delete({ where: { id } });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("DELETE /api/admin/products/[id] error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}



