"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function gbpFromPennies(p: number) {
  const safe = Number.isFinite(p) ? p : 0;
  return `£${(safe / 100).toFixed(2)}`;
}

function gbpToPenniesInput(v: string) {
  const s = String(v ?? "").replace("£", "").replace(/,/g, "").trim();
  if (!s) return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [pounds, pence = ""] = s.split(".");
  const pence2 = (pence + "00").slice(0, 2);
  const pennies = Number(pounds) * 100 + Number(pence2);
  if (!Number.isFinite(pennies) || pennies < 0) return null;
  return Math.trunc(pennies);
}

type Props = {
  orderId: string;
  status: string;

  trackingNo?: string | null;
  trackingUrl?: string | null;

  postageCostPennies?: number | null; // ✅ what it cost YOU

  // (Optional) show for context
  shippingChargedPennies?: number | null; // what customer paid for shipping
};

export default function OrderAdminActions(props: Props) {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");

  const [postageCost, setPostageCost] = useState(() =>
    gbpFromPennies(Number(props.postageCostPennies ?? 0)).replace("£", "")
  );

  const postagePennies = useMemo(() => gbpToPenniesInput(postageCost), [postageCost]);

  async function patch(body: any) {
    setSaving(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/orders/${props.orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || "Save failed");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function savePostage() {
    if (saving) return;
    if (postagePennies === null) {
      setErr("Enter a valid postage cost (e.g. 3.29)");
      return;
    }
    await patch({ postageCostPennies: postagePennies });
  }

  async function setStatus(next: string) {
    if (saving) return;
    await patch({ status: next });
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-white/50">Order actions</p>
          <p className="mt-1 text-sm text-white/80">
            Status: <span className="font-semibold text-white">{props.status}</span>
          </p>
          <p className="mt-1 text-xs text-white/50">
            Shipping charged:{" "}
            <span className="text-white/80">{gbpFromPennies(Number(props.shippingChargedPennies ?? 0))}</span>
          </p>
        </div>
      </div>

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      {/* Status buttons */}
      <div className="mt-5 flex flex-wrap gap-2">
        {["PENDING", "PAID", "PROCESSING", "SHIPPED", "CANCELLED", "REFUNDED", "FAILED"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            disabled={saving}
            className={[
              "rounded-full px-4 py-2 text-xs font-semibold border",
              props.status === s
                ? "bg-white/15 border-white/25"
                : "bg-white/5 border-white/10 hover:bg-white/10",
              saving ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Postage cost */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3 sm:items-end">
        <div className="sm:col-span-2">
          <label className="block text-sm text-white/70 mb-2">Postage cost (what it cost YOU)</label>
          <input
            value={postageCost}
            onChange={(e) => setPostageCost(e.target.value)}
            placeholder="e.g. 3.29"
            inputMode="decimal"
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-white/25"
          />
          <p className="mt-2 text-xs text-white/45">
            Used for True Profit: revenue − COGS − postage cost − business expenses.
          </p>
        </div>

        <button
          type="button"
          onClick={savePostage}
          disabled={saving}
          className="rounded-2xl bg-white text-black px-6 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save postage"}
        </button>
      </div>

      {/* You can keep your existing tracking + resend email blocks below this */}
    </div>
  );
}