"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "CANCELLED",
  "REFUNDED",
  "FAILED",
] as const;

type Status = (typeof STATUSES)[number];

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeStatus(v: unknown, fallback: Status = "PENDING"): Status {
  const u = clean(v).toUpperCase();
  return (STATUSES as readonly string[]).includes(u) ? (u as Status) : fallback;
}

function hasTracking(trackingNo: string, trackingUrl: string) {
  return Boolean(clean(trackingNo) || clean(trackingUrl));
}

/** ---------- API types (matches your /api/admin/orders/[id] response) ---------- */
type EmailOutcome = {
  attempted?: boolean;
  sent?: boolean;
  reason?: string;
  error?: string;
};

type PatchOk = {
  ok: true;
  order?: {
    id: string;
    status?: string;
    trackingNo?: string | null;
    trackingUrl?: string | null;
    email?: string | null; // fulfilment email
    receiptEmail?: string | null;
  };
  email?: {
    auto?: EmailOutcome;
    manual?: EmailOutcome;
  };
};

type PatchErr = { error: string };
type PatchResponse = PatchOk | PatchErr;

async function patchOrder(orderId: string, payload: any) {
  const res = await fetch(`/api/admin/orders/${orderId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as PatchResponse;

  if (!res.ok) {
    throw new Error((data as any)?.error || `Update failed (${res.status})`);
  }

  return data as PatchOk;
}

function summarizeAfterSave(resp: PatchOk) {
  const a = resp.email?.auto;
  const m = resp.email?.manual;

  // Auto shipped attempt
  if (a?.attempted) {
    if (a.sent) return "Saved + shipped email sent ✅";
    const r = clean(a.reason);
    if (r === "missing_tracking") return "Saved ✅ (shipped email skipped: add tracking to send)";
    if (r === "no_fulfilment_email") return "Saved ✅ (shipped email skipped: missing fulfilment email)";
    if (r === "already_sent_or_inflight") return "Saved ✅ (shipped email already sent)";
    return `Saved ✅ (shipped email not sent: ${r || "failed"})`;
  }

  // Manual resend attempt
  if (m?.attempted) {
    if (m.sent) return "Email sent ✅";
    return `Email not sent: ${clean(m.reason) || "failed"}`;
  }

  return "Saved ✅";
}

export default function OrderAdminActions(props: {
  orderId: string;
  currentStatus: string;
  trackingNo: string;
  trackingUrl: string;
  trackingEmail: string; // Order.email (fulfilment recipient)
  userId?: string | null;
  stripeSessionId?: string | null;
}) {
  const router = useRouter();

  const initialStatus = normalizeStatus(props.currentStatus, "PENDING");

  const [status, setStatus] = useState<Status>(initialStatus);
  const [tn, setTn] = useState(clean(props.trackingNo));
  const [tu, setTu] = useState(clean(props.trackingUrl));

  const fulfilmentEmail = clean(props.trackingEmail);
  const hasFulfilmentEmail = !!fulfilmentEmail;

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isGuest = !props.userId;

  const registerLink = useMemo(() => {
    const redirect = encodeURIComponent("/account");
    const sid = props.stripeSessionId ? encodeURIComponent(props.stripeSessionId) : "";
    return props.stripeSessionId ? `/login?redirect=${redirect}&session_id=${sid}` : `/login?redirect=${redirect}`;
  }, [props.stripeSessionId]);

  const normalizedTrackingNo = clean(tn);
  const normalizedTrackingUrl = clean(tu);
  const trackingOk = hasTracking(normalizedTrackingNo, normalizedTrackingUrl);

  const shippedSelected = status === "SHIPPED";

  function toast(text: string, ms = 2600) {
    setMsg(text);
    window.setTimeout(() => setMsg(null), ms);
  }

  function buildInviteText() {
    const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
    const fullLink = `${origin}${registerLink}`;

    return [
      "Thanks for your order ✅",
      "",
      "If you create an account you can:",
      "• Track your orders",
      "• Save your details for faster checkout",
      "• Earn reward points on future purchases",
      "",
      "Create your account here:",
      fullLink,
    ].join("\n");
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(buildInviteText());
      toast("Invite copied ✅", 1600);
    } catch {
      toast("Couldn’t copy (browser blocked).", 2200);
    }
  }

  async function runPatch(payload: any) {
    setSaving(true);
    setMsg(null);

    try {
      const ok = await patchOrder(props.orderId, payload);

      const savedStatus = ok?.order?.status ? normalizeStatus(ok.order.status, status) : status;
      const savedTn = clean(ok?.order?.trackingNo);
      const savedTu = clean(ok?.order?.trackingUrl);

      setStatus(savedStatus);
      setTn(savedTn);
      setTu(savedTu);

      router.refresh();
      toast(summarizeAfterSave(ok));
    } catch (e: any) {
      toast(e?.message || "Could not save", 3400);
    } finally {
      setSaving(false);
    }
  }

  // ✅ CHANGED: allow SHIPPED even without tracking. Email will just skip.
  async function save() {
    if (status === "SHIPPED" && !hasFulfilmentEmail) {
      toast("This order has no fulfilment email (Order.email). Add one before SHIPPED.");
      return;
    }

    await runPatch({
      action: "save",
      status,
      trackingNo: normalizedTrackingNo ? normalizedTrackingNo : null,
      trackingUrl: normalizedTrackingUrl ? normalizedTrackingUrl : null,
    });
  }

  async function markProcessing() {
    await runPatch({ action: "markProcessing", status: "PROCESSING" });
  }

  // ✅ still requires tracking because this button explicitly means “+ Email”
  async function markShippedAndEmail() {
    if (!trackingOk) return toast("Add tracking number or URL first.");
    if (!hasFulfilmentEmail) return toast("No fulfilment email saved on this order (Order.email).");

    await runPatch({
      action: "markShipped",
      status: "SHIPPED",
      trackingNo: normalizedTrackingNo ? normalizedTrackingNo : null,
      trackingUrl: normalizedTrackingUrl ? normalizedTrackingUrl : null,
    });
  }

  // ✅ still requires tracking because resend explicitly means “send email”
  async function resendShippedEmail() {
    if (!trackingOk) return toast("Add tracking number or URL first.");
    if (!hasFulfilmentEmail) return toast("No fulfilment email saved on this order (Order.email).");

    const ok = window.confirm("Resend the SHIPPED email to the customer again?");
    if (!ok) return;

    await runPatch({
      action: "resendShipped",
      status: "SHIPPED",
      trackingNo: normalizedTrackingNo ? normalizedTrackingNo : null,
      trackingUrl: normalizedTrackingUrl ? normalizedTrackingUrl : null,
    });
  }

  return (
    <div className="grid gap-4">
      {/* Guest / Registered banner */}
      <div
        className={[
          "rounded-2xl border px-4 py-3",
          isGuest ? "border-amber-500/25 bg-amber-500/10" : "border-emerald-500/25 bg-emerald-500/10",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-extrabold">{isGuest ? "Guest checkout" : "Registered user"}</div>

            <div className="mt-1 text-xs text-white/70">
              {hasFulfilmentEmail ? (
                <span className="break-all">
                  Fulfilment (Order.email): <span className="font-semibold text-white">{fulfilmentEmail}</span>
                </span>
              ) : (
                <span className="text-white/60">No fulfilment email recorded (Order.email).</span>
              )}
            </div>

            {isGuest ? (
              <div className="mt-2 text-xs text-white/70">
                Convert them: account = order history, tracking, saved details + reward points.
              </div>
            ) : null}
          </div>

          {isGuest ? (
            <div className="flex flex-col gap-2">
              <Link
                href={registerLink}
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-extrabold hover:bg-white/15"
              >
                Open register link
              </Link>
              <button
                type="button"
                onClick={copyInvite}
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-extrabold hover:bg-white/10"
              >
                Copy invite text
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Status / tracking */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-2">
          <label className="text-xs text-white/60">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(normalizeStatus(e.target.value, status))}
            disabled={saving}
            className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none disabled:opacity-50"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {shippedSelected && !trackingOk ? (
            <div className="text-[11px] text-amber-200/90">
              SHIPPED can be saved without tracking, but the shipped email will be skipped until tracking is saved.
            </div>
          ) : null}

          {shippedSelected && trackingOk && !hasFulfilmentEmail ? (
            <div className="text-[11px] text-amber-200/90">
              SHIPPED requires a fulfilment email on the order (Order.email).
            </div>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label className="text-xs text-white/60">Tracking number</label>
          <input
            value={tn}
            onChange={(e) => setTn(e.target.value)}
            disabled={saving}
            placeholder="e.g. RM123456789GB"
            className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 disabled:opacity-50"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-xs text-white/60">Tracking URL</label>
          <input
            value={tu}
            onChange={(e) => setTu(e.target.value)}
            disabled={saving}
            placeholder="https://..."
            className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={save}
          disabled={saving || (status === "SHIPPED" && !hasFulfilmentEmail)}
          className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-extrabold disabled:opacity-50"
          title={status === "SHIPPED" && !hasFulfilmentEmail ? "Missing fulfilment email (Order.email)" : ""}
        >
          {saving ? "Saving…" : "Save"}
        </button>

        <button
          type="button"
          onClick={markProcessing}
          disabled={saving}
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
        >
          Mark PROCESSING
        </button>

        <button
          type="button"
          onClick={markShippedAndEmail}
          disabled={saving || !trackingOk || !hasFulfilmentEmail}
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
          title={
            !trackingOk
              ? "Add tracking first"
              : !hasFulfilmentEmail
              ? "Missing fulfilment email (Order.email)"
              : ""
          }
        >
          Mark SHIPPED + Email
        </button>

        <button
          type="button"
          onClick={resendShippedEmail}
          disabled={saving || !trackingOk || !hasFulfilmentEmail}
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
          title={
            !trackingOk
              ? "Add tracking first"
              : !hasFulfilmentEmail
              ? "Missing fulfilment email (Order.email)"
              : ""
          }
        >
          Resend SHIPPED email
        </button>

        <span className="text-sm text-white/80">{msg ?? ""}</span>
      </div>

      <div className="text-xs text-white/45">
        Notes:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li>Setting SHIPPED without tracking is allowed (email will skip until tracking is saved).</li>
          <li>“Mark SHIPPED + Email” and “Resend” require tracking.</li>
          <li>If something doesn’t send, check Email history for FAILED and the error.</li>
        </ul>
      </div>
    </div>
  );
}