export const FREE_DELIVERY_THRESHOLD_PENNIES = 3000; // £30.00
export const SHIPPING_FLAT_PENNIES = 499; // £4.99

export function calcShippingPennies(subtotalPennies: number) {
  const subtotal = Number.isFinite(subtotalPennies) ? subtotalPennies : 0;
  const free = subtotal >= FREE_DELIVERY_THRESHOLD_PENNIES;
  return {
    shippingPennies: free ? 0 : SHIPPING_FLAT_PENNIES,
    isFree: free,
  };
}