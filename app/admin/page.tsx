// app/admin/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fmtGBP(pennies: number) {
  const p = Number.isFinite(pennies) ? pennies : 0;
  return `£${(p / 100).toFixed(2)}`;
}

export default async function AdminIndex() {
  // ✅ IMPORTANT:
  // Your Prisma model fields are:
  // - freeOverPennies  (mapped to DB column freeOverPennies)
  // - enabled          (mapped to DB column enabled)
  // So Prisma Client must use freeOverPennies/enabled (not the mapped names).
  const s = await prisma.shippingSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      enabled: true,
      freeOverPennies: 3000,
      flatRatePennies: 499,
    },
    update: {},
    select: {
      id: true,
      enabled: true,
      freeOverPennies: true,
      flatRatePennies: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold">Admin</h1>
        <p className="mt-1 text-sm text-black/60">Quick links and key settings.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-black/10 bg-white p-5">
          <div className="text-sm font-semibold">Shipping settings</div>

          <div className="mt-2 text-sm text-black/70">
            Status:{" "}
            <span className="font-semibold">
              {s.enabled ? "Enabled" : "Disabled (free on all orders)"}
            </span>
          </div>

          <div className="mt-1 text-sm text-black/70">
            Free over: <span className="font-semibold">{fmtGBP(s.freeOverPennies)}</span>
          </div>

          <div className="mt-1 text-sm text-black/70">
            Flat rate: <span className="font-semibold">{fmtGBP(s.flatRatePennies)}</span>
          </div>

          <div className="mt-3">
            <Link
              href="/admin/shipping"
              className="inline-flex h-9 items-center justify-center rounded-full bg-black px-4 text-xs font-semibold text-white hover:opacity-90"
            >
              Edit shipping
            </Link>
          </div>

          <div className="mt-2 text-[11px] text-black/45">
            Updated: {new Date(s.updatedAt).toLocaleString()}
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-5">
          <div className="text-sm font-semibold">Quick links</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              className="rounded-full border px-4 py-2 text-xs font-semibold hover:bg-black/5"
              href="/admin/products"
            >
              Products
            </Link>
            <Link
              className="rounded-full border px-4 py-2 text-xs font-semibold hover:bg-black/5"
              href="/admin/orders"
            >
              Orders
            </Link>
            <Link
              className="rounded-full border px-4 py-2 text-xs font-semibold hover:bg-black/5"
              href="/admin/deals"
            >
              Deals
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}