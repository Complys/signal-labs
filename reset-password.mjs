import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const email = "tim.wright@ddcscaffolding.co.uk";
const newPassword = "NewPassword123!";

async function main() {
  const hash = await bcrypt.hash(newPassword, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hash, role: "ADMIN", firstName: "Tim", lastName: "Wright" },
    create: { email, password: hash, role: "ADMIN", firstName: "Tim", lastName: "Wright" },
  });

  console.log("✅ Upserted user:", user.email, "role:", user.role);
  console.log("✅ New password:", newPassword);
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
