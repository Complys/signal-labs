// app/api/checkout/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ---------- config ---------- */
const MAX_QTY = 9999;
const MIN_UNIT_AMOUNT = 1; // 1p
const MAX_UNIT_AMOUNT = 1_000_000; // £10,000 in pennies

const SAFEPLACES = [
  "No Safeplace (Someone will be at the property)",
  "Enclosed porch",
  "Shed",
  "Reception",
  "Garage",
  "Outbuilding",
  "Other",
] as const;

const SAFEPLACE_SET = new Set<string>(SAFEPLACES);

/** ---------- helpers ---------- */
function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function limitLen(v: unknown, max: number) {
  const s = clean(v);
  return s ? (s.length > max ? s.slice(0, max) : s) : "";
}

function normalizeEmail(v: unknown): string | null {
  const s = clean(v).toLowerCase();
  if (!s) return null;
  if (!s.includes("@") || s.length < 5) return null;
  return s;
}

function toInt(n: unknown, fallback = 0) {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function clampInt(n: unknown, min: number, max: number) {
  return Math.min(max, Math.max(min, toInt(n, min)));
}

function clampPennies(n: unknown, min = 0, max = 1_000_000_000) {
  return clampInt(n, min, max);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isValidHttpUrl(v: unknown) {
  if (typeof v !== "string") return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function getBaseUrl(req: Request) {
  const xfProto = req.headers.get("x-forwarded-proto");
  const xfHost = req.headers.get("x-forwarded-host");
  if (xfProto && xfHost) return `${xfProto}://${xfHost}`;

  const host = req.headers.get("host");
  if (host) {
    const proto = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
    return `${proto}://${host}`;
  }

  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.SITE_URL ||
    "http://localhost:3000"
  );
}

/**
 * Accepts:
 * - absolute URL: https://...
 * - relative URL: /uploads/a.png (prefixed with baseUrl)
 */
function toStripeImageUrl(image: unknown, baseUrl: string): string | undefined {
  if (!isNonEmptyString(image)) return undefined;

  const raw = image.trim();
  if (isValidHttpUrl(raw)) return raw;

  if (raw.startsWith("/")) {
    try {
      return new URL(raw, baseUrl).toString();
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function formatOrderRef(n: number) {
  return `SL-${String(n).padStart(7, "0")}`;
}

/** ---------- Stripe client ---------- */
const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), { apiVersion: "2026-01-28.clover" });

/** ---------- Shipping settings from DB ---------- */
type ShippingSettingsDb = {
  enabled: boolean;
  flatRatePennies: number;
  freeOverPennies: number;
};

async function getShippingSettings(): Promise<ShippingSettingsDb> {
  const s = await prisma.shippingSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
    select: { enabled: true, flatRatePennies: true, freeOverPennies: true },
  });

  return {
    enabled: !!s.enabled,
    flatRatePennies: clampPennies(s.flatRatePennies),
    freeOverPennies: clampPennies(s.freeOverPennies),
  };
}

/** ---------- incoming shapes ---------- */
type CartItemIn = {
  productId?: string;
  id?: string;
  dealId?: string | null;
  qty?: number;
};

type ReqLine = {
  productId: string;
  dealId: string | null;
  qty: number;
};

function normalizeProductId(v: unknown): string | null {
  if (!isNonEmptyString(v)) return null;
  const s = v.trim();
  return s ? s : null;
}

function normalizeDealId(v: unknown): string | null {
  if (!isNonEmptyString(v)) return null;
  const s = v.trim();
  return s ? s : null;
}

function aggregateReqLines(lines: ReqLine[]) {
  const map = new Map<string, ReqLine>();
  for (const l of lines) {
    const key = `${l.productId}::${l.dealId ?? ""}`;
    const prev = map.get(key);
    if (!prev) map.set(key, { ...l });
    else prev.qty = Math.min(MAX_QTY, prev.qty + l.qty);
  }
  return [...map.values()];
}

function reqLinesFromCartItems(items: CartItemIn[]): ReqLine[] {
  const out: ReqLine[] = [];
  for (const it of items) {
    const productId = normalizeProductId(it.productId ?? it.id);
    if (!productId) continue;

    out.push({
      productId,
      dealId: normalizeDealId(it.dealId),
      qty: clampInt(it.qty, 1, MAX_QTY),
    });
  }
  return out;
}

/**
 * Optional compatibility: accept Stripe-like line_items (ONLY if metadata.productId exists)
 */
async function reqLinesFromStripeLineItems(raw: any[]): Promise<ReqLine[]> {
  const out: ReqLine[] = [];

  for (const it of raw) {
    const qty = clampInt(it?.quantity, 1, MAX_QTY);

    const pd = it?.price_data;
    if (pd && typeof pd === "object") {
      const currency = String(pd.currency || "").toLowerCase();
      if (currency !== "gbp") continue;

      const productId = normalizeProductId(pd?.product_data?.metadata?.productId);
      if (!productId) continue;

      const dealId = normalizeDealId(pd?.product_data?.metadata?.dealId);
      out.push({ productId, dealId, qty });
      continue;
    }

    if (isNonEmptyString(it?.price)) {
      const priceId = String(it.price).trim();
      const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });

      const product = price.product as Stripe.Product | string | null;
      if (!product || typeof product === "string") continue;

      const productId = normalizeProductId((product.metadata as any)?.productId);
      if (!productId) continue;

      const dealId = normalizeDealId((product.metadata as any)?.dealId);
      out.push({ productId, dealId, qty });
    }
  }

  return out;
}

