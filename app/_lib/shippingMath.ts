// app/_lib/shippingMath.ts
export function shippingUpsell(subtotalPennies: number, freeOverPennies: number) {
  const safeSubtotal = Number.isFinite(subtotalPennies) ? subtotalPennies : 0;
  const safeFreeOver = Number.isFinite(freeOverPennies) ? freeOverPennies : 0;

  const remaining = Math.max(0, safeFreeOver - safeSubtotal);
  const isFree = safeSubtotal >= safeFreeOver && safeFreeOver > 0;

  return { remainingPennies: remaining, isFree };
}

export function formatGBPFromPennies(pennies: number) {
  const p = Number.isFinite(pennies) ? pennies : 0;
  return `£${(p / 100).toFixed(2)}`;
}