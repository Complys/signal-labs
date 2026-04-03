"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type Props = {
  id: string | number;
  isActive: boolean;
};

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function ProductRowActions({ id, isActive }: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const productId = encodeURIComponent(String(id)); // ✅ always string + safe for URL

  const baseBtn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    fontWeight: 700,
    fontSize: 13,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
  };

  const dangerBtn: React.CSSProperties = {
    ...baseBtn,
    border: "1px solid rgba(239,68,68,0.45)",
    background: "rgba(239,68,68,0.12)",
  };

  const busy = (style: React.CSSProperties): React.CSSProperties => ({
    ...style,
    opacity: pending ? 0.6 : 1,
    pointerEvents: pending ? "none" : "auto",
  });

  const toggleActive = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/products/${productId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ isActive: !isActive }),
          cache: "no-store",
        });

        const body = await safeJson(res);

        if (!res.ok) {
          alert((body as any)?.error || `Failed to update product (${res.status})`);
          return;
        }

        router.refresh();
      } catch (err) {
        console.error(err);
        alert("Failed to update product");
      }
    });
  };

  const deleteProduct = () => {
    const ok = confirm(
      "Delete this product? This cannot be undone.\n\nTip: If you just want to hide it from the storefront, use Deactivate instead."
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/products/${productId}`, {
          method: "DELETE",
          cache: "no-store",
        });

        const body = await safeJson(res);

        if (!res.ok) {
          alert((body as any)?.error || `Failed to delete product (${res.status})`);
          return;
        }

        router.refresh();
      } catch (err) {
        console.error(err);
        alert("Failed to delete product");
      }
    });
  };

  return (
    <div style={{ display: "inline-flex", gap: 10, justifyContent: "flex-end" }}>
      <button
        type="button"
        onClick={toggleActive}
        disabled={pending}
        style={busy(baseBtn)}
        title={isActive ? "Hide from storefront" : "Make visible on storefront"}
      >
        {isActive ? "Deactivate" : "Activate"}
      </button>

      <button
        type="button"
        onClick={deleteProduct}
        disabled={pending}
        style={busy(dangerBtn)}
        title="Permanently delete"
      >
        Delete
      </button>
    </div>
  );
}
