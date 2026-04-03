"use client";

import React from "react";
import { SessionProvider } from "next-auth/react";
import { CartProvider } from "./_components/CartProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>{children}</CartProvider>
    </SessionProvider>
  );
}