// app/api/admin/orders/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendOrderUpdateEmail } from "@/lib/orderEmail";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ---------- helpers ---------- */
const ALLOWED_STATUSES = [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "CANCELLED",
  "REFUNDED",
  "FAILED",
] as const;

type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function cleanStatus(v: unknown): AllowedStatus | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const s = v.trim().toUpperCase();
  if (!s) return undefined;
  return (ALLOWED_STATUSES as readonly string[]).includes(s) ? (s as AllowedStatus) : undefined;
}

function isUniqueViolation(err: any) {
  return err?.code === "P2002" || /unique constraint/i.test(String(err?.message || ""));
}

function stableStringify(obj: any) {
  const seen = new WeakSet();
  const sorter = (value: any): any => {
    if (!value || typeof value !== "object") return value;
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    if (Array.isArray(value)) return value.map(sorter);
    return Object.keys(value)
      .sort()
      .reduce((acc: any, k) => {
        acc[k] = sorter(value[k]);
        return acc;
      }, {});
  };
  return JSON.stringify(sorter(obj));
}

function makeHash(input: any) {
  const s = stableStringify(input);
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);
}

function safeJsonString(obj: unknown, maxLen = 50_000): string | null {
  try {
    const s = JSON.stringify(obj);
    if (!s) return null;
    return s.length > maxLen ? s.slice(0, maxLen) : s;
  } catch {
    return null;
  }
}

/**
 * Optional int parser:
 * - undefined / null / "" => undefined (means "do not update")
 * - must be finite integer >= 0 if provided
 */
function parseOptionalNonNegInt(v: unknown, fieldName = "value"): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string" && v.trim() === "") return undefined;

  const n = typeof v === "number" ? v : Number(String(v));
  if (!Number.isFinite(n)) throw new Error(`${fieldName} must be a number`);
  if (!Number.isInteger(n)) throw new Error(`${fieldName} must be an integer`);
  if (n < 0) throw new Error(`${fieldName} must be >= 0`);
  return n;
}

/**
 * Normalise actions coming from your admin UI.
 * Supports:
 * - save
 * - markProcessing
 * - markShipped
 * - resendReceipt
 * - resendShipped
 * And also existing variants: RESEND_RECEIPT / RESEND_SHIPPED etc
 */
function normalizeAction(v: unknown) {
  const raw = clean(v);
  if (!raw) return "";

  // common camelCase from your UI
  if (raw === "save") return "SAVE";
  if (raw === "markProcessing") return "MARK_PROCESSING";
  if (raw === "markShipped") return "MARK_SHIPPED";
  if (raw === "resendReceipt") return "RESEND_RECEIPT";
  if (raw === "resendShipped") return "RESEND_SHIPPED";

  // allow hyphen/space/underscore variants
  const u = raw.replace(/[\s-]/g, "_").toUpperCase();

  if (u === "RESEND_RECEIPT") return "RESEND_RECEIPT";
  if (u === "RESEND_SHIPPED") return "RESEND_SHIPPED";

  // handle MARKPROCESSING / MARK_PROCESSING
  if (u === "MARKPROCESSING" || u === "MARK_PROCESSING") return "MARK_PROCESSING";
  if (u === "MARKSHIPPED" || u === "MARK_SHIPPED") return "MARK_SHIPPED";
  if (u === "SAVE") return "SAVE";

  return u;
}

function hasTracking(trackingNo?: string | null, trackingUrl?: string | null) {
  return !!(clean(trackingNo) || clean(trackingUrl));
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session as any)?.user?.role;
  if (!session?.user || role !== "ADMIN") return null;
  return session;
}

async function logOrderEvent(args: {
  orderId: string;
  type: string;
  source: "admin" | "app" | "stripe";
  summary?: string | null;
  data?: unknown;
  idempotencyKey: string;
}) {
  const { orderId, type, source, summary = null, data, idempotencyKey } = args;

  try {
    await prisma.orderEvent.create({
      data: {
        orderId,
        type,
        source,
        summary,
        data: data === undefined ? null : safeJsonString(data),
        idempotencyKey,
      },
      select: { id: true },
    });
  } catch (e: any) {
    if (isUniqueViolation(e)) return; // ignore dup
    throw e;
  }
}

