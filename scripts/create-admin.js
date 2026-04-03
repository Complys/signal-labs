const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcrypt")

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  const password = process.argv[3]

  if (!email || !password) {
    console.log("Usage: node scripts/create-admin.js <email> <password>")
    process.exit(1)
  }

  const hash = await bcrypt.hash(password, 10)

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hash, role: "ADMIN" },
    create: { email, password: hash, role: "ADMIN" },
  })

  console.log("✅ Admin ready:", user.email)
}

main()
  .catch(console.error)
  .finally(async () => prisma.$disconnect())
