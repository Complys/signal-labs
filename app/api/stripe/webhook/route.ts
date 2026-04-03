// app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderUpdateEmail } from "@/lib/orderEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ✅ Stripe Webhook (robust)
 * - Verifies signature from RAW body
 * - Accepts BOTH: checkout.session.* and payment_intent.succeeded
 * - Uses orderId mapping priority:
 *    1) session.metadata.orderId
 *    2) session.client_reference_id
 *    3) DB lookup by stripeSessionId
 *    4) DB lookup by paymentIntentId
 *    5) payment_intent.metadata.orderId (fallback)
 * - Never downgrades PAID-like orders back to PENDING/FAILED/CANCELLED
 * - Marks order PAID idempotently (stock deducted once)
 * - Sends receipt email ONCE (EmailEvent idempotency)
 *
 * IMPORTANT FOR LOCALHOST:
 * Stripe cannot call localhost. Use Stripe CLI:
 *   stripe listen --forward-to http://localhost:3000/api/stripe/webhook
 * and set STRIPE_WEBHOOK_SECRET to the whsec_... printed by the CLI.
 */

type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "CANCELLED"
  | "REFUNDED"
  | "FAILED";

const PAID_LIKE: OrderStatus[] = ["PAID", "PROCESSING", "SHIPPED", "REFUNDED"];

/** ---------------- helpers ---------------- */
function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function clean(v: unknown) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function toInt(n: unknown, fallback = 0) {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function clampInt(n: unknown, min: number, max: number) {
  const x = toInt(n, min);
  return Math.min(max, Math.max(min, x));
}

function safeJsonStringify(obj: unknown, maxLen = 50_000) {
  try {
    const s = JSON.stringify(obj);
    if (!s) return null;
    return s.length > maxLen ? s.slice(0, maxLen) : s;
  } catch {
    return null;
  }
}

function isUniqueViolation(err: any) {
  return err?.code === "P2002" || /unique constraint/i.test(String(err?.message || ""));
}

function isPaymentSettled(status: string | null | undefined) {
  const s = String(status || "").toUpperCase();
  return PAID_LIKE.includes(s as OrderStatus);
}

/** ---------------- stripe helpers ---------------- */
function getPaymentIntentIdFromSession(session: Stripe.Checkout.Session): string | null {
  const pi =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent as any)?.id ?? null;
  return clean(pi) || null;
}

function extractStripeEmail(session: Stripe.Checkout.Session): string | null {
  const e = session.customer_details?.email ?? session.customer_email ?? null;
  return clean(e) || null;
}

function extractStripeName(session: Stripe.Checkout.Session): string | null {
  const s = clean(session.customer_details?.name) || clean((session as any).shipping_details?.name);
  return s || null;
}

function extractStripePhone(session: Stripe.Checkout.Session): string | null {
  return clean(session.customer_details?.phone) || null;
}

function extractAddress(session: Stripe.Checkout.Session) {
  const shipAddr = (session as any).shipping_details?.address ?? null;
  const custAddr = session.customer_details?.address ?? null;
  const addr = shipAddr || custAddr;

  return {
    addressLine1: clean(addr?.line1) || null,
    addressLine2: clean(addr?.line2) || null,
    city: clean(addr?.city) || null,
    postcode: clean(addr?.postal_code) || null,
    country: clean(addr?.country) || null,
  };
}

function extractMeta(session: Stripe.Checkout.Session) {
  const md = (session.metadata ?? {}) as Record<string, unknown>;
  return {
    orderId: clean(md.orderId) || null,
    orderRef: clean(md.orderRef) || null,

    name: clean(md.name) || null,
    company: clean(md.company) || null,
    phone: clean(md.phone) || null,
    safePlace: clean(md.safePlace) || null,
    deliveryNotes: clean(md.deliveryNotes) || null,

    trackingEmail: clean(md.trackingEmail) || null,
    payerEmail: clean(md.payerEmail) || null,
    receiptEmail: clean(md.receiptEmail) || null,

    affiliateCode: clean(md.affiliateCode) || null,

    // legacy
    legacyEmail: clean(md.email) || null,
    userId: clean(md.userId) || null,
  };
}

function extractShippingChargedPennies(session: Stripe.Checkout.Session): number {
  const a = toInt((session as any)?.total_details?.amount_shipping, 0);
  if (a > 0) return a;

  const b = toInt((session as any)?.shipping_cost?.amount_total, 0);
  if (b > 0) return b;

  return 0;
}

function sessionIsPaid(session: Stripe.Checkout.Session) {
  const ps = String(session.payment_status || "").toLowerCase();
  return ps === "paid";
}

