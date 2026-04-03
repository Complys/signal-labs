import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CartItem = {
  productId: string;
  dealId?: string | null;
  name: string;
  unitPricePennies: number;
  image?: string | null;
  qty: number;
};

type Cart = { items: CartItem[] };

const COOKIE = "sl_cart";

function clampQty(qty: unknown) {
  const n = typeof qty === "number" ? qty : Number(qty);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(999, Math.trunc(n)));
}

async function readCart(): Promise<Cart> {
  const store = await cookies();
  const c = store.get(COOKIE)?.value;

  if (!c) return { items: [] };

  try {
    const parsed = JSON.parse(c);
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
    return { items: parsed.items };
  } catch {
    return { items: [] };
  }
}

async function writeCart(cart: Cart) {
  const store = await cookies();
  store.set(COOKIE, JSON.stringify(cart), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

function totals(cart: Cart) {
  const count = cart.items.reduce((a, i) => a + clampQty(i.qty), 0);
  const subtotalPennies = cart.items.reduce(
    (a, i) => a + (Number(i.unitPricePennies) || 0) * clampQty(i.qty),
    0
  );
  return { count, subtotalPennies };
}

export async function GET() {
  const cart = await readCart();
  const { count, subtotalPennies } = totals(cart);
  return NextResponse.json({ cart, count, subtotalPennies });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const productId = String(body?.productId ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const unitPricePennies = Number(body?.unitPricePennies);
  const image = body?.image ? String(body.image) : null;
  const dealId = body?.dealId ? String(body.dealId) : null;
  const qty = clampQty(body?.qty);

  if (!productId || !name || !Number.isFinite(unitPricePennies)) {
    return NextResponse.json(
      { error: "Missing productId/name/unitPricePennies" },
      { status: 400 }
    );
  }

  const cart = await readCart();

  const key = `${productId}::${dealId ?? ""}`;
  const idx = cart.items.findIndex(
    (i) => `${i.productId}::${i.dealId ?? ""}` === key
  );

  if (idx >= 0) {
    cart.items[idx] = {
      ...cart.items[idx],
      qty: clampQty(clampQty(cart.items[idx].qty) + qty),
      name,
      unitPricePennies,
      image,
    };
  } else {
    cart.items.unshift({
      productId,
      dealId,
      name,
      unitPricePennies,
      image,
      qty,
    });
  }

  await writeCart(cart);

  const { count, subtotalPennies } = totals(cart);
  return NextResponse.json({ ok: true, count, subtotalPennies, cart });
}

export async function DELETE() {
  await writeCart({ items: [] });
  return NextResponse.json({ ok: true });
}
