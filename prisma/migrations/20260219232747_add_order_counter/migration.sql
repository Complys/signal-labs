/*
  Warnings:

  - Made the column `orderRef` on table `Order` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateTable
CREATE TABLE "OrderCounter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "next" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "orderRef" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "paymentIntentId" TEXT,
    "email" TEXT,
    "name" TEXT,
    "company" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "country" TEXT,
    "safePlace" TEXT,
    "deliveryNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'gbp',
    "amountTotal" INTEGER NOT NULL DEFAULT 0,
    "trackingNo" TEXT,
    "trackingUrl" TEXT,
    "stockDeducted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("addressLine1", "addressLine2", "amountTotal", "city", "company", "country", "createdAt", "currency", "deliveryNotes", "email", "id", "name", "orderRef", "paymentIntentId", "phone", "postcode", "safePlace", "status", "stockDeducted", "stripeSessionId", "trackingNo", "trackingUrl", "updatedAt", "userId") SELECT "addressLine1", "addressLine2", "amountTotal", "city", "company", "country", "createdAt", "currency", "deliveryNotes", "email", "id", "name", "orderRef", "paymentIntentId", "phone", "postcode", "safePlace", "status", "stockDeducted", "stripeSessionId", "trackingNo", "trackingUrl", "updatedAt", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderRef_key" ON "Order"("orderRef");
CREATE UNIQUE INDEX "Order_stripeSessionId_key" ON "Order"("stripeSessionId");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_email_createdAt_idx" ON "Order"("email", "createdAt");
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX "Order_paymentIntentId_idx" ON "Order"("paymentIntentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