function desiredStatusFromCheckoutEvent(eventType: string, session: Stripe.Checkout.Session): OrderStatus {
  if (eventType === "checkout.session.async_payment_failed") return "FAILED";
  if (eventType === "checkout.session.async_payment_succeeded") return "PAID";
  if (eventType === "checkout.session.expired") return "CANCELLED";

  if (eventType === "checkout.session.completed") {
    return sessionIsPaid(session) ? "PAID" : "PENDING";
  }

  return "PENDING";
}

/** ---------------- Stripe client ---------------- */
const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), { apiVersion: "2026-01-28.clover" });

/** ---------------- Idempotent DB event writers ---------------- */
async function tryCreateOrderEvent(args: {
  orderId: string;
  type: string;
  source: "stripe" | "app" | "admin";
  idempotencyKey: string;
  summary?: string | null;
  data?: unknown;
}) {
  try {
    await prisma.orderEvent.create({
      data: {
        orderId: args.orderId,
        type: args.type,
        source: args.source,
        idempotencyKey: args.idempotencyKey,
        summary: args.summary ?? null,
        data: safeJsonStringify(args.data),
      },
      select: { id: true },
    });
    return { created: true as const };
  } catch (e: any) {
    if (isUniqueViolation(e)) return { created: false as const };
    throw e;
  }
}

async function tryCreateEmailEvent(params: {
  orderId: string;
  type: string;
  idempotencyKey: string;
  toEmail: string;
  subject?: string;
}) {
  try {
    const ev = await prisma.emailEvent.create({
      data: {
        orderId: params.orderId,
        type: params.type,
        idempotencyKey: params.idempotencyKey,
        status: "PENDING",
        toEmail: params.toEmail,
        subject: params.subject ?? null,
        provider: "sendgrid",
      },
      select: { id: true },
    });
    return { created: true as const, eventId: ev.id };
  } catch (e: any) {
    if (isUniqueViolation(e)) return { created: false as const, eventId: null as string | null };
    throw e;
  }
}

async function markEmailEventSent(eventId: string, providerMessageId?: string | null) {
  await prisma.emailEvent
    .update({
      where: { id: eventId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        ...(providerMessageId ? ({ providerMessageId } as any) : {}),
        error: null,
      },
    })
    .catch(() => {});
}

async function markEmailEventFailed(eventId: string, error: string) {
  await prisma.emailEvent
    .update({
      where: { id: eventId },
      data: { status: "FAILED", error: error.slice(0, 2000) },
    })
    .catch(() => {});
}

function stripeEventTypeToOrderEventType(t: string) {
  return `STRIPE_${t.toUpperCase().replaceAll(".", "_")}`;
}

function stripeEventSummary(t: string) {
  if (t === "checkout.session.completed") return "Checkout completed";
  if (t === "checkout.session.async_payment_succeeded") return "Async payment succeeded";
  if (t === "checkout.session.async_payment_failed") return "Async payment failed";
  if (t === "checkout.session.expired") return "Checkout expired";
  if (t === "payment_intent.succeeded") return "PaymentIntent succeeded";
  return t;
}

/** ---------------- COGS / commission / postage ---------------- */
function calcCogsPennies(items: Array<{ quantity: number; unitCostPennies: number | null }>) {
  let total = 0;
  for (const it of items || []) {
    const unitCost = typeof it.unitCostPennies === "number" ? it.unitCostPennies : 0;
    const qty = Number.isFinite(Number(it.quantity)) ? Number(it.quantity) : 0;
    total += unitCost * qty;
  }
  return total;
}

function calcAffiliateCommissionPennies(args: {
  amountTotalPennies: number;
  shippingChargedPennies: number;
  rateBps: number;
}) {
  const amount = Math.max(0, toInt(args.amountTotalPennies, 0));
  const shipping = Math.max(0, toInt(args.shippingChargedPennies, 0));
  const eligible = Math.max(0, amount - shipping);
  const rate = clampInt(args.rateBps, 0, 10000);
  return Math.floor((eligible * rate) / 10_000);
}

async function calcPostageCostPenniesForOrder(tx: any, orderId: string): Promise<number> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return 0;

  const items = order.items || [];
  const totalItems = items.reduce((acc: number, it: any) => acc + toInt(it.quantity, 0), 0);

  const productIds = Array.from(new Set(items.map((it: any) => it.productId).filter(Boolean)));

  let weightById = new Map<string, number>();
  if (productIds.length > 0) {
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, weightGrams: true },
    });

    weightById = new Map(
      (products || []).map((p: any) => [String(p.id), typeof p.weightGrams === "number" ? p.weightGrams : 0])
    );
  }

  let totalWeightGrams = 0;
  for (const it of items) {
    const qty = toInt(it.quantity, 0);
    const w = it.productId ? (weightById.get(String(it.productId)) ?? 0) : 0;
    totalWeightGrams += w * qty;
  }

  if (totalWeightGrams <= 0) return 0;

  const bands = await tx.postageBand.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { maxWeightGrams: "asc" }],
    select: { maxWeightGrams: true, maxItems: true, costPennies: true },
  });

  const match = (bands || []).find((b: any) => {
    const maxW = typeof b.maxWeightGrams === "number" ? b.maxWeightGrams : 0;
    const maxI = b.maxItems == null ? null : toInt(b.maxItems, 0);
    const weightOk = maxW >= totalWeightGrams;
    const itemsOk = maxI == null ? true : maxI >= totalItems;
    return weightOk && itemsOk;
  });

  return match && typeof match.costPennies === "number" ? match.costPennies : 0;
}

