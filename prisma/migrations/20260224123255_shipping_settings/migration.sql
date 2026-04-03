-- CreateTable
CREATE TABLE "ShippingSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "freeOverPennies" INTEGER NOT NULL DEFAULT 3000,
    "flatRatePennies" INTEGER NOT NULL DEFAULT 499,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "OrderEvent_source_createdAt_idx" ON "OrderEvent"("source", "createdAt");
