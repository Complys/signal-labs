import { prisma } from "@/lib/prisma";

export type ShippingSettingsDTO = {
  freeOverPennies: number;
  flatRatePennies: number;
  enabled: boolean;
  updatedAt: string; // ISO
};

const SINGLETON_ID = 1;

export async function getOrCreateShippingSettings() {
  const existing = await prisma.shippingSettings.findUnique({
    where: { id: SINGLETON_ID },
  });

  if (existing) return existing;

  // Create singleton row if DB is fresh
  return prisma.shippingSettings.create({
    data: { id: SINGLETON_ID },
  });
}

export async function getShippingSettingsDTO(): Promise<ShippingSettingsDTO> {
  const s = await getOrCreateShippingSettings();
  return {
    freeOverPennies: s.freeOverPennies,
    flatRatePennies: s.flatRatePennies,
    enabled: s.enabled,
    updatedAt: s.updatedAt.toISOString(),
  };
}