/** ---------------- line items fallback (rare) ---------------- */
async function getLineItems(sessionId: string) {
  const li = await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 100,
    expand: ["data.price.product"],
  });
  return li.data;
}

function extractMetaProductId(li: Stripe.LineItem): string | null {
  const product = li.price?.product as Stripe.Product | string | null | undefined;
  if (!product || typeof product === "string") return null;
  const pid = clean((product.metadata as any)?.productId);
  return pid || null;
}

async function lookupUnitCosts(productIds: string[]) {
  const uniq = Array.from(new Set(productIds.filter(Boolean)));
  if (uniq.length === 0) return new Map<string, number | null>();

  const rows = await prisma.product.findMany({
    where: { id: { in: uniq } },
    select: { id: true, costPennies: true },
  });

  const m = new Map<string, number | null>();
  for (const r of rows) m.set(r.id, typeof r.costPennies === "number" ? r.costPennies : null);
  return m;
}

async function buildItemsFromSession(stripeSessionId: string) {
  const lineItems = await getLineItems(stripeSessionId);

  const base = lineItems.map((x) => {
    const quantity = clampInt(x.quantity, 1, 999);
    const unitPrice =
      toInt(x.price?.unit_amount, 0) ||
      (quantity > 0 ? Math.round(toInt(x.amount_total, 0) / quantity) : 0);

    const productId = extractMetaProductId(x);

    return {
      productId,
      name: String(x.description || "Item").slice(0, 255),
      unitPrice,
      quantity,
      lineTotal: unitPrice * quantity,
      unitCostPennies: null as number | null,
    };
  });

  const costMap = await lookupUnitCosts(base.map((b) => b.productId || "").filter(Boolean));
  return base.map((b) => ({
    ...b,
    unitCostPennies: b.productId ? costMap.get(b.productId) ?? null : null,
  }));
}

/** ---------------- email: paid receipt ONCE ---------------- */
async function sendReceiptPaidEmailOnce(order: {
  id: string;
  receiptEmail: string | null;
  amountTotal: number;
  paymentIntentId?: string | null;
  items: Array<{ name: string; quantity: number; unitPrice: number; lineTotal: number }>;
  customerName?: string | null;
}) {
  const to = clean(order.receiptEmail);
  if (!to) return;

  const piPart = clean(order.paymentIntentId) ? `:pi:${clean(order.paymentIntentId)}` : "";
  const key = `order:${order.id}${piPart}:receipt_paid`;

  const created = await tryCreateEmailEvent({
    orderId: order.id,
    type: "RECEIPT_PAID",
    idempotencyKey: key,
    toEmail: to,
    subject: "Payment received",
  });

  if (!created.created || !created.eventId) return;

  try {
    const result = await sendOrderUpdateEmail({
      to,
      orderId: order.id,
      status: "PAID",
      channel: "receipt",
      amountTotalPennies: Number(order.amountTotal) || 0,
      customerName: order.customerName ?? null,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      items: (order.items || []).map((it) => ({
        name: it.name,
        quantity: it.quantity,
        unitPricePennies: it.unitPrice,
        lineTotalPennies: it.lineTotal,
      })),
    });

    await markEmailEventSent(created.eventId, (result as any)?.providerMessageId ?? null);
  } catch (e: any) {
    const msg = String(e?.response?.body || e?.message || e || "email_failed");
    await markEmailEventFailed(created.eventId, msg);
    console.error("Webhook: receipt paid email failed", msg);
  }
}

/**
 * ✅ Marks PAID once, decrements stock once.
 * ✅ Writes cogsPennies + postageCostPennies + affiliateCommissionPennies
 */
