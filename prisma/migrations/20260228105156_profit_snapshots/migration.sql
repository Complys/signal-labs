-- CreateTable
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultRateBps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "receiptEmail" TEXT,
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
    "shippingChargedPennies" INTEGER NOT NULL DEFAULT 0,
    "postageCostPennies" INTEGER NOT NULL DEFAULT 0,
    "trackingNo" TEXT,
    "trackingUrl" TEXT,
    "stockDeducted" BOOLEAN NOT NULL DEFAULT false,
    "affiliateId" TEXT,
    "affiliateCode" TEXT,
    "affiliateRateBpsSnapshot" INTEGER,
    "affiliateCommissionPennies" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("addressLine1", "addressLine2", "amountTotal", "city", "company", "country", "createdAt", "currency", "deliveryNotes", "email", "id", "name", "orderRef", "paymentIntentId", "phone", "postageCostPennies", "postcode", "receiptEmail", "safePlace", "shippingChargedPennies", "status", "stockDeducted", "stripeSessionId", "trackingNo", "trackingUrl", "updatedAt", "userId") SELECT "addressLine1", "addressLine2", "amountTotal", "city", "company", "country", "createdAt", "currency", "deliveryNotes", "email", "id", "name", "orderRef", "paymentIntentId", "phone", coalesce("postageCostPennies", 0) AS "postageCostPennies", "postcode", "receiptEmail", "safePlace", coalesce("shippingChargedPennies", 0) AS "shippingChargedPennies", "status", "stockDeducted", "stripeSessionId", "trackingNo", "trackingUrl", "updatedAt", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderRef_key" ON "Order"("orderRef");
CREATE UNIQUE INDEX "Order_stripeSessionId_key" ON "Order"("stripeSessionId");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_email_createdAt_idx" ON "Order"("email", "createdAt");
CREATE INDEX "Order_receiptEmail_createdAt_idx" ON "Order"("receiptEmail", "createdAt");
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX "Order_paymentIntentId_idx" ON "Order"("paymentIntentId");
CREATE INDEX "Order_affiliateId_createdAt_idx" ON "Order"("affiliateId", "createdAt");
CREATE INDEX "Order_affiliateCode_createdAt_idx" ON "Order"("affiliateCode", "createdAt");
CREATE TABLE "new_OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "lineTotal" INTEGER NOT NULL DEFAULT 0,
    "unitCostPennies" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("createdAt", "id", "lineTotal", "name", "orderId", "productId", "quantity", "unitCostPennies", "unitPrice") SELECT "createdAt", "id", "lineTotal", "name", "orderId", "productId", "quantity", coalesce("unitCostPennies", 0) AS "unitCostPennies", "unitPrice" FROM "OrderItem";
DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_code_key" ON "Affiliate"("code");
