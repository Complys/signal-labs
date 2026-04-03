-- CreateTable
CREATE TABLE "StockPurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "qtyAdded" INTEGER NOT NULL,
    "unitCostPennies" INTEGER NOT NULL,
    "totalCostPennies" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockPurchase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StockPurchase_productId_createdAt_idx" ON "StockPurchase"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockPurchase_createdAt_idx" ON "StockPurchase"("createdAt");