async function markPaidAndDecrementOnce(params: {
  orderId: string;
  stripeSessionId?: string | null;
  paymentIntentId?: string | null;
  currency?: string | null;
  amountTotal?: number | null;
  trackingEmail?: string | null;
  receiptEmail?: string | null;
  name?: string | null;
  company?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postcode?: string | null;
  country?: string | null;
  safePlace?: string | null;
  deliveryNotes?: string | null;
  userIdToConnect?: string | null;
  shippingChargedPennies?: number | null;
  affiliateCode?: string | null;
  itemsToCreate?: Array<{
    productId: string | null;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    unitCostPennies?: number | null;
  }>;
}) {
  let transitioned = false;

  const order = await prisma.$transaction(async (tx) => {
    const fresh = await tx.order.findUnique({
      where: { id: params.orderId },
      include: { items: true },
    });
    if (!fresh) throw new Error("Order not found");

    // Create items if missing (rare)
    if ((!fresh.items || fresh.items.length === 0) && params.itemsToCreate?.length) {
      await tx.order.update({
        where: { id: fresh.id },
        data: {
          items: {
            create: params.itemsToCreate.map((it) => ({
              productId: it.productId,
              name: it.name,
              unitPrice: it.unitPrice,
              quantity: it.quantity,
              lineTotal: it.lineTotal,
              unitCostPennies: typeof it.unitCostPennies === "number" ? it.unitCostPennies : null,
            })),
          },
        },
      });
    }

    // Attach affiliate if missing + we have code
    if (!(fresh as any).affiliateId && clean(params.affiliateCode)) {
      const a = await (tx as any).affiliate.findUnique({
        where: { code: clean(params.affiliateCode) },
        select: { id: true, code: true, defaultRateBps: true, isActive: true, status: true },
      });

      const ok = a && a.isActive && String(a.status || "").toUpperCase() === "APPROVED";
      if (ok) {
        await tx.order.update({
          where: { id: fresh.id },
          data: {
            affiliateId: a.id,
            affiliateCode: a.code,
            affiliateRateBpsSnapshot: typeof a.defaultRateBps === "number" ? a.defaultRateBps : 0,
          } as any,
        });
      }
    }

    const withItems = await tx.order.findUnique({
      where: { id: fresh.id },
      include: { items: true },
    });
    if (!withItems) throw new Error("Order vanished");

    // Backfill unitCostPennies if needed
    const missingCost = (withItems.items || []).filter((it: any) => it.productId && it.unitCostPennies == null);
    if (missingCost.length > 0) {
      const ids = Array.from(new Set(missingCost.map((it: any) => it.productId)));
      const products = await tx.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, costPennies: true },
      });

      const map = new Map<string, number | null>();
      for (const p of products) map.set(p.id, typeof p.costPennies === "number" ? p.costPennies : null);

      for (const it of missingCost) {
        await tx.orderItem.update({
          where: { id: it.id },
          data: { unitCostPennies: map.get(it.productId ?? "") ?? null },
        });
      }
    }

    const afterCosts = await tx.order.findUnique({
      where: { id: withItems.id },
      include: { items: true },
    });
    if (!afterCosts) throw new Error("Order vanished (after costs)");

    const alreadySettled = isPaymentSettled(afterCosts.status);
    const alreadyDeducted = Boolean((afterCosts as any).stockDeducted);

    const cogsPennies = calcCogsPennies(
      (afterCosts.items || []).map((it: any) => ({ quantity: it.quantity, unitCostPennies: it.unitCostPennies }))
    );

    const shippingCharged =
      typeof params.shippingChargedPennies === "number"
        ? params.shippingChargedPennies
        : (afterCosts as any).shippingChargedPennies ?? 0;

    const postageExisting = toInt((afterCosts as any).postageCostPennies, 0);
    const postageCostPennies =
      postageExisting > 0 ? postageExisting : await calcPostageCostPenniesForOrder(tx as any, afterCosts.id);

    // Commission snapshot if needed
    let commissionToSet: number | null = null;
    let rateToSet: number | null = null;

    const hasAffiliate = Boolean((afterCosts as any).affiliateId);
    const commissionAlready = toInt((afterCosts as any).affiliateCommissionPennies, 0);

    if (hasAffiliate && commissionAlready <= 0) {
      let rateBps = toInt((afterCosts as any).affiliateRateBpsSnapshot, 0);

      if (rateBps <= 0) {
        const aff = await (tx as any).affiliate.findUnique({
          where: { id: (afterCosts as any).affiliateId },
          select: { defaultRateBps: true, isActive: true, status: true },
        });

        const ok = aff && (aff as any).isActive && String((aff as any).status || "").toUpperCase() === "APPROVED";
        rateBps = ok ? toInt((aff as any).defaultRateBps, 0) : 0;
        rateToSet = rateBps;
      }

      const amount =
        (params.amountTotal ?? 0) > 0 ? (params.amountTotal as number) : (afterCosts as any).amountTotal ?? 0;

      commissionToSet = calcAffiliateCommissionPennies({
        amountTotalPennies: amount,
        shippingChargedPennies: toInt(shippingCharged, 0),
        rateBps,
      });
    }

    // If already settled & deducted, only backfill snapshots
    if (alreadySettled && alreadyDeducted) {
      return tx.order.update({
        where: { id: afterCosts.id },
        data: {
          ...(typeof params.shippingChargedPennies === "number"
            ? { shippingChargedPennies: params.shippingChargedPennies }
            : {}),
          cogsPennies,
          postageCostPennies,
          ...(commissionToSet != null ? { affiliateCommissionPennies: commissionToSet } : {}),
          ...(rateToSet != null ? { affiliateRateBpsSnapshot: rateToSet } : {}),
        } as any,
        include: { items: true },
      });
    }

    // Stock decrement once
    if (!alreadyDeducted) {
      for (const it of afterCosts.items) {
        if (!it.productId) continue;

        const p = await tx.product.findUnique({
          where: { id: it.productId },
          select: { stock: true, name: true },
        });
        if (!p) continue;

        if (it.quantity > p.stock) throw new Error(`Insufficient stock for ${p.name} (${it.productId})`);

        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.quantity } },
        });
      }
    }

    const updated = await tx.order.update({
      where: { id: afterCosts.id },
      data: {
        stripeSessionId: params.stripeSessionId ?? (afterCosts as any).stripeSessionId ?? undefined,
        paymentIntentId: params.paymentIntentId ?? (afterCosts as any).paymentIntentId ?? undefined,

        currency: (params.currency ?? (afterCosts as any).currency ?? "gbp").toLowerCase(),
        amountTotal: (params.amountTotal ?? 0) > 0 ? (params.amountTotal as number) : (afterCosts as any).amountTotal,

        ...(clean(params.trackingEmail) ? { email: clean(params.trackingEmail) } : {}),
        ...(clean(params.receiptEmail) ? { receiptEmail: clean(params.receiptEmail) } : {}),

        name: params.name ?? (afterCosts as any).name ?? undefined,
        company: params.company ?? (afterCosts as any).company ?? undefined,
        phone: params.phone ?? (afterCosts as any).phone ?? undefined,

        addressLine1: params.addressLine1 ?? (afterCosts as any).addressLine1 ?? undefined,
        addressLine2: params.addressLine2 ?? (afterCosts as any).addressLine2 ?? undefined,
        city: params.city ?? (afterCosts as any).city ?? undefined,
        postcode: params.postcode ?? (afterCosts as any).postcode ?? undefined,
        country: params.country ?? (afterCosts as any).country ?? undefined,

        safePlace: params.safePlace ?? (afterCosts as any).safePlace ?? undefined,
        deliveryNotes: params.deliveryNotes ?? (afterCosts as any).deliveryNotes ?? undefined,

        ...(typeof params.shippingChargedPennies === "number"
          ? { shippingChargedPennies: params.shippingChargedPennies }
          : {}),

        cogsPennies,
        postageCostPennies,
        ...(commissionToSet != null ? { affiliateCommissionPennies: commissionToSet } : {}),
        ...(rateToSet != null ? { affiliateRateBpsSnapshot: rateToSet } : {}),

        status: "PAID",
        stockDeducted: true,

        ...(params.userIdToConnect ? { user: { connect: { id: params.userIdToConnect } } } : {}),
      } as any,
      include: { items: true },
    });

    transitioned = !alreadySettled;
    return updated;
  });

  if (transitioned) {
    await tryCreateOrderEvent({
      orderId: (order as any).id,
      type: "ORDER_MARKED_PAID",
      source: "stripe",
      idempotencyKey: `order:${(order as any).id}:paid_transition`,
      summary: "Order marked PAID + stock deducted",
      data: {
        orderId: (order as any).id,
        stripeSessionId: (order as any).stripeSessionId ?? null,
        paymentIntentId: (order as any).paymentIntentId ?? null,
        amountTotal: (order as any).amountTotal ?? 0,
        currency: (order as any).currency ?? null,
        shippingChargedPennies: (order as any).shippingChargedPennies ?? null,
        cogsPennies: (order as any).cogsPennies ?? null,
        postageCostPennies: (order as any).postageCostPennies ?? null,
        affiliateId: (order as any).affiliateId ?? null,
        affiliateCode: (order as any).affiliateCode ?? null,
        affiliateRateBpsSnapshot: (order as any).affiliateRateBpsSnapshot ?? null,
        affiliateCommissionPennies: (order as any).affiliateCommissionPennies ?? null,
      },
    });

    await sendReceiptPaidEmailOnce({
      id: (order as any).id,
      receiptEmail: (order as any).receiptEmail ?? null,
      amountTotal: (order as any).amountTotal ?? 0,
      paymentIntentId: (order as any).paymentIntentId ?? null,
      customerName: (order as any).name ?? null,
      items: ((order as any).items || []).map((it: any) => ({
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
      })),
    });

    // Credit affiliate wallet if commission earned
    const commissionPennies = toInt((order as any).affiliateCommissionPennies, 0);
    const affiliateId = (order as any).affiliateId ?? null;

    if (commissionPennies > 0 && affiliateId) {
      try {
        const availableAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Ensure wallet exists
        const wallet = await prisma.affiliateWallet.upsert({
          where: { affiliateId },
          create: { affiliateId, pendingPennies: 0, availablePennies: 0 },
          update: {},
        });

        // Create transaction and update wallet
        await prisma.$transaction([
          prisma.affiliateTransaction.create({
            data: {
              walletId: wallet.id,
              affiliateId,
              type: "COMMISSION",
              status: "PENDING",
              amountPennies: commissionPennies,
              orderId: (order as any).id,
              orderRef: (order as any).orderRef ?? null,
              availableAt,
              note: `Commission on order ${(order as any).orderRef ?? (order as any).id}`,
            },
          }),
          prisma.affiliateWallet.update({
            where: { id: wallet.id },
            data: { pendingPennies: { increment: commissionPennies } },
          }),
        ]);
      } catch (e) {
        console.error("Failed to credit affiliate wallet:", e);
      }
    }
  }

  return { order, transitioned };
}

