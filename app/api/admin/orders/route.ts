// app/api/admin/orders/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderUpdateEmail } from "@/lib/orderEmail";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";

export const runtime = "nodejs";

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
type EmailAction = "none" | "resendReceipt" | "resendShipped";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeStatus(v: unknown, fallback: AllowedStatus = "PENDING"): AllowedStatus {
  const s = safeStr(v).toUpperCase();
  return (ALLOWED_STATUSES as readonly string[]).includes(s) ? (s as AllowedStatus) : fallback;
}

function cleanStatus(v: unknown): AllowedStatus | undefined {
  if (v === undefined) return undefined;
  const s = safeStr(v).toUpperCase();
  if (!s) return undefined;
  return (ALLOWED_STATUSES as readonly string[]).includes(s) ? (s as AllowedStatus) : undefined;
}

/**
 * undefined = not provided (don’t change)
 * null = clear
 * string = set
 */
function cleanNullableString(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "string") {
    const s = v.trim();
    return s ? s : null;
  }
  return undefined;
}

function cleanBoolean(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1 ? true : v === 0 ? false : fallback;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "on", "yes", "y"].includes(s)) return true;
    if (["false", "0", "off", "no", "n"].includes(s)) return false;
  }
  return fallback;
}

function isUniqueViolation(err: any) {
  return err?.code === "P2002" || /unique constraint/i.test(String(err?.message || ""));
}

function getSiteUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_URL;

  if (!envUrl) return "http://localhost:3000";
  const u = envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  return u.replace(/\/$/, "");
}

function isPaymentSettled(status: string | null | undefined) {
  const s = String(status || "").toUpperCase();
  return s === "PAID" || s === "PROCESSING" || s === "SHIPPED" || s === "REFUNDED";
}

/**
 * Business rule: admin owns fulfilment states.
 * If you want to enforce “cannot ship unless paid”, keep this on.
 */
function canMoveToFulfilment(next: AllowedStatus, prev: AllowedStatus) {
  const fulfilmentStates: AllowedStatus[] = ["PROCESSING", "SHIPPED"];
  if (!fulfilmentStates.includes(next)) return true;
  return prev === "PAID" || prev === "PROCESSING" || prev === "SHIPPED" || prev === "REFUNDED";
}

/** ---------------- OrderEvent helpers (idempotent) ---------------- */
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

function makeRequestHash(input: any) {
  const s = stableStringify(input);
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);
}

function safeJson(obj: unknown, maxLen = 50_000): string | null {
  try {
    const s = JSON.stringify(obj);
    if (!s) return null;
    return s.length > maxLen ? s.slice(0, maxLen) : s;
  } catch {
    return null;
  }
}

async function tryCreateOrderEvent(args: {
  orderId: string;
  type: string;
  source: "admin" | "app" | "stripe";
  summary?: string | null;
  data?: unknown;
  idempotencyKey: string;
}) {
  try {
    await prisma.orderEvent.create({
      data: {
        orderId: args.orderId,
        type: args.type,
        source: args.source,
        summary: args.summary ?? null,
        data: args.data ? safeJson(args.data) : null,
        idempotencyKey: args.idempotencyKey,
      },
      select: { id: true },
    });
    return { created: true as const };
  } catch (e: any) {
    if (isUniqueViolation(e)) return { created: false as const };
    throw e;
  }
}

/** ---------------- Email event helpers (idempotent + logged) ---------------- */
async function tryCreateEmailEvent(args: {
  orderId: string;
  type: string;
  idempotencyKey: string;
  toEmail: string;
  subject?: string;
}) {
  try {
    const created = await prisma.emailEvent.create({
      data: {
        orderId: args.orderId,
        type: args.type,
        idempotencyKey: args.idempotencyKey,
        status: "PENDING",
        toEmail: args.toEmail,
        subject: args.subject || null,
        provider: "sendgrid",
      },
      select: { id: true },
    });
    return { created: true as const, id: created.id };
  } catch (e: any) {
    if (isUniqueViolation(e)) return { created: false as const, id: null as string | null };
    throw e;
  }
}

async function markEmailEventSent(id: string, providerMessageId?: string | null) {
  await prisma.emailEvent
    .update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        providerMessageId: providerMessageId || null,
        error: null,
      },
    })
    .catch(() => {});
}

async function markEmailEventFailed(id: string, error: unknown) {
  const msg =
    safeStr((error as any)?.response?.body) ||
    safeStr((error as any)?.message) ||
    safeStr(error);

  await prisma.emailEvent
    .update({
      where: { id },
      data: {
        status: "FAILED",
        error: msg ? msg.slice(0, 2000) : "Email failed",
      },
    })
    .catch(() => {});
}

type EmailResult = {
  type: string;
  attempted: boolean;
  sent: boolean;
  skippedReason?: string | null;
  warning?: string | null;
  idempotencyKey?: string;
};

async function sendEmailOnce(opts: {
  orderId: string;
  to: string;
  emailEventType: string; // e.g. RECEIPT_PAID / ORDER_SHIPPED
  baseKey: string; // unique key base, force adds suffix
  force: boolean;
  subject: string;
  // keep this loose so TS won’t explode if sendOrderUpdateEmail’s type differs
  payload: any;
}) {
  const idempotencyKey = opts.force ? `${opts.baseKey}:manual:${Date.now()}` : opts.baseKey;

  const ev = await tryCreateEmailEvent({
    orderId: opts.orderId,
    type: opts.emailEventType,
    idempotencyKey,
    toEmail: opts.to,
    subject: opts.subject,
  });

  if (!ev.created || !ev.id) {
    const r: EmailResult = {
      type: opts.emailEventType,
      attempted: false,
      sent: false,
      skippedReason: "duplicate (already sent / already queued)",
      idempotencyKey,
    };
    return r;
  }

  try {
    const res: any = await sendOrderUpdateEmail(opts.payload);
    const providerMessageId = res?.providerMessageId || res?.messageId || res?.id || null;
    await markEmailEventSent(ev.id, providerMessageId);

    const r: EmailResult = {
      type: opts.emailEventType,
      attempted: true,
      sent: true,
      idempotencyKey,
    };
    return r;
  } catch (e: any) {
    await markEmailEventFailed(ev.id, e);
    const r: EmailResult = {
      type: opts.emailEventType,
      attempted: true,
      sent: false,
      warning: safeStr(e?.message) || "Email failed",
      idempotencyKey,
    };
    return r;
  }
}

function cleanEmailAction(v: unknown): EmailAction {
  const s = String(v ?? "").trim();
  if (!s) return "none";
  if (s === "resendReceipt") return "resendReceipt";
  if (s === "resendShipped") return "resendShipped";
  return "none";
}

/** ---------------- Shared include for timeline ---------------- */
const orderSelectWithTimeline = {
  id: true,
  orderRef: true,
  email: true,
  receiptEmail: true,
  name: true,
  status: true,
  currency: true,
  amountTotal: true,
  trackingNo: true,
  trackingUrl: true,
  paymentIntentId: true,
  items: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      name: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
    },
  },
  events: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      type: true,
      source: true,
      summary: true,
      data: true,
      createdAt: true,
    },
  },
} as const;


export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const q = searchParams.get("q") ?? undefined;

  const orders = await prisma.order.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q } },
              { name: { contains: q } },
              { orderRef: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      orderRef: true,
      email: true,
      name: true,
      status: true,
      amountTotal: true,
      currency: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, orders });
}
