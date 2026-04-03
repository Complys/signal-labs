"use client";

import { useMemo, useState } from "react";

type Props = {
  orderId: string;
  status: string;
  receiptEmail: string;
  fulfilmentEmail: string;
  hasTracking: boolean; // computed from SAVED order.trackingNo/trackingUrl
};

type EmailResult = {
  type?: string;
  attempted?: boolean;
  sent?: boolean;
  skippedReason?: string | null;
  warning?: string | null;
  idempotencyKey?: string;
};

async function patchOrder(orderId: string, body: any) {
  const res = await fetch(`/api/admin/orders/${orderId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json;
}

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function canResendReceipt(status: string) {
  const s = String(status || "").toUpperCase();
  return s === "PAID" || s === "PROCESSING" || s === "SHIPPED" || s === "REFUNDED";
}

function pickResult(out: any, kind: "shipped" | "receipt"): EmailResult | null {
  const arr = Array.isArray(out?.emailResults) ? (out.emailResults as EmailResult[]) : [];
  const want = kind === "shipped" ? "SHIPP" : "RECEIPT";
  return arr.find((x) => clean(x?.type).toUpperCase().includes(want)) || arr[0] || null;
}

function formatResult(label: string, r: EmailResult | null) {
  if (!r) return `${label}: done ✅`;
  if (r.sent) return `${label}: sent ✅`;
  if (r.skippedReason) return `${label}: skipped (${r.skippedReason})`;
  if (r.warning) return `${label}: warning (${r.warning})`;
  return `${label}: done ✅`;
}

export default function OrderEmailTools(props: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const statusUpper = useMemo(() => String(props.status || "").toUpperCase(), [props.status]);

  async function run(label: string, kind: "shipped" | "receipt", fn: () => Promise<any>) {
    try {
      setBusy(label);
      setMsg(null);

      const out = await fn();
      const r = pickResult(out, kind);
      setMsg(formatResult(label, r));
    } catch (e: any) {
      setMsg(`${label}: ${e?.message || "failed"}`);
    } finally {
      setBusy(null);
    }
  }

  function copy(text: string) {
    const t = clean(text);
    if (!t) return;
    navigator.clipboard?.writeText(t).then(
      () => setMsg("Copied ✅"),
      () => setMsg("Couldn’t copy")
    );
  }

  const receiptOk = !!clean(props.receiptEmail);
  const fulfilmentOk = !!clean(props.fulfilmentEmail);

  const canResendShipped = fulfilmentOk && statusUpper === "SHIPPED";

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold tracking-wide text-white/45 uppercase">Email tools</div>

      {/* Helper text */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70">
        <div className="font-semibold text-white/80">Heads up</div>
        <ul className="mt-1 list-disc pl-4 space-y-1">
          <li>
            Receipt emails go to <span className="font-mono">{receiptOk ? props.receiptEmail : "—"}</span>
          </li>
          <li>
            Shipped emails go to <span className="font-mono">{fulfilmentOk ? props.fulfilmentEmail : "—"}</span>
          </li>
          <li>
            Shipped emails require tracking saved on the order.{" "}
            {props.hasTracking ? (
              <span className="text-emerald-200 font-semibold">Tracking is saved ✅</span>
            ) : (
              <span className="text-amber-200 font-semibold">
                Tracking not saved yet (type it above and press Save or use “Mark SHIPPED + Email”)
              </span>
            )}
          </li>
        </ul>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          disabled={!receiptOk || !canResendReceipt(statusUpper) || !!busy}
          onClick={() =>
            run("Resend receipt", "receipt", () =>
              patchOrder(props.orderId, { action: "resendReceipt", forceEmail: true })
            )
          }
          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-extrabold hover:bg-white/10 disabled:opacity-40"
          title={
            !receiptOk
              ? "No receipt email on this order"
              : !canResendReceipt(statusUpper)
              ? "Receipt can only be sent when paid"
              : "Resend payment/receipt email"
          }
        >
          {busy === "Resend receipt" ? "Sending…" : "Resend receipt"}
        </button>

        <button
          disabled={!canResendShipped || !!busy}
          onClick={() =>
            run("Resend shipped", "shipped", () =>
              patchOrder(props.orderId, { action: "resendShipped", forceEmail: true })
            )
          }
          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-extrabold hover:bg-white/10 disabled:opacity-40"
          title={
            !fulfilmentOk
              ? "No fulfilment email on this order"
              : statusUpper !== "SHIPPED"
              ? "Order must be SHIPPED"
              : props.hasTracking
              ? "Resend shipped email"
              : "Tracking not saved yet — it will likely be skipped until saved"
          }
        >
          {busy === "Resend shipped" ? "Sending…" : "Resend shipped"}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          disabled={!receiptOk || !!busy}
          onClick={() => copy(props.receiptEmail)}
          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold hover:bg-white/10 disabled:opacity-40"
        >
          Copy receipt email
        </button>

        <button
          disabled={!fulfilmentOk || !!busy}
          onClick={() => copy(props.fulfilmentEmail)}
          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold hover:bg-white/10 disabled:opacity-40"
        >
          Copy fulfilment email
        </button>
      </div>

      {msg ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">{msg}</div>
      ) : (
        <div className="text-xs text-white/45">
          Receipt = payment confirmation • Shipped = fulfilment update (tracking must be saved on the order).
        </div>
      )}
    </div>
  );
}