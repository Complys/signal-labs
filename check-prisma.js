const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
console.log("has orderCounter:", !!p.orderCounter);
p.$disconnect();
