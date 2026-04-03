// app/account/AttachLastOrder.tsx
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const SESSION_KEY = "signal_last_checkout_session_id";
const ORDER_KEY = "signal_last_order_id";
const DID_REFRESH_KEY = "signal_attach_did_refresh_v1";

export default function AttachLastOrder() {
  const ranRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    // Prevent double-call in React Strict Mode (dev) + rerenders
    if (ranRef.current) return;
    ranRef.current = true;

    // localStorage only exists in browser, but this is a client component anyway
    const stripeSessionId = (localStorage.getItem(SESSION_KEY) || "").trim();
    const orderId = (localStorage.getItem(ORDER_KEY) || "").trim();

    // Nothing to do
    if (!stripeSessionId && !orderId) {
      // If there are no identifiers, also clean up any stale refresh flag
      localStorage.removeItem(DID_REFRESH_KEY);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/orders/attach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({
            stripeSessionId: stripeSessionId || undefined,
            orderId: orderId || undefined,
          }),
        });

        const data = await res.json().catch(() => null);

        if (cancelled) return;

        // Only treat as success when both HTTP ok AND payload ok
        if (!res.ok || !data?.ok) return;

        // Success: clear identifiers so we don't keep retrying
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(ORDER_KEY);

        // Refresh SSR data exactly once
        const didRefresh = localStorage.getItem(DID_REFRESH_KEY) === "1";
        if (!didRefresh) {
          localStorage.setItem(DID_REFRESH_KEY, "1");
          router.refresh();
          return;
        }

        // If we already refreshed once, clean up flag
        localStorage.removeItem(DID_REFRESH_KEY);
      } catch {
        // Ignore: we'll retry next visit to /account
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}