const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

(async () => {
  const prisma = new PrismaClient();
  const email = "tim.wright@ddcscaffolding.co.uk";
  const newPass = "TempPass123!";

  const hash = await bcrypt.hash(newPass, 10);

  const u = await prisma.user.update({
    where: { email },
    data: { password: hash, role: "ADMIN" },
    select: { email: true, role: true },
  });

  console.log("Updated:", u.email, "role=", u.role);
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
