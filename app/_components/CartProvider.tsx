"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * CartProvider.tsx
 * - Immutable updates (always triggers re-render)
 * - Stable keying (dealId null/undefined/"" all map consistently)
 * - Storage hydrate + persist
 * - Cross-tab sync (storage event)
 * - Optional duplicate-context warning (helps catch mixed import paths)
 */

export type CartItem = {
  productId: string;
  dealId?: string | null;
  qty: number;

  // optional UI helpers
  name?: string;
  image?: string | null;
  unitPricePennies?: number;
};

type CartState = Record<string, CartItem>;

type CartContextValue = {
  items: CartState;
  count: number;
  subtotalPennies: number;

  keyOf: (productId: string, dealId?: string | null) => string;

  setQty: (productId: string, dealId: string | null, qty: number, maxQty?: number) => void;
  addItem: (item: CartItem, maxQty?: number) => void;
  remove: (productId: string, dealId: string | null) => void;
  clear: () => void;

  // useful for UI that wants to avoid hydration mismatch
  hydrated: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "signal_cart_v1";
const MAX_QTY_DEFAULT = 9999;

/** ---------- small helpers ---------- */

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function toInt(n: unknown) {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : NaN;
}

/**
 * Normalize dealId so undefined/null/"" all behave the same.
 * We use empty string in the key to avoid "undefined" vs "null" mismatches.
 */
function normDealId(dealId: unknown): string {
  return safeStr(dealId);
}

function makeKey(productId: unknown, dealId: unknown) {
  return `${safeStr(productId)}::${normDealId(dealId)}`;
}

function clampQty(qty: unknown, maxQty?: unknown) {
  const q = toInt(qty);
  const base = Number.isFinite(q) ? Math.max(1, q) : 1;

  const m = toInt(maxQty);
  const cap = Number.isFinite(m) && m > 0 ? Math.min(MAX_QTY_DEFAULT, m) : MAX_QTY_DEFAULT;

  return Math.min(base, cap);
}

function isBrowser() {
  return typeof window !== "undefined";
}

function readFromStorage(): CartState {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    const itemsObj = (parsed?.items ?? parsed) as unknown;

    if (!itemsObj || typeof itemsObj !== "object") return {};

    const out: CartState = {};
    for (const [, v] of Object.entries(itemsObj as Record<string, any>)) {
      const pid = safeStr(v?.productId);
      if (!pid) continue;

      const did = v?.dealId == null ? null : safeStr(v?.dealId);

      // stored qty can be anything—clamp to sane values
      const qty = clampQty(v?.qty, MAX_QTY_DEFAULT);

      const k = makeKey(pid, did);

      out[k] = {
        productId: pid,
        dealId: did,
        qty,
        name: v?.name ? String(v.name) : undefined,
        image: v?.image ?? null,
        unitPricePennies: Number.isFinite(Number(v?.unitPricePennies))
          ? Math.trunc(Number(v.unitPricePennies))
          : undefined,
      };
    }

    return out;
  } catch {
    return {};
  }
}

function writeToStorage(items: CartState) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ items }));
  } catch {
    // ignore
  }
}

/** ---------- provider ---------- */

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartState>({});
  const [hydrated, setHydrated] = useState(false);

  // stable keyOf exposed to the app
  const keyOf = useCallback((productId: string, dealId?: string | null) => {
    return makeKey(productId, dealId);
  }, []);

  // Prevent “write empty cart” before we hydrate
  const hasHydratedRef = useRef(false);

  // OPTIONAL: detect duplicate module instances / mixed import paths causing separate contexts.
  useEffect(() => {
    if (!isBrowser()) return;

    const g = window as any;
    const KEY = "__signal_cart_context_instance__";

    // if another instance already registered, we warn (this is the classic “Added but not added” cause)
    if (g[KEY] && g[KEY] !== CartContext) {
      // eslint-disable-next-line no-console
      console.warn(
        "[CartProvider] Detected multiple CartContext instances. This usually happens when importing CartProvider/useCart from different paths (e.g. ./CartProvider vs @/app/_components/CartProvider). Standardise imports to ONE path everywhere."
      );
    }
    g[KEY] = CartContext;
  }, []);

  // Hydrate once on mount
  useEffect(() => {
    setItems(readFromStorage());
    setHydrated(true);
    hasHydratedRef.current = true;
  }, []);

  // Persist whenever items change (after hydration)
  useEffect(() => {
    if (!hasHydratedRef.current) return;
    writeToStorage(items);
  }, [items]);

  // Cross-tab sync
  useEffect(() => {
    if (!isBrowser()) return;

    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      // If another tab updates cart, update this tab too
      setItems(readFromStorage());
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const count = useMemo(() => {
    return Object.values(items).reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  }, [items]);

  const subtotalPennies = useMemo(() => {
    return Object.values(items).reduce((sum, it) => {
      const price = Number(it.unitPricePennies) || 0;
      const qty = Number(it.qty) || 0;
      return sum + price * qty;
    }, 0);
  }, [items]);

  const setQty = useCallback(
    (productId: string, dealId: string | null, qty: number, maxQty?: number) => {
      const pid = safeStr(productId);
      if (!pid) return;

      const k = keyOf(pid, dealId ?? null);

      // qty <= 0 => remove
      const qInt = toInt(qty);
      if (!Number.isFinite(qInt) || qInt <= 0) {
        setItems((prev) => {
          if (!prev[k]) return prev;
          const next = { ...prev };
          delete next[k];
          return next;
        });
        return;
      }

      const nextQty = clampQty(qty, maxQty);

      setItems((prev) => {
        const existing = prev[k];
        return {
          ...prev,
          [k]: {
            ...(existing ?? { productId: pid, dealId: dealId ?? null, qty: nextQty }),
            productId: pid,
            dealId: dealId ?? null,
            qty: nextQty,
          },
        };
      });
    },
    [keyOf]
  );

  const addItem = useCallback(
    (item: CartItem, maxQty = MAX_QTY_DEFAULT) => {
      setItems((prev) => {
        const pid = safeStr(item.productId);
        if (!pid) return prev;

        const did = item.dealId ?? null;
        const k = keyOf(pid, did);

        const existing = prev[k];
        const existingQty = Number(existing?.qty) || 0;
        const addQty = Number(item.qty) || 1;

        const nextQty = clampQty(existingQty + addQty, maxQty);

        return {
          ...prev,
          [k]: {
            ...existing,
            ...item,
            productId: pid,
            dealId: did,
            qty: nextQty,
          },
        };
      });
    },
    [keyOf]
  );

  const remove = useCallback(
    (productId: string, dealId: string | null) => {
      const pid = safeStr(productId);
      if (!pid) return;

      const k = keyOf(pid, dealId ?? null);

      setItems((prev) => {
        if (!prev[k]) return prev;
        const next = { ...prev };
        delete next[k];
        return next;
      });
    },
    [keyOf]
  );

  const clear = useCallback(() => {
    setItems({});
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count,
      subtotalPennies,
      keyOf,
      setQty,
      addItem,
      remove,
      clear,
      hydrated,
    }),
    [items, count, subtotalPennies, keyOf, setQty, addItem, remove, clear, hydrated]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}