/** ---------- DB pricing + stock validation ---------- */
type DbResolvedLine = {
  productId: string;
  dealId: string | null;
  qty: number;
  name: string;
  unitPricePennies: number;
  image: string | null;

  // snapshots
  unitCostPennies: number;
  weightGrams: number;
};

function assertProductName(nameRaw: unknown, productId: string) {
  const name = clean(nameRaw);
  if (!name) {
    throw new Error(
      `Product name is missing for productId=${productId}. Please set a name in Admin > Products.`
    );
  }
  return name;
}

async function resolveLinesFromDb(reqLines: ReqLine[]) {
  const now = new Date();
  const productIds = [...new Set(reqLines.map((l) => l.productId))];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      price: true,
      specialPrice: true,
      image: true,
      isActive: true,
      stock: true,
      costPennies: true,
      weightGrams: true,
    },
  });

  const byId = new Map(products.map((p) => [p.id, p]));

  const dealIds = [...new Set(reqLines.map((l) => l.dealId).filter(Boolean))] as string[];
  const deals = dealIds.length
    ? await prisma.deal.findMany({
        where: {
          id: { in: dealIds },
          isActive: true,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
        select: { id: true, productId: true, specialPrice: true },
      })
    : [];

  const dealById = new Map(deals.map((d) => [d.id, d]));
  const resolved: DbResolvedLine[] = [];

  for (const l of reqLines) {
    const p = byId.get(l.productId);
    if (!p) throw new Error(`Product not found: ${l.productId}`);
    if (!p.isActive) throw new Error(`Product is inactive: ${clean(p.name) || p.id}`);

    const name = assertProductName(p.name, p.id);
    const stock = typeof p.stock === "number" ? p.stock : 0;
    if (l.qty > stock) throw new Error(`Not enough stock for ${name}. Available: ${stock}.`);

    const base = Number.isFinite(p.price) ? p.price : 0;
    let unit = base;

    // Deal price wins
    if (l.dealId) {
      const d = dealById.get(l.dealId);
      if (d && d.productId === p.id && Number.isFinite(d.specialPrice) && (d.specialPrice ?? 0) > 0) {
        unit = d.specialPrice;
      }
    } else if (
      Number.isFinite(p.specialPrice as any) &&
      (p.specialPrice ?? 0) > 0 &&
      (p.specialPrice ?? 0) < base
    ) {
      unit = p.specialPrice as number;
    }

    unit = clampInt(unit, MIN_UNIT_AMOUNT, MAX_UNIT_AMOUNT);
    if (!Number.isFinite(unit) || unit < MIN_UNIT_AMOUNT) {
      throw new Error(`Invalid price for ${name}. Please check product pricing.`);
    }

    const unitCostPennies = clampPennies(p.costPennies ?? 0, 0, MAX_UNIT_AMOUNT);
    const weightGrams = clampInt(p.weightGrams ?? 0, 0, 1_000_000);

    resolved.push({
      productId: p.id,
      dealId: l.dealId ?? null,
      qty: l.qty,
      name,
      unitPricePennies: unit,
      image: p.image ?? null,
      unitCostPennies,
      weightGrams,
    });
  }

  return resolved;
}

function buildStripeLineItemsFromDb(resolved: DbResolvedLine[], baseUrl: string) {
  return resolved.map<Stripe.Checkout.SessionCreateParams.LineItem>((it) => {
    const imgUrl = toStripeImageUrl(it.image, baseUrl);
    const images = imgUrl ? [imgUrl] : undefined;

    return {
      quantity: it.qty,
      price_data: {
        currency: "gbp",
        unit_amount: it.unitPricePennies,
        product_data: {
          name: it.name,
          ...(images ? { images } : {}),
          metadata: {
            productId: it.productId,
            dealId: it.dealId ?? "",
          },
        },
      },
    };
  });
}