/** EmailEvent helpers (idempotent sends) */
async function tryCreateEmailEvent(params: {
  orderId: string;
  type: string;
  idempotencyKey: string;
  toEmail: string;
  subject?: string | null;
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
    if (isUniqueViolation(e)) return { created: false as const, eventId: null as any };
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

async function sendReceiptOnce(order: any, reqHash: string, force = false) {
  const to = clean(order.receiptEmail);
  if (!to) return { attempted: false, sent: false, reason: "no_receipt_email" as const };

  const keyBase = `order:${order.id}:receipt_paid`;
  const key = force ? `${keyBase}:force:${reqHash}` : keyBase;

  const created = await tryCreateEmailEvent({
    orderId: order.id,
    type: "RECEIPT_PAID",
    idempotencyKey: key,
    toEmail: to,
    subject: "Payment received",
  });

  if (!created.created || !created.eventId) {
    return { attempted: false, sent: false, reason: "already_sent_or_inflight" as const };
  }

  try {
    const result = await sendOrderUpdateEmail({
      to,
      orderId: order.id,
      status: "PAID",
      channel: "receipt",
      amountTotalPennies: Number(order.amountTotal) || 0,
      customerName: order.name ?? null,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      items: (order.items || []).map((it: any) => ({
        name: it.name,
        quantity: it.quantity,
        unitPricePennies: it.unitPrice,
        lineTotalPennies: it.lineTotal,
      })),
    });

    await markEmailEventSent(created.eventId, (result as any)?.providerMessageId ?? null);
    return { attempted: true, sent: true, reason: "sent" as const };
  } catch (e: any) {
    const msg = String(e?.response?.body || e?.message || e || "email_failed");
    await markEmailEventFailed(created.eventId, msg);
    return { attempted: true, sent: false, reason: "failed" as const, error: msg };
  }
}

async function sendShippedOnce(order: any, reqHash: string, force = false) {
  const to = clean(order.email);
  if (!to) return { attempted: false, sent: false, reason: "no_fulfilment_email" as const };

  const trackingNo = clean(order.trackingNo);
  const trackingUrl = clean(order.trackingUrl);

  if (!hasTracking(trackingNo, trackingUrl)) {
    return { attempted: false, sent: false, reason: "missing_tracking" as const };
  }

  const keyBase = `order:${order.id}:shipped:${trackingNo || "-"}:${trackingUrl || "-"}`;
  const key = force ? `${keyBase}:force:${reqHash}` : keyBase;

  const created = await tryCreateEmailEvent({
    orderId: order.id,
    type: "FULFILMENT_SHIPPED",
    idempotencyKey: key,
    toEmail: to,
    subject: "Shipped",
  });

  if (!created.created || !created.eventId) {
    return { attempted: false, sent: false, reason: "already_sent_or_inflight" as const };
  }

  try {
    const result = await sendOrderUpdateEmail({
      to,
      orderId: order.id,
      status: "SHIPPED",
      channel: "fulfilment",
      trackingNo: trackingNo || null,
      trackingUrl: trackingUrl || null,
      amountTotalPennies: Number(order.amountTotal) || 0,
      customerName: order.name ?? null,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      items: (order.items || []).map((it: any) => ({
        name: it.name,
        quantity: it.quantity,
        unitPricePennies: it.unitPrice,
        lineTotalPennies: it.lineTotal,
      })),
    });

    await markEmailEventSent(created.eventId, (result as any)?.providerMessageId ?? null);
    return { attempted: true, sent: true, reason: "sent" as const };
  } catch (e: any) {
    const msg = String(e?.response?.body || e?.message || e || "email_failed");
    await markEmailEventFailed(created.eventId, msg);
    return { attempted: true, sent: false, reason: "failed" as const, error: msg };
  }
}

async function fetchOrderSnapshot(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      events: { orderBy: { createdAt: "desc" }, take: 100 },
      emailEvents: { orderBy: { createdAt: "desc" }, take: 50 },
      items: { orderBy: { createdAt: "asc" } },
    },
  });
}