/** Prefer matching by: stripeSessionId -> paymentIntentId -> orderId */
async function findOrder(params: { orderId?: string; stripeSessionId?: string; paymentIntentId?: string | null }) {
  const { orderId, stripeSessionId, paymentIntentId } = params;

  if (stripeSessionId) {
    const bySession = await prisma.order
      .findUnique({ where: { stripeSessionId }, include: { items: true } })
      .catch(() => null);
    if (bySession) return bySession;
  }

  if (paymentIntentId) {
    const byPi = await prisma.order
      .findFirst({ where: { paymentIntentId }, include: { items: true } })
      .catch(() => null);
    if (byPi) return byPi;
  }

  if (orderId) {
    const byId = await prisma.order
      .findUnique({ where: { id: orderId }, include: { items: true } })
      .catch(() => null);
    if (byId) return byId;
  }

  return null;
}

async function readRawBody(req: Request) {
  const ab = await req.arrayBuffer();
  return Buffer.from(ab);
}

/** ---------------- Route ---------------- */
export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    // ✅ quick visibility in logs
    console.log("✅ STRIPE WEBHOOK HIT", new Date().toISOString());

    const sig = req.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

    const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");
    const raw = await readRawBody(req);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err?.message || err);
      return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
    }

    const allowed = new Set<string>([
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "checkout.session.expired",
      "payment_intent.succeeded",
    ]);

    if (!allowed.has(event.type)) {
      return NextResponse.json({ received: true, ignored: true, type: event.type }, { status: 200 });
    }

    // Log event ASAP (where possible)
    // (We create OrderEvent later once we know the orderId)

    /** ---------- payment_intent.succeeded ---------- */
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;

      const paymentIntentId = clean(pi.id) || null;
      const piMeta = (pi.metadata ?? {}) as Record<string, unknown>;
      const orderIdFromPiMeta = clean(piMeta.orderId) || null;

      const existing = await findOrder({ paymentIntentId, orderId: orderIdFromPiMeta || undefined });
      if (!existing) {
        return NextResponse.json({ received: true, ignored: true, reason: "no_order_for_pi" }, { status: 200 });
      }

      await tryCreateOrderEvent({
        orderId: existing.id,
        type: stripeEventTypeToOrderEventType(event.type),
        source: "stripe",
        idempotencyKey: `stripe:${event.id}`,
        summary: stripeEventSummary(event.type),
        data: { stripeEventId: event.id, paymentIntentId, orderIdFromPiMeta },
      });

      if (isPaymentSettled(existing.status)) {
        return NextResponse.json({ received: true, ok: true, alreadySettled: true }, { status: 200 });
      }

      const res = await markPaidAndDecrementOnce({
        orderId: existing.id,
        paymentIntentId,
        amountTotal: toInt(pi.amount_received ?? pi.amount ?? 0, 0),
        currency: clean(pi.currency) || (existing as any).currency || "gbp",
        shippingChargedPennies: toInt((existing as any).shippingChargedPennies, 0),
        trackingEmail: (existing as any).email ?? null,
        receiptEmail: (existing as any).receiptEmail ?? null,
        name: (existing as any).name ?? null,
        company: (existing as any).company ?? null,
        phone: (existing as any).phone ?? null,
        addressLine1: (existing as any).addressLine1 ?? null,
        addressLine2: (existing as any).addressLine2 ?? null,
        city: (existing as any).city ?? null,
        postcode: (existing as any).postcode ?? null,
        country: (existing as any).country ?? null,
        safePlace: (existing as any).safePlace ?? null,
        deliveryNotes: (existing as any).deliveryNotes ?? null,
        affiliateCode: (existing as any).affiliateCode ?? null,
      });

      return NextResponse.json(
        { received: true, ok: true, paid: true, transitioned: res.transitioned, ms: Date.now() - startedAt },
        { status: 200 }
      );
    }

    /** ---------- checkout.session.* ---------- */
    const session = event.data.object as Stripe.Checkout.Session;

    const stripeSessionId = clean(session.id);
    const paymentIntentId = getPaymentIntentIdFromSession(session);
    const desiredStatus = desiredStatusFromCheckoutEvent(event.type, session);

    const meta = extractMeta(session);
    const addr = extractAddress(session);

    const stripeEmail = extractStripeEmail(session);
    const trackingEmail = meta.trackingEmail || meta.legacyEmail || null;
    const receiptEmail = stripeEmail || meta.receiptEmail || meta.payerEmail || null;

    const name = meta.name || extractStripeName(session) || null;
    const phone = meta.phone || extractStripePhone(session) || null;
    const company = meta.company || null;

    const currency = (session.currency ?? "gbp").toLowerCase();
    const amountTotal = toInt(session.amount_total, 0);
    const shippingChargedPennies = extractShippingChargedPennies(session);

    const clientRef = clean(session.client_reference_id);
    const orderIdHint = meta.orderId || clientRef || "";

    const existing = await findOrder({
      orderId: orderIdHint || undefined,
      stripeSessionId: stripeSessionId || undefined,
      paymentIntentId,
    });

    // Can't map -> ignore
    const hasOurIdentity = !!(meta.orderId || meta.orderRef || clientRef || stripeSessionId);
    if (!existing && !hasOurIdentity) {
      return NextResponse.json(
        { received: true, ignored: true, reason: "missing_identity", type: event.type },
        { status: 200 }
      );
    }

    const userLookupEmail = receiptEmail || meta.payerEmail || null;
    const user = userLookupEmail
      ? await prisma.user.findUnique({ where: { email: userLookupEmail } }).catch(() => null)
      : null;

    if (existing) {
      await tryCreateOrderEvent({
        orderId: existing.id,
        type: stripeEventTypeToOrderEventType(event.type),
        source: "stripe",
        idempotencyKey: `stripe:${event.id}`,
        summary: stripeEventSummary(event.type),
        data: {
          stripeEventId: event.id,
          stripeEventType: event.type,
          stripeSessionId,
          paymentIntentId,
          paymentStatus: session.payment_status ?? null,
          amountTotal: session.amount_total ?? null,
          currency: session.currency ?? null,
          shippingChargedPennies,
        },
      });

      // Safe detail update
      await prisma.order.update({
        where: { id: existing.id },
        data: {
          stripeSessionId: (existing as any).stripeSessionId ?? stripeSessionId,
          paymentIntentId: paymentIntentId ?? (existing as any).paymentIntentId ?? undefined,

          ...(clean(trackingEmail) ? { email: clean(trackingEmail) } : {}),
          ...(clean(receiptEmail) ? { receiptEmail: clean(receiptEmail) } : {}),

          name: name ?? (existing as any).name ?? undefined,
          company: company ?? (existing as any).company ?? undefined,
          phone: phone ?? (existing as any).phone ?? undefined,

          addressLine1: addr.addressLine1 ?? (existing as any).addressLine1 ?? undefined,
          addressLine2: addr.addressLine2 ?? (existing as any).addressLine2 ?? undefined,
          city: addr.city ?? (existing as any).city ?? undefined,
          postcode: addr.postcode ?? (existing as any).postcode ?? undefined,
          country: addr.country ?? (existing as any).country ?? undefined,

          safePlace: meta.safePlace ?? (existing as any).safePlace ?? undefined,
          deliveryNotes: meta.deliveryNotes ?? (existing as any).deliveryNotes ?? undefined,

          shippingChargedPennies,
          ...(user?.id ? { user: { connect: { id: user.id } } } : {}),
        } as any,
      });

      if (desiredStatus === "PAID") {
        const needsItems = !existing.items || existing.items.length === 0;
        const itemsToCreate = needsItems ? await buildItemsFromSession(stripeSessionId) : undefined;

        const res = await markPaidAndDecrementOnce({
          orderId: existing.id,
          stripeSessionId,
          paymentIntentId,
          trackingEmail: trackingEmail ?? (existing as any).email ?? null,
          receiptEmail: receiptEmail ?? (existing as any).receiptEmail ?? null,
          currency,
          amountTotal,
          shippingChargedPennies,
          affiliateCode: meta.affiliateCode ?? (existing as any).affiliateCode ?? null,
          name,
          company,
          phone,
          ...addr,
          safePlace: meta.safePlace,
          deliveryNotes: meta.deliveryNotes,
          userIdToConnect: user?.id ?? null,
          itemsToCreate: itemsToCreate?.map((it) => ({
            productId: it.productId,
            name: it.name,
            unitPrice: it.unitPrice,
            quantity: it.quantity,
            lineTotal: it.lineTotal,
            unitCostPennies: it.unitCostPennies ?? null,
          })),
        });

        return NextResponse.json(
          { received: true, ok: true, paid: true, transitioned: res.transitioned, ms: Date.now() - startedAt },
          { status: 200 }
        );
      }

      // FAILED/CANCELLED should not overwrite settled orders
      if (desiredStatus === "FAILED" || desiredStatus === "CANCELLED") {
        const latest = await prisma.order.findUnique({ where: { id: existing.id } });
        const alreadySettled = isPaymentSettled(latest?.status);

        if (!alreadySettled) {
          await prisma.order.update({ where: { id: existing.id }, data: { status: desiredStatus } });
        }

        return NextResponse.json(
          { received: true, ok: true, status: desiredStatus, ignored: alreadySettled, ms: Date.now() - startedAt },
          { status: 200 }
        );
      }

      // PENDING: do not downgrade
      if (desiredStatus === "PENDING") {
        const latest = await prisma.order.findUnique({ where: { id: existing.id } });
        if (!isPaymentSettled(latest?.status)) {
          await prisma.order.update({ where: { id: existing.id }, data: { status: "PENDING" } });
        }
      }

      return NextResponse.json({ received: true, ok: true, status: desiredStatus, ms: Date.now() - startedAt }, { status: 200 });
    }

    // No existing order: create from Checkout (rare)
    const itemsToCreate = await buildItemsFromSession(stripeSessionId);
    const initialStatus: OrderStatus = desiredStatus === "PAID" ? "PENDING" : desiredStatus;

    const created = await prisma.order.create({
      data: {
        orderRef: meta.orderRef || `SL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        stripeSessionId,
        paymentIntentId: paymentIntentId ?? undefined,

        ...(clean(trackingEmail) ? { email: clean(trackingEmail) } : {}),
        ...(clean(receiptEmail) ? { receiptEmail: clean(receiptEmail) } : {}),

        currency,
        amountTotal,
        status: initialStatus,
        shippingChargedPennies,

        name: name ?? undefined,
        company: company ?? undefined,
        phone: phone ?? undefined,

        addressLine1: addr.addressLine1 ?? undefined,
        addressLine2: addr.addressLine2 ?? undefined,
        city: addr.city ?? undefined,
        postcode: addr.postcode ?? undefined,
        country: addr.country ?? undefined,

        safePlace: meta.safePlace ?? undefined,
        deliveryNotes: meta.deliveryNotes ?? undefined,

        ...(user?.id ? { user: { connect: { id: user.id } } } : {}),

        items: {
          create: itemsToCreate.map((it) => ({
            productId: it.productId,
            name: it.name,
            unitPrice: it.unitPrice,
            quantity: it.quantity,
            lineTotal: it.lineTotal,
            unitCostPennies: typeof it.unitCostPennies === "number" ? it.unitCostPennies : null,
          })),
        },
      } as any,
      include: { items: true },
    });

    await tryCreateOrderEvent({
      orderId: created.id,
      type: "ORDER_CREATED_FROM_WEBHOOK",
      source: "stripe",
      idempotencyKey: `order:${created.id}:created_from_webhook`,
      summary: "Order created from Stripe webhook",
      data: { stripeEventId: event.id, stripeEventType: event.type, stripeSessionId, paymentIntentId, desiredStatus },
    });

    await tryCreateOrderEvent({
      orderId: created.id,
      type: stripeEventTypeToOrderEventType(event.type),
      source: "stripe",
      idempotencyKey: `stripe:${event.id}`,
      summary: stripeEventSummary(event.type),
      data: {
        stripeEventId: event.id,
        stripeEventType: event.type,
        stripeSessionId,
        paymentIntentId,
        paymentStatus: session.payment_status ?? null,
        amountTotal: session.amount_total ?? null,
        currency: session.currency ?? null,
        shippingChargedPennies,
      },
    });

    if (desiredStatus === "PAID") {
      await markPaidAndDecrementOnce({
        orderId: created.id,
        stripeSessionId,
        paymentIntentId,
        trackingEmail,
        receiptEmail,
        currency,
        amountTotal,
        shippingChargedPennies,
        affiliateCode: meta.affiliateCode ?? null,
        name,
        company,
        phone,
        ...addr,
        safePlace: meta.safePlace,
        deliveryNotes: meta.deliveryNotes,
        userIdToConnect: user?.id ?? null,
      });
    } else {
      await prisma.order.update({ where: { id: created.id }, data: { status: desiredStatus } });
    }

    return NextResponse.json(
      { received: true, created: true, status: desiredStatus, ms: Date.now() - startedAt },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Webhook fatal error:", err);
    return NextResponse.json({ error: err?.message || "Webhook handler failed" }, { status: 500 });
  }
}