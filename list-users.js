const { PrismaClient } = require("@prisma/client");

(async () => {
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany({
    select: { email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  console.log(users);
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
