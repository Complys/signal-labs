"use client";

import { useEffect, useMemo, useState } from "react";

type Expense = {
  id: string;
  name: string;
  category: string;
  amountPennies: number;
  incurredAt: string;
  notes: string | null;
};

function gbp(p: number) {
  const safe = Number.isFinite(p) ? p : 0;
  return `£${(safe / 100).toFixed(2)}`;
}

const CATS = ["RENT", "POSTAGE", "PACKAGING", "MATERIALS", "SOFTWARE", "ADS", "OTHER"] as const;

export default function ExpensesClient() {
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");

  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof CATS)[number]>("OTHER");
  const [amount, setAmount] = useState("0.00");
  const [incurredAt, setIncurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/expenses", { cache: "no-store" });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || "Failed to load expenses");
      setItems((data?.expenses ?? []) as Expense[]);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const total = useMemo(() => items.reduce((a, x) => a + (Number(x.amountPennies) || 0), 0), [items]);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setErr("");

    try {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          name,
          category,
          amount,
          incurredAt,
          notes,
        }),
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || "Failed to add expense");

      setName("");
      setAmount("0.00");
      setNotes("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to add");
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this expense?")) return;
    setErr("");
    try {
      const res = await fetch(`/api/admin/expenses/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || "Failed to delete");
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      setErr(e?.message || "Delete failed");
    }
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={addExpense} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
        {err ? (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-white/70 mb-2">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rent, Packaging, Royal Mail labels"
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-white/25"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-2">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-white/25"
            >
              {CATS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-2">Amount (£)</label>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-white/25"
            />
            <p className="text-xs text-white/45 mt-2">Enter pounds (e.g. 49.99). Stored as pennies.</p>
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-2">Date</label>
            <input
              type="date"
              value={incurredAt}
              onChange={(e) => setIncurredAt(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-white/25"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm text-white/70 mb-2">Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="optional"
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-white/25"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-white text-black px-6 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Add cost"}
          </button>

          <div className="text-sm text-white/60">
            Current list total: <span className="font-semibold text-white">{gbp(total)}</span>
            {loading ? <span className="ml-2 text-white/45">(loading…)</span> : null}
          </div>
        </div>
      </form>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent costs</h2>
          <button
            type="button"
            onClick={load}
            className="rounded-full px-4 py-2 text-sm bg-white/10 hover:bg-white/15 border border-white/10"
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-white/60">
              <tr>
                <th className="text-left py-2 pr-3">Date</th>
                <th className="text-left py-2 pr-3">Name</th>
                <th className="text-left py-2 pr-3">Category</th>
                <th className="text-right py-2 px-3">Amount</th>
                <th className="text-right py-2 pl-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id} className="border-t border-white/10">
                  <td className="py-2 pr-3 whitespace-nowrap">{String(x.incurredAt).slice(0, 10)}</td>
                  <td className="py-2 pr-3">{x.name}</td>
                  <td className="py-2 pr-3 text-white/70">{x.category}</td>
                  <td className="py-2 px-3 text-right font-semibold">{gbp(x.amountPennies)}</td>
                  <td className="py-2 pl-3 text-right">
                    <button
                      type="button"
                      onClick={() => del(x.id)}
                      className="rounded-full px-3 py-1 text-xs bg-red-500/15 border border-red-500/20 hover:bg-red-500/20"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td className="py-6 text-white/50" colSpan={5}>
                    No expenses yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}