"use client";

import { useEffect, useMemo, useState } from "react";

type Tier = "STANDARD" | "SILVER" | "GOLD" | "VIP";

type AffiliateRow = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  status?: string | null;

  tier: Tier;
  defaultRateBps: number;
  rateOverrideBps: number | null;
  cookieDays: number;
  perksJson: string | null;

  createdAt: string;
  updatedAt: string;
};

type ApiGet =
  | { ok: true; affiliates: AffiliateRow[] }
  | { ok: false; error?: string };

type ApiCreate =
  | { ok: true; affiliate: AffiliateRow }
  | { ok: false; error?: string };

function clean(v: unknown) {
  return String(v ?? "").trim();
}
function upper(v: unknown) {
  return clean(v).toUpperCase();
}
function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}
function fmtRate(bps: number | null | undefined) {
  const safe = Number.isFinite(Number(bps)) ? Number(bps) : 0;
  return `${(safe / 100).toFixed(2)}%`;
}
function validCode(code: string) {
  const c = upper(code);
  if (c.length < 3 || c.length > 32) return false;
  return /^[A-Z0-9_-]+$/.test(c);
}

const TIERS: Tier[] = ["STANDARD", "SILVER", "GOLD", "VIP"];

function tierDefaults(tier: Tier) {
  switch (tier) {
    case "STANDARD":
      return { defaultRateBps: 500, cookieDays: 30 };
    case "SILVER":
      return { defaultRateBps: 750, cookieDays: 45 };
    case "GOLD":
      return { defaultRateBps: 1000, cookieDays: 60 };
    case "VIP":
      return { defaultRateBps: 1250, cookieDays: 90 };
  }
}

const RATE_PRESETS_BPS = [
  250, 500, 750, 1000, 1250, 1500, 2000,
]; // 2.5% .. 20%

