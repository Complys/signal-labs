"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const COOKIE = "ruo_accepted";
const PROTECTED = ["/products", "/equipment"];

function setCookie(name: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=1; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name: string) {
  return document.cookie.split("; ").some((c) => c.startsWith(name + "="));
}

export default function DisclaimerWall() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);
  const [visible, setVisible] = useState(false);

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!isProtected) return;
    if (!getCookie(COOKIE)) {
      setShow(true);
      setTimeout(() => setVisible(true), 10);
    }
  }, [pathname, isProtected]);

  function accept() {
    if (!checked) return;
    setCookie(COOKIE, 365);
    fetch("/api/disclaimer-accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, ts: new Date().toISOString() }),
    }).catch(() => {});
    setVisible(false);
    setTimeout(() => setShow(false), 400);
  }

  if (!show) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: `rgba(8, 14, 26, ${visible ? "0.96" : "0"})`,
      backdropFilter: visible ? "blur(12px)" : "blur(0px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px",
      transition: "background 0.4s ease, backdrop-filter 0.4s ease",
    }}>
      <div style={{
        background: "#ffffff", borderRadius: 24, padding: "44px 40px 36px",
        maxWidth: 520, width: "100%",
        boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
        transform: visible ? "translateY(0) scale(1)" : "translateY(24px) scale(0.97)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.4s cubic-bezier(0.22,1,0.36,1), opacity 0.4s ease",
        fontFamily: "\'DM Sans\', -apple-system, sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <div style={{
            width: 40, height: 40, background: "#0B1220", borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 1L11.5 6.5L17 7.3L13 11.2L14 17L9 14.3L4 17L5 11.2L1 7.3L6.5 6.5L9 1Z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0B1220", letterSpacing: "-0.01em" }}>Signal Laboratories</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 1 }}>Research Chemicals &amp; Peptides</div>
          </div>
        </div>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "#fef3c7", border: "1px solid #fcd34d",
          borderRadius: 20, padding: "5px 12px", marginBottom: 20,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }}/>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#92400e", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            MHRA Compliance Notice
          </span>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0B1220", marginBottom: 14, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          Research Use Only
        </h2>

        <div style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.75, marginBottom: 24 }}>
          <p style={{ marginBottom: 12 }}>
            All products sold by Signal Laboratories are supplied exclusively for{" "}
            <strong style={{ color: "#0B1220" }}>in vitro laboratory and analytical research</strong>. They are{" "}
            <strong style={{ color: "#0B1220" }}>not medicines or food supplements</strong> and are not intended
            for human or veterinary use, diagnosis, treatment, or prevention of any condition.
          </p>
          <p style={{ marginBottom: 12 }}>
            By proceeding you confirm you are a{" "}
            <strong style={{ color: "#0B1220" }}>qualified researcher or laboratory professional</strong> aged 18
            or over, that you will use these products solely for legitimate scientific research, and that you
            understand they have not been approved by the MHRA for use in humans.
          </p>
          <p>If you do not agree, please leave this site.</p>
        </div>

        <label style={{
          display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 24, cursor: "pointer",
          background: checked ? "#f0fdf4" : "#f8fafc",
          border: `1.5px solid ${checked ? "#86efac" : "#e2e8f0"}`,
          borderRadius: 12, padding: "14px 16px", transition: "all 0.2s ease",
        }}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)}
            style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, accentColor: "#0B1220", cursor: "pointer" }}/>
          <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
            I confirm I am a qualified researcher aged 18+, and I agree that all products are for laboratory
            research purposes only and <strong>not for human use</strong>.
          </span>
        </label>

        <button onClick={accept} disabled={!checked} style={{
          width: "100%", padding: "14px 24px",
          background: checked ? "#0B1220" : "#e2e8f0",
          color: checked ? "#ffffff" : "#94a3b8",
          border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600,
          cursor: checked ? "pointer" : "not-allowed",
          transition: "all 0.2s ease", letterSpacing: "-0.01em",
        }}>
          {checked ? "Enter Signal Laboratories →" : "Please confirm above to continue"}
        </button>

        <p style={{ marginTop: 14, fontSize: 11, color: "#94a3b8", textAlign: "center", lineHeight: 1.5 }}>
          Your acceptance is timestamped and logged for compliance purposes.<br/>This notice refreshes annually.
        </p>
      </div>
    </div>
  );
}
