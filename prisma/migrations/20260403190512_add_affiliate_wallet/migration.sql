-- CreateTable
CREATE TABLE "AffiliateWallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "pendingPennies" INTEGER NOT NULL DEFAULT 0,
    "availablePennies" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AffiliateWallet_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountPennies" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'gbp',
    "orderId" TEXT,
    "orderRef" TEXT,
    "availableAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "AffiliateWallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AffiliateTransaction_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateWallet_affiliateId_key" ON "AffiliateWallet"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliateTransaction_affiliateId_createdAt_idx" ON "AffiliateTransaction"("affiliateId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliateTransaction_walletId_status_idx" ON "AffiliateTransaction"("walletId", "status");

-- CreateIndex
CREATE INDEX "AffiliateTransaction_availableAt_status_idx" ON "AffiliateTransaction"("availableAt", "status");