export default function AdminAffiliatesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AffiliateRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // modal state
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [tier, setTier] = useState<Tier>("STANDARD");
  const [defaultRateBps, setDefaultRateBps] = useState<string>(""); // empty = use tier default
  const [rateOverrideBps, setRateOverrideBps] = useState<string>(""); // optional
  const [cookieDays, setCookieDays] = useState<string>(""); // empty = use tier default
  const [perksJson, setPerksJson] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function safeReadJson(res: Response) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/affiliates", { cache: "no-store" });
      const json = (await safeReadJson(res)) as ApiGet | null;

      if (!res.ok) {
        setError((json as any)?.error || `Failed (${res.status})`);
        setRows([]);
        return;
      }
      if (!json || (json as any).ok !== true) {
        setError((json as any)?.error || "Unexpected API response.");
        setRows([]);
        return;
      }
      setRows(Array.isArray((json as any).affiliates) ? (json as any).affiliates : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load affiliates");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }, [rows]);

  function openModal() {
    setFormError(null);
    setCode("");
    setName("");
    setIsActive(true);

    setTier("STANDARD");
    setDefaultRateBps(""); // use tier default
    setRateOverrideBps(""); // none
    setCookieDays(""); // use tier default
    setPerksJson("");

    setOpen(true);
  }

  // When tier changes, suggest defaults (only if fields empty)
  useEffect(() => {
    const td = tierDefaults(tier);
    // don’t force overwrite if user already typed something
    // (we just show placeholders in UI; payload uses tier defaults when empty)
    void td;
  }, [tier]);

  async function createAffiliate() {
    setSaving(true);
    setFormError(null);

    const c = upper(code);
    const n = clean(name);

    if (!validCode(c)) {
      setFormError("Code must be 3–32 chars and only A–Z, 0–9, _ or -.");
      setSaving(false);
      return;
    }
    if (!n || n.length < 2) {
      setFormError("Name must be at least 2 characters.");
      setSaving(false);
      return;
    }

    const td = tierDefaults(tier);

    const payload: any = {
      code: c,
      name: n,
      isActive: Boolean(isActive),
      tier,
      perksJson: clean(perksJson) || null,
    };

    // default rate: blank means tier default
    if (clean(defaultRateBps)) {
      payload.defaultRateBps = clampInt(Number(defaultRateBps), 0, 5000);
    } else {
      payload.defaultRateBps = td.defaultRateBps;
    }

    // override: optional
    if (clean(rateOverrideBps)) {
      payload.rateOverrideBps = clampInt(Number(rateOverrideBps), 0, 5000);
    }

    // cookie days: blank means tier default
    if (clean(cookieDays)) {
      payload.cookieDays = clampInt(Number(cookieDays), 1, 365);
    } else {
      payload.cookieDays = td.cookieDays;
    }

    try {
      const res = await fetch("/api/admin/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await safeReadJson(res)) as ApiCreate | null;

      if (!res.ok || !json || (json as any).ok !== true) {
        setFormError((json as any)?.error || `Create failed (${res.status})`);
        return;
      }

      setOpen(false);
      await load();
    } catch (e: any) {
      setFormError(e?.message || "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 22, maxWidth: 1200 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Affiliates</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.7 }}>
            Create affiliates, assign tiers, and override commission where needed.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={load}
            className="rounded-full bg-white/10 text-white px-4 py-2 text-sm font-semibold hover:bg-white/15"
          >
            Refresh
          </button>

          <button
            onClick={openModal}
            className="rounded-full bg-yellow-400 text-black px-4 py-2 text-sm font-semibold hover:opacity-95"
          >
            + Create affiliate
          </button>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.08)",
            overflow: "hidden",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "160px 1fr 110px 110px 110px 120px 160px",
              padding: "12px 16px",
              opacity: 0.8,
              fontSize: 12,
            }}
          >
            <div>CODE</div>
            <div>NAME</div>
            <div>TIER</div>
            <div>ACTIVE</div>
            <div>RATE</div>
            <div>COOKIE</div>
            <div>NOTES</div>
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {loading ? (
              <div style={{ padding: 16, opacity: 0.8 }}>Loading…</div>
            ) : error ? (
              <div style={{ padding: 16, color: "#ffb4b4" }}>{error}</div>
            ) : sorted.length === 0 ? (
              <div style={{ padding: 16, opacity: 0.75 }}>No affiliates yet.</div>
            ) : (
              sorted.map((a) => {
                const effective = a.rateOverrideBps ?? a.defaultRateBps;
                return (
                  <div
                    key={a.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "160px 1fr 110px 110px 110px 120px 160px",
                      padding: "12px 16px",
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 800, letterSpacing: 0.5 }}>{a.code}</div>
                    <div style={{ opacity: 0.9 }}>{a.name}</div>
                    <div style={{ opacity: 0.9 }}>{a.tier}</div>
                    <div style={{ opacity: 0.9 }}>{a.isActive ? "Yes" : "No"}</div>
                    <div style={{ opacity: 0.9 }}>
                      {fmtRate(effective)}
                      {a.rateOverrideBps != null ? (
                        <span style={{ opacity: 0.65, fontSize: 12 }}> (override)</span>
                      ) : null}
                    </div>
                    <div style={{ opacity: 0.9 }}>{a.cookieDays}d</div>
                    <div style={{ opacity: 0.65, fontSize: 12 }}>
                      {a.perksJson ? "Has perks" : "—"}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div
          onClick={() => !saving && setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(720px, 100%)",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "#0b0b0b",
              padding: 16,
              boxShadow: "0 20px 80px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 850 }}>Create affiliate</div>
                <div style={{ opacity: 0.7, fontSize: 13, marginTop: 4 }}>
                  Tier sets defaults. You can override commission for VIP partners.
                </div>
              </div>
              <button
                onClick={() => !saving && setOpen(false)}
                className="rounded-full bg-white/10 text-white px-3 py-2 text-sm font-semibold hover:bg-white/15"
              >
                Close
              </button>
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Code</div>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="TIM10"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-white/25"
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Name</div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tim Wright"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-white/25"
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Tier</div>
                  <select
                    value={tier}
                    onChange={(e) => setTier(e.target.value as Tier)}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-white/25"
                  >
                    {TIERS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>
                    Suggested: {fmtRate(tierDefaults(tier).defaultRateBps)} • {tierDefaults(tier).cookieDays}d
                  </div>
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Default commission</div>
                  <select
                    value={defaultRateBps}
                    onChange={(e) => setDefaultRateBps(e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-white/25"
                  >
                    <option value="">Use tier default</option>
                    {RATE_PRESETS_BPS.map((bps) => (
                      <option key={bps} value={String(bps)}>
                        {fmtRate(bps)} ({bps} bps)
                      </option>
                    ))}
                    <option value="custom">Custom (type below)</option>
                  </select>

                  {/* If they pick "custom" we just let them type into the next field */}
                  {defaultRateBps === "custom" && (
                    <input
                      value=""
                      onChange={() => {}}
                      style={{ display: "none" }}
                    />
                  )}
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Override commission (optional)</div>
                  <input
                    value={rateOverrideBps}
                    onChange={(e) => setRateOverrideBps(e.target.value)}
                    placeholder="Leave blank for none (e.g. 1500 = 15%)"
                    inputMode="numeric"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-white/25"
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "grid", gap: 10, alignContent: "start" }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Active</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      style={{ width: 18, height: 18 }}
                    />
                    <div style={{ opacity: 0.85, fontSize: 14 }}>
                      {isActive ? "Enabled" : "Disabled"}
                    </div>
                  </div>
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Cookie days</div>
                  <input
                    value={cookieDays}
                    onChange={(e) => setCookieDays(e.target.value)}
                    placeholder={`Use tier default (${tierDefaults(tier).cookieDays})`}
                    inputMode="numeric"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-white/25"
                  />
                </label>
              </div>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Perks / notes (optional)</div>
                <textarea
                  value={perksJson}
                  onChange={(e) => setPerksJson(e.target.value)}
                  placeholder={`Example JSON:\n{"freeSamples":true,"earlyDrops":true,"notes":"Send monthly pack"}`}
                  rows={4}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-white/25"
                />
              </label>

              {formError && <div style={{ color: "#ffb4b4", fontSize: 13 }}>{formError}</div>}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button
                  onClick={() => !saving && setOpen(false)}
                  disabled={saving}
                  className="rounded-full bg-white/10 text-white px-4 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={createAffiliate}
                  disabled={saving}
                  className="rounded-full bg-yellow-400 text-black px-4 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                >
                  {saving ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}