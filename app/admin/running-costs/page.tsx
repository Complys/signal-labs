"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Row = {
  id: string;
  name: string;
  category: string | null;
  amountPennies: number;
  incurredAt: string; // ISO
  notes: string | null;
};

type ApiGet =
  | { ok: true; rows: Row[] }
  | { ok: false; error?: string };

type ApiPost =
  | { ok: true; row: Row }
  | { ok: false; error?: string };

function gbpFromPennies(p: number) {
  const safe = Number.isFinite(p) ? p : 0;
  return `£${(safe / 100).toFixed(2)}`;
}

function isoDay(d: string | Date) {
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toISOString().slice(0, 10);
}

function clean(v: unknown) {
  return String(v ?? "").trim();
}

export default function AdminRunningCostsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Hosting");
  const [amountGbp, setAmountGbp] = useState("20.00");
  const [incurredAt, setIncurredAt] = useState(() => isoDay(new Date()));
  const [notes, setNotes] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/running-costs", { cache: "no-store" });
      const json = (await res.json()) as ApiGet;
      if (!json.ok) throw new Error(json.error || "Failed to load");
      setRows(json.rows);
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totalPennies = useMemo(
    () => rows.reduce((acc, r) => acc + (Number.isFinite(r.amountPennies) ? r.amountPennies : 0), 0),
    [rows]
  );

  async function createCost() {
    setErr(null);

    const payload = {
      name: clean(name),
      category: clean(category),
      amountGbp: clean(amountGbp),
      incurredAt: clean(incurredAt),
      notes: clean(notes),
    };

    if (!payload.name) return setErr("Name is required");
    if (!payload.amountGbp || Number(payload.amountGbp) <= 0) return setErr("Amount must be > 0");

    try {
      const res = await fetch("/api/admin/running-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ApiPost;
      if (!json.ok) throw new Error(json.error || "Failed to create");

      // optimistic add
      setRows((prev) => [json.row, ...prev]);
      setName("");
      setNotes("");
    } catch (e: any) {
      setErr(e?.message || "Failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this running cost?")) return;
    setErr(null);
    try {
      const res = await fetch(`/api/admin/running-costs/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error || "Failed");
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      setErr(e?.message || "Failed");
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Running costs</h1>
          <p className="text-sm text-white/60">Add ongoing business costs (hosting, ads, apps, wages)</p>
        </div>

        <div className="flex gap-2">
          <Link href="/admin/analytics" className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15">
            Back to analytics
          </Link>
          <button
            onClick={load}
            className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Create */}
        <div className="rounded-2xl bg-white p-5">
          <div className="text-sm font-medium text-black">Add cost</div>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <label className="text-xs text-black/60">
              Name
              <input
                className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Vercel hosting"
              />
            </label>

            <label className="text-xs text-black/60">
              Category
              <select
                className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option>Hosting</option>
                <option>Ads</option>
                <option>Apps</option>
                <option>Wages</option>
                <option>Other</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-black/60">
                Amount (GBP)
                <input
                  className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                  value={amountGbp}
                  onChange={(e) => setAmountGbp(e.target.value)}
                  placeholder="20.00"
                  inputMode="decimal"
                />
              </label>

              <label className="text-xs text-black/60">
                Date
                <input
                  className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                  value={incurredAt}
                  onChange={(e) => setIncurredAt(e.target.value)}
                  type="date"
                />
              </label>
            </div>

            <label className="text-xs text-black/60">
              Notes (optional)
              <input
                className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
              />
            </label>

            {err ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}

            <button
              onClick={createCost}
              className="mt-1 rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Add running cost
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-2xl bg-white p-5 xl:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-medium text-black">Recent costs</div>
              <div className="text-xs text-black/60">Last 200 entries</div>
            </div>

            <div className="text-right">
              <div className="text-xs text-black/60">Total (loaded)</div>
              <div className="text-xl font-semibold text-black">{gbpFromPennies(totalPennies)}</div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-black/60">
                <tr>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className="border-t border-black/10">
                    <td className="py-3 pr-4 text-black" colSpan={5}>
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-black/10">
                    <td className="py-3 pr-4 text-black" colSpan={5}>
                      No running costs yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-t border-black/10">
                      <td className="py-2 pr-4 font-medium text-black">{isoDay(r.incurredAt)}</td>
                      <td className="py-2 pr-4 text-black">
                        <div className="font-medium">{r.name}</div>
                        {r.notes ? <div className="text-xs text-black/50">{r.notes}</div> : null}
                      </td>
                      <td className="py-2 pr-4 text-black">{r.category ?? "—"}</td>
                      <td className="py-2 pr-4 text-black">{gbpFromPennies(r.amountPennies)}</td>
                      <td className="py-2 pr-4 text-right">
                        <button
                          onClick={() => remove(r.id)}
                          className="rounded-full bg-black/10 px-3 py-1.5 text-xs text-black hover:bg-black/15"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-black/50">
            Tip: add recurring monthly costs each month (or we can add “recurring templates” later).
          </div>
        </div>
      </div>
    </div>
  );
}