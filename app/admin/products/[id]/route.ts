import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies, headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function requireAdmin() {
  const session = await getSessionFromApi();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

function isNonNegativeInt(v: unknown) {
  return Number.isInteger(v) && (v as number) >= 0;
}

// PATCH /api/admin/products/:id
// Body can include any of:
//   { isActive?: boolean, costPennies?: number | null }
export async function PATCH(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = await paramsPromise;
  const id = params?.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const data: { isActive?: boolean; costPennies?: number | null } = {};

  // isActive (optional)
  if ("isActive" in body) {
    if (typeof (body as any).isActive !== "boolean") {
      return NextResponse.json({ ok: false, error: "isActive must be boolean" }, { status: 400 });
    }
    data.isActive = (body as any).isActive;
  }

  // costPennies (optional) - allow null to clear, or non-negative int
  if ("costPennies" in body) {
    const v = (body as any).costPennies;

    if (v === null) {
      data.costPennies = null;
    } else if (isNonNegativeInt(v)) {
      data.costPennies = v;
    } else {
      return NextResponse.json(
        { ok: false, error: "costPennies must be a non-negative integer (pennies) or null" },
        { status: 400 }
      );
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { ok: false, error: "No valid fields provided. Send isActive and/or costPennies." },
      { status: 400 }
    );
  }

  const exists = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!exists) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.product.update({
    where: { id },
    data,
    select: {
      id: true,
      isActive: true,
      costPennies: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, product: updated });
}

// DELETE /api/admin/products/:id
export async function DELETE(_req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = await paramsPromise;
  const id = params?.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  // If deals reference productId, delete them first
  await prisma.deal.deleteMany({ where: { productId: id } });

  await prisma.product.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}