/** ---------- GET (debug) ---------- */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: orderId } = await ctx.params;
  if (!orderId) return NextResponse.json({ error: "Missing order id" }, { status: 400 });

  const order = await fetchOrderSnapshot(orderId);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, order });
}

/** ---------- PATCH ---------- */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = {
    id: (session as any)?.user?.id ?? null,
    email: (session as any)?.user?.email ?? null,
    name: (session as any)?.user?.name ?? null,
    role: (session as any)?.user?.role ?? "ADMIN",
  };

  const { id: orderId } = await ctx.params;
  if (!orderId) return NextResponse.json({ error: "Missing order id" }, { status: 400 });

  const body = await req.json().catch(() => ({} as any));

  // status + action
  let nextStatus = cleanStatus(body.status);
  const action = normalizeAction(body.action);

  // Normalise tracking inputs:
  // - if key is present with null => clear
  // - if key is present with string => set (trimmed) or undefined if empty
  const trackingNo = body.trackingNo === null ? null : clean(body.trackingNo) || undefined;
  const trackingUrl = body.trackingUrl === null ? null : clean(body.trackingUrl) || undefined;

  // ✅ postage cost pennies (optional)
  let postageCostPennies: number | undefined;
  try {
    postageCostPennies = parseOptionalNonNegInt(body.postageCostPennies, "postageCostPennies");
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid postageCostPennies" }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Action can imply a status if status wasn't supplied
  if (!nextStatus) {
    if (action === "MARK_PROCESSING") nextStatus = "PROCESSING";
    if (action === "MARK_SHIPPED") nextStatus = "SHIPPED";
  }

  const updateData: any = {};

  if (nextStatus) updateData.status = nextStatus;
  if (body.trackingNo !== undefined) updateData.trackingNo = trackingNo;
  if (body.trackingUrl !== undefined) updateData.trackingUrl = trackingUrl;

  if (postageCostPennies !== undefined) updateData.postageCostPennies = postageCostPennies;

  const hasUpdate = Object.keys(updateData).length > 0;
  const reqHash = makeHash({ orderId, action, updateData, actor });

  const updated = hasUpdate
    ? await prisma.order.update({
        where: { id: orderId },
        data: updateData,
        include: { items: { orderBy: { createdAt: "asc" } } },
      })
    : existing;

  // Only log an action if something actually happened
  if (hasUpdate || action) {
    await logOrderEvent({
      orderId,
      type: "ADMIN_ACTION",
      source: "admin",
      summary: action ? `Admin action: ${action}` : "Admin update",
      data: { actor, updateData, hasUpdate, action: action || null },
      idempotencyKey: `admin:${orderId}:action:${reqHash}`,
    });
  }

  const beforeStatus = clean(existing.status).toUpperCase();
  const afterStatus = clean(updated.status).toUpperCase();

  if (hasUpdate && nextStatus && beforeStatus !== afterStatus) {
    await logOrderEvent({
      orderId,
      type: "ADMIN_STATUS_CHANGED",
      source: "admin",
      summary: `${beforeStatus || "—"} → ${afterStatus || "—"}`,
      data: { actor, from: beforeStatus || null, to: afterStatus || null },
      idempotencyKey: `admin:${orderId}:status:${reqHash}`,
    });
  }

  if (body.trackingNo !== undefined && clean(existing.trackingNo) !== clean(updated.trackingNo)) {
    await logOrderEvent({
      orderId,
      type: "ADMIN_TRACKING_UPDATED",
      source: "admin",
      summary: updated.trackingNo ? `Tracking set: ${updated.trackingNo}` : "Tracking cleared",
      data: { actor, from: existing.trackingNo ?? null, to: updated.trackingNo ?? null },
      idempotencyKey: `admin:${orderId}:trackingNo:${reqHash}`,
    });
  }

  if (body.trackingUrl !== undefined && clean(existing.trackingUrl) !== clean(updated.trackingUrl)) {
    await logOrderEvent({
      orderId,
      type: "ADMIN_TRACKING_UPDATED",
      source: "admin",
      summary: updated.trackingUrl ? "Tracking URL set" : "Tracking URL cleared",
      data: { actor, from: existing.trackingUrl ?? null, to: updated.trackingUrl ?? null },
      idempotencyKey: `admin:${orderId}:trackingUrl:${reqHash}`,
    });
  }

  if (postageCostPennies !== undefined) {
    const before = (existing as any).postageCostPennies ?? null;
    const after = (updated as any).postageCostPennies ?? null;
    if (before !== after) {
      await logOrderEvent({
        orderId,
        type: "ADMIN_POSTAGE_COST_UPDATED",
        source: "admin",
        summary: `Postage cost set: ${after ?? 0}p`,
        data: { actor, from: before, to: after },
        idempotencyKey: `admin:${orderId}:postageCostPennies:${reqHash}`,
      });
    }
  }

  // ---- EMAIL BEHAVIOUR ----
  // Auto email when we transition into SHIPPED (e.g. Save status -> SHIPPED)
  let autoEmail: any = { attempted: false };

  if (hasUpdate && nextStatus && afterStatus === "SHIPPED" && beforeStatus !== "SHIPPED") {
    autoEmail = await sendShippedOnce(updated, reqHash, false);

    await logOrderEvent({
      orderId,
      type: "AUTO_SEND_SHIPPED",
      source: "admin",
      summary: autoEmail?.sent
        ? `Sent shipped email to ${clean(updated.email) || "—"}`
        : `Shipped email not sent (${autoEmail?.reason || "unknown"})`,
      data: {
        actor,
        to: clean(updated.email) || null,
        trackingNo: clean(updated.trackingNo) || null,
        trackingUrl: clean(updated.trackingUrl) || null,
        result: autoEmail,
      },
      idempotencyKey: `admin:${orderId}:auto_email_shipped:${reqHash}`,
    });
  }

  let manualEmail: any = { attempted: false };

  if (action === "RESEND_RECEIPT") {
    manualEmail = await sendReceiptOnce(updated, reqHash, true);

    await logOrderEvent({
      orderId,
      type: "ADMIN_RESEND_RECEIPT",
      source: "admin",
      summary: manualEmail?.sent
        ? `Resent receipt email to ${clean(updated.receiptEmail) || "—"}`
        : `Receipt resend not sent (${manualEmail?.reason || "unknown"})`,
      data: { actor, to: clean(updated.receiptEmail) || null, result: manualEmail },
      idempotencyKey: `admin:${orderId}:resend_receipt:${reqHash}`,
    });
  }

  if (action === "RESEND_SHIPPED") {
    manualEmail = await sendShippedOnce(updated, reqHash, true);

    await logOrderEvent({
      orderId,
      type: "ADMIN_RESEND_SHIPPED",
      source: "admin",
      summary: manualEmail?.sent
        ? `Resent shipped email to ${clean(updated.email) || "—"}`
        : `Shipped resend not sent (${manualEmail?.reason || "unknown"})`,
      data: {
        actor,
        to: clean(updated.email) || null,
        trackingNo: clean(updated.trackingNo) || null,
        trackingUrl: clean(updated.trackingUrl) || null,
        result: manualEmail,
      },
      idempotencyKey: `admin:${orderId}:resend_shipped:${reqHash}`,
    });
  }

  // NOTE: Your UI uses action "markShipped" (Mark SHIPPED + Email).
  // In your UI you already require tracking to be present.
  // This route already sends on transition-to-SHIPPED automatically (autoEmail),
  // and supports resendShipped for manual re-send.

  const fresh = await fetchOrderSnapshot(orderId);

  return NextResponse.json({
    ok: true,
    order: fresh,
    email: { auto: autoEmail, manual: manualEmail },
  });
}