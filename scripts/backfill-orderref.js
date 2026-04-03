const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function makeRef() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SL-${y}${m}${day}-${rand}`;
}

async function main() {
  const orders = await prisma.order.findMany({
    where: { orderRef: null },
    select: { id: true },
  });

  console.log("Orders needing orderRef:", orders.length);

  for (const o of orders) {
    for (let i = 0; i < 5; i++) {
      const ref = makeRef();
      try {
        await prisma.order.update({
          where: { id: o.id },
          data: { orderRef: ref },
        });
        break;
      } catch (e) {
        if (i === 4) throw e;
      }
    }
  }

  console.log("Backfill complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