/** ---------- Shipping (what customer pays) ---------- */
async function buildShippingLineItem(subtotalPennies: number): Promise<{
  isFree: boolean;
  shippingPennies: number;
  rule: string;
  freeOverPennies: number;
  flatRatePennies: number;
  enabled: boolean;
  lineItem: Stripe.Checkout.SessionCreateParams.LineItem | null;
}> {
  const ship = await getShippingSettings();
  const subtotal = clampPennies(subtotalPennies);

  if (!ship.enabled) {
    return {
      enabled: false,
      isFree: true,
      shippingPennies: 0,
      rule: "disabled_free",
      freeOverPennies: ship.freeOverPennies,
      flatRatePennies: ship.flatRatePennies,
      lineItem: null,
    };
  }

  // If freeOverPennies <= 0 => treat as FREE shipping
  if (ship.freeOverPennies <= 0) {
    return {
      enabled: true,
      isFree: true,
      shippingPennies: 0,
      rule: "threshold_free",
      freeOverPennies: ship.freeOverPennies,
      flatRatePennies: ship.flatRatePennies,
      lineItem: null,
    };
  }

  const isFree = subtotal >= ship.freeOverPennies;
  const shippingPennies = isFree ? 0 : ship.flatRatePennies;

  const freeOverGbp = (ship.freeOverPennies / 100).toFixed(2);
  const flatGbp = (ship.flatRatePennies / 100).toFixed(2);

  const displayName = isFree
    ? `Delivery (FREE over £${freeOverGbp})`
    : `Delivery (£${flatGbp}) — FREE over £${freeOverGbp}`;

  if (shippingPennies <= 0) {
    return {
      enabled: true,
      isFree: true,
      shippingPennies: 0,
      rule: `free_over_${ship.freeOverPennies}`,
      freeOverPennies: ship.freeOverPennies,
      flatRatePennies: ship.flatRatePennies,
      lineItem: null,
    };
  }

  return {
    enabled: true,
    isFree,
    shippingPennies,
    rule: isFree ? `free_over_${ship.freeOverPennies}` : `flat_${ship.flatRatePennies}`,
    freeOverPennies: ship.freeOverPennies,
    flatRatePennies: ship.flatRatePennies,
    lineItem: {
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: shippingPennies,
        product_data: {
          name: displayName,
          metadata: {
            kind: "shipping",
            rule: `flat_${ship.flatRatePennies}`,
            freeOverPennies: String(ship.freeOverPennies),
            flatRatePennies: String(ship.flatRatePennies),
          },
        },
      },
    },
  };
}

/** ---------- Postage cost (what it costs YOU) ---------- */
async function calcPostageCostPennies(resolved: DbResolvedLine[]): Promise<{
  postageCostPennies: number;
  totalWeightGrams: number;
  totalItems: number;
  matchedBandName: string | null;
}> {
  const totalItems = resolved.reduce((acc, it) => acc + clampInt(it.qty, 0, MAX_QTY), 0);
  const totalWeightGrams = resolved.reduce(
    (acc, it) => acc + clampInt(it.weightGrams, 0, 1_000_000) * clampInt(it.qty, 0, MAX_QTY),
    0
  );

  const bands = await prisma.postageBand.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { maxWeightGrams: "asc" }],
  });

  for (const b of bands) {
    const maxW = clampInt(b.maxWeightGrams, 0, 10_000_000);
    const maxI = b.maxItems == null ? null : clampInt(b.maxItems, 0, 1_000_000);

    const okWeight = totalWeightGrams <= maxW;
    const okItems = maxI == null ? true : totalItems <= maxI;

    if (okWeight && okItems) {
      return {
        postageCostPennies: clampPennies(b.costPennies, 0, 1_000_000_000),
        totalWeightGrams,
        totalItems,
        matchedBandName: clean((b as any).name) || null,
      };
    }
  }

  if (bands.length > 0) {
    const last = bands[bands.length - 1];
    return {
      postageCostPennies: clampPennies(last.costPennies, 0, 1_000_000_000),
      totalWeightGrams,
      totalItems,
      matchedBandName: clean((last as any).name) || null,
    };
  }

  return { postageCostPennies: 0, totalWeightGrams, totalItems, matchedBandName: null };
}

/** ---------- Affiliate (cookie -> snapshot) ---------- */
async function getApprovedAffiliateFromCookie(): Promise<{ id: string; code: string; rateBps: number } | null> {
  const c = await cookies();
  const raw = clean(c.get("aff_ref")?.value || "");
  if (!raw) return null;

  const affiliate = await prisma.affiliate.findUnique({
    where: { code: raw },
    select: { id: true, code: true, defaultRateBps: true, isActive: true, status: true },
  });

  const ok = affiliate && affiliate.isActive && String(affiliate.status || "").toUpperCase() === "APPROVED";
  if (!ok) return null;

  return {
    id: affiliate!.id,
    code: affiliate!.code,
    rateBps: typeof affiliate!.defaultRateBps === "number" ? affiliate!.defaultRateBps : 0,
  };
}

/** ---------- route ---------- */
export async function POST(req: Request) {
  let createdOrderId: string | null = null;

  try {
    const baseUrl = getBaseUrl(req);
    const body = (await req.json().catch(() => null)) as any;

    const rawLineItems = body?.line_items as unknown;
    const rawCartItems = body?.items as unknown;

    const delivery = body?.delivery && typeof body.delivery === "object" ? body.delivery : null;

    const name = limitLen(delivery?.name ?? body?.recipientName, 120);
    const company = limitLen(delivery?.company ?? body?.companyName, 120);

    const trackingEmailFromBody = normalizeEmail(delivery?.email ?? body?.recipientEmail);
    const phone = limitLen(delivery?.phone ?? body?.recipientPhone, 60);
    const safePlaceIn = limitLen(delivery?.safePlace ?? body?.safeplace, 120);
    const deliveryNotes = limitLen(delivery?.notes ?? body?.deliveryNotes, 500);

    const receiptEmailFromBody = normalizeEmail(
      body?.payerEmail ?? body?.receiptEmail ?? body?.email ?? body?.customerEmail
    );

    // 1) Convert payload -> reqLines
    let reqLines: ReqLine[] = [];
    if (Array.isArray(rawLineItems) && rawLineItems.length > 0) {
      reqLines = await reqLinesFromStripeLineItems(rawLineItems as any[]);
    }
    if (reqLines.length === 0 && Array.isArray(rawCartItems) && rawCartItems.length > 0) {
      reqLines = reqLinesFromCartItems(rawCartItems as CartItemIn[]);
    }
    reqLines = aggregateReqLines(reqLines);

    if (reqLines.length === 0) {
      return NextResponse.json({ ok: false, error: "Missing items." }, { status: 400 });
    }

    // 2) Logged-in user (if any)
    const session = await getServerSession(authOptions);
    const sessionEmailRaw = (session?.user as any)?.email;
    const sessionEmail = isNonEmptyString(sessionEmailRaw) ? sessionEmailRaw.trim().toLowerCase() : null;

    let userId: string | null = null;
    if (sessionEmail) {
      const user = await prisma.user.findUnique({ where: { email: sessionEmail }, select: { id: true } });
      userId = user?.id ?? null;
    }

    // Final email decisions
    const trackingEmail = trackingEmailFromBody ?? sessionEmail ?? receiptEmailFromBody ?? null;
    const receiptEmail = receiptEmailFromBody ?? sessionEmail ?? trackingEmailFromBody ?? null;

    if (!trackingEmail) {
      return NextResponse.json(
        { ok: false, error: "Tracking email is required (for updates/tracking)." },
        { status: 400 }
      );
    }
    if (!receiptEmail) {
      return NextResponse.json(
        { ok: false, error: "Receipt email is required (for payment receipt)." },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
    }

    const safePlace = SAFEPLACE_SET.has(safePlaceIn) ? safePlaceIn : SAFEPLACES[0];

    // 3) Resolve DB prices + stock + snapshots (cost + weight)
    const resolved = await resolveLinesFromDb(reqLines);

    // Subtotal (products only)
    const subtotalPennies = resolved.reduce((sum, it) => sum + it.unitPricePennies * it.qty, 0);

    // Shipping (what customer pays)
    const shipping = await buildShippingLineItem(subtotalPennies);
    const shippingPennies = shipping.shippingPennies;

    // Postage (what YOU pay)
    const postage = await calcPostageCostPennies(resolved);

    // Total stored should include shipping charged
    const amountTotal = subtotalPennies + shippingPennies;

    // Affiliate cookie snapshot
    const affiliate = await getApprovedAffiliateFromCookie();

    // 4) Create orderRef + order in ONE transaction
    const created = await prisma.$transaction(async (tx) => {
      const counter = await tx.orderCounter.upsert({
        where: { id: 1 },
        create: { id: 1, next: 2 },
        update: { next: { increment: 1 } },
        select: { next: true },
      });

      const orderNumber = counter.next - 1;
      const orderRef = formatOrderRef(orderNumber);

      return tx.order.create({
        data: {
          orderRef,
          status: "PENDING",
          currency: "gbp",
          amountTotal,

          shippingChargedPennies: shippingPennies,
          postageCostPennies: postage.postageCostPennies,

          email: trackingEmail,
          receiptEmail,

          userId: userId ?? undefined,

          name: name || null,
          company: company || null,
          phone: phone || null,
          safePlace: safePlace || null,
          deliveryNotes: deliveryNotes || null,

          ...(affiliate
            ? {
                affiliateId: affiliate.id,
                affiliateCode: affiliate.code,
                affiliateRateBpsSnapshot: affiliate.rateBps,
              }
            : {}),

          items: {
            create: resolved.map((it) => ({
              productId: it.productId,
              name: it.name,
              unitPrice: it.unitPricePennies,
              quantity: it.qty,
              lineTotal: it.unitPricePennies * it.qty,
              unitCostPennies: it.unitCostPennies,
            })),
          },
        },
        select: { id: true, orderRef: true },
      });
    });

    createdOrderId = created.id;

    // 5) Create Stripe Checkout session
    const productLineItems = buildStripeLineItemsFromDb(resolved, baseUrl);
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [...productLineItems];
    if (shipping.lineItem) line_items.push(shipping.lineItem);

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      ui_mode: "hosted",
      line_items,

      success_url: `${baseUrl}/success?orderId=${created.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cart?cancelled=1&orderId=${created.id}`,

      billing_address_collection: "required",
      shipping_address_collection: { allowed_countries: ["GB"] },

      phone_number_collection: { enabled: false },
      allow_promotion_codes: true,

      // ✅ both of these help your webhook find the order every time
      client_reference_id: created.id,
      metadata: {
        orderId: created.id,
        orderRef: created.orderRef,

        trackingEmail,
        receiptEmail,

        name,
        company,
        phone,
        safePlace,
        deliveryNotes,
        userId: userId ?? "",

        affiliateCode: affiliate?.code ?? "",

        // Shipping debug
        shippingRule: shipping.rule,
        shippingPennies: String(shippingPennies),
        subtotalPennies: String(subtotalPennies),
        shippingEnabled: String(shipping.enabled),
        shippingFreeOverPennies: String(shipping.freeOverPennies),
        shippingFlatRatePennies: String(shipping.flatRatePennies),

        // Postage debug
        postageCostPennies: String(postage.postageCostPennies),
        postageBandName: postage.matchedBandName ?? "",
        totalWeightGrams: String(postage.totalWeightGrams),
        totalItems: String(postage.totalItems),
      },

      // ✅ BIG reliability improvement:
      // add orderId/orderRef to the underlying PaymentIntent too,
      // so your webhook can match via payment_intent.succeeded even if session payment_status timing is weird.
      payment_intent_data: {
        metadata: {
          orderId: created.id,
          orderRef: created.orderRef,
        },
      },
    };

    // Prefill Stripe email
    params.customer_email = receiptEmail;

    let checkout: Stripe.Checkout.Session;
    try {
      checkout = await stripe.checkout.sessions.create(params);
    } catch (err: any) {
      const msg = err?.raw?.message || err?.message || "Stripe checkout session creation failed.";

      if (createdOrderId) {
        await prisma.order.update({ where: { id: createdOrderId }, data: { status: "FAILED" } }).catch(() => {});
      }

      console.error("Stripe create session error:", {
        message: err?.message,
        rawMessage: err?.raw?.message,
        param: err?.raw?.param,
        type: err?.raw?.type,
        code: err?.raw?.code,
      });

      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    if (!checkout.url) {
      if (createdOrderId) {
        await prisma.order.update({ where: { id: createdOrderId }, data: { status: "FAILED" } }).catch(() => {});
      }
      return NextResponse.json({ ok: false, error: "No checkout URL returned." }, { status: 500 });
    }

    // 6) Save session id immediately (webhook can still match via metadata.orderId anyway)
    await prisma.order.update({
      where: { id: created.id },
      data: { stripeSessionId: checkout.id },
    });

    return NextResponse.json(
      { ok: true, url: checkout.url, orderId: created.id, orderRef: created.orderRef },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Checkout error:", { message: err?.message, stack: err?.stack });

    if (createdOrderId) {
      await prisma.order.update({ where: { id: createdOrderId }, data: { status: "FAILED" } }).catch(() => {});
    }

    return NextResponse.json(
      { ok: false, error: typeof err?.message === "string" ? err.message : "Checkout failed." },
      { status: 500 }
    );
  }
}