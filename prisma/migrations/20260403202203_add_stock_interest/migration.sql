-- CreateTable
CREATE TABLE "StockInterest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockInterest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StockInterest_productId_notified_idx" ON "StockInterest"("productId", "notified");

-- CreateIndex
CREATE INDEX "StockInterest_email_idx" ON "StockInterest"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StockInterest_productId_email_key" ON "StockInterest"("productId", "email");
