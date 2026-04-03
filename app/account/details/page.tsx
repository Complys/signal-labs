"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Details = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postcode?: string | null;
  country?: string | null;
};

export default function AccountDetailsPage() {
  const [data, setData] = useState<Details | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/account/details", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load details");
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setMsg(e?.message ?? "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    if (!data) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/details", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "Failed to save");
      }
      setMsg("Saved successfully.");
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function field(key: keyof Details, label: string, placeholder?: string) {
    return (
      <label className="block">
        <span className="text-sm font-medium text-black/70">{label}</span>
        <input
          className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
          value={(data?.[key] as any) ?? ""}
          placeholder={placeholder}
          onChange={(e) => setData((d) => ({ ...(d ?? {}), [key]: e.target.value }))}
        />
      </label>
    );
  }

  return (
    <main className="min-h-screen bg-[#F6F8FB] px-6 py-10 text-[#0B1220]">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Edit details</h1>
            <p className="mt-1 text-sm text-black/60">
              Update your contact and delivery details.
            </p>
          </div>

          <Link
            href="/account"
            className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium hover:bg-[#F6F8FB]"
          >
            Back
          </Link>
        </div>

        <div className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
          {loading ? (
            <p className="text-sm text-black/60">Loading…</p>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                {field("firstName", "First name")}
                {field("lastName", "Last name")}
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-black/70">Email</span>
                  <input
                    className="mt-2 w-full rounded-2xl border border-black/10 bg-[#F6F8FB] px-4 py-3 text-sm text-black/60"
                    value={data?.email ?? ""}
                    disabled
                  />
                  <p className="mt-2 text-xs text-black/45">
                    Email can’t be changed here.
                  </p>
                </label>
                {field("phone", "Phone")}
              </div>

              <div className="mt-8">
                <h2 className="text-base font-semibold">Address</h2>
                <p className="mt-1 text-sm text-black/60">
                  Used for shipping and billing.
                </p>

                <div className="mt-5 grid gap-5">
                  {field("addressLine1", "Address line 1")}
                  {field("addressLine2", "Address line 2 (optional)")}
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {field("city", "City")}
                  {field("postcode", "Postcode")}
                </div>

                <div className="mt-5">{field("country", "Country")}</div>
              </div>

              {msg && (
                <div className="mt-6 rounded-2xl border border-black/10 bg-[#F6F8FB] px-4 py-3 text-sm text-black/70">
                  {msg}
                </div>
              )}

              <div className="mt-7 flex items-center justify-end gap-3">
                <Link
                  href="/account"
                  className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-medium hover:bg-[#F6F8FB]"
                >
                  Cancel
                </Link>
                <button
                  onClick={save}
                  disabled={saving || loading}
                  className="inline-flex items-center justify-center rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
