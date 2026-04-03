import { prisma } from "../lib/prisma";

async function main() {
  // find items with missing/zero cost but with a linked product
  const items = await prisma.orderItem.findMany({
    where: {
      productId: { not: null },
      unitCostPennies: 0, // if yours is nullable use: unitCostPennies: null
    },
    select: { id: true, productId: true },
    take: 5000,
  });

  if (items.length === 0) {
    console.log("No items need backfilling.");
    return;
  }

  const productIds = Array.from(new Set(items.map((i) => i.productId!).filter(Boolean)));

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, costPennies: true },
  });

  const costMap = new Map(products.map((p) => [p.id, p.costPennies ?? 0]));

  let updated = 0;
  for (const it of items) {
    const cost = costMap.get(it.productId!) ?? 0;
    await prisma.orderItem.update({
      where: { id: it.id },
      data: { unitCostPennies: cost },
    });
    updated++;
  }

  console.log(`Backfilled ${updated} order items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });