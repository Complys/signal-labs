const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

(async () => {
  const prisma = new PrismaClient();

  const email = "tim.wright@ddcscaffolding.co.uk";
  const passwordPlain = "TempPass123!";

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log("User already exists:", existing.email, "role=", existing.role);
    await prisma.$disconnect();
    return;
  }

  const hash = await bcrypt.hash(passwordPlain, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hash,
      role: "ADMIN",
      firstName: "Tim",
      lastName: "Wright",
    },
    select: { id: true, email: true, role: true },
  });

  console.log("Created admin:", user);
  console.log("Login with:", email, "/", passwordPlain);

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
