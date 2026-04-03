import { getOrCreateShippingSettings } from "@/lib/shipping/settings";

export type ShippingQuote = {
  enabled: boolean;
  shippingPennies: number;         // what customer pays
  freeOverPennies: number;    // threshold for free delivery
  flatRatePennies: number;         // base rate
  qualifiesForFree: boolean;
  amountUntilFreePennies: number;  // 0 if already free
};

export async function quoteShipping(subtotalPennies: number): Promise<ShippingQuote> {
  const s = await getOrCreateShippingSettings();

  if (!s.enabled) {
    return {
      enabled: false,
      shippingPennies: 0,
      freeOverPennies: s.freeOverPennies,
      flatRatePennies: s.flatRatePennies,
      qualifiesForFree: false,
      amountUntilFreePennies: Math.max(0, s.freeOverPennies - subtotalPennies),
    };
  }

  const qualifiesForFree = subtotalPennies >= s.freeOverPennies;
  const shippingPennies = qualifiesForFree ? 0 : s.flatRatePennies;

  return {
    enabled: true,
    shippingPennies,
    freeOverPennies: s.freeOverPennies,
    flatRatePennies: s.flatRatePennies,
    qualifiesForFree,
    amountUntilFreePennies: Math.max(0, s.freeOverPennies - subtotalPennies),
  };
}