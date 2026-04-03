-- CreateTable
CREATE TABLE "AffiliateTermsAcceptance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "termsUrl" TEXT,
    "termsText" TEXT,
    "acceptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "AffiliateTermsAcceptance_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateClick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "landingPath" TEXT,
    "referrer" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateClick_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliatePayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "amountPennies" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'gbp',
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AffiliatePayout_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Affiliate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "tiktok" TEXT,
    "youtube" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultRateBps" INTEGER NOT NULL DEFAULT 0,
    "termsVersion" TEXT,
    "termsAcceptedAt" DATETIME,
    "termsIpHash" TEXT,
    "termsUserAgent" TEXT,
    "payoutMethod" TEXT,
    "payoutDetails" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Affiliate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Affiliate" ("code", "createdAt", "defaultRateBps", "id", "isActive", "name", "updatedAt") SELECT "code", "createdAt", "defaultRateBps", "id", "isActive", "name", "updatedAt" FROM "Affiliate";
DROP TABLE "Affiliate";
ALTER TABLE "new_Affiliate" RENAME TO "Affiliate";
CREATE UNIQUE INDEX "Affiliate_code_key" ON "Affiliate"("code");
CREATE UNIQUE INDEX "Affiliate_userId_key" ON "Affiliate"("userId");
CREATE INDEX "Affiliate_status_createdAt_idx" ON "Affiliate"("status", "createdAt");
CREATE INDEX "Affiliate_isActive_createdAt_idx" ON "Affiliate"("isActive", "createdAt");
CREATE INDEX "Affiliate_email_createdAt_idx" ON "Affiliate"("email", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AffiliateTermsAcceptance_affiliateId_acceptedAt_idx" ON "AffiliateTermsAcceptance"("affiliateId", "acceptedAt");

-- CreateIndex
CREATE INDEX "AffiliateTermsAcceptance_termsVersion_acceptedAt_idx" ON "AffiliateTermsAcceptance"("termsVersion", "acceptedAt");

-- CreateIndex
CREATE INDEX "AffiliateClick_affiliateId_createdAt_idx" ON "AffiliateClick"("affiliateId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliatePayout_affiliateId_createdAt_idx" ON "AffiliatePayout"("affiliateId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliatePayout_status_createdAt_idx" ON "AffiliatePayout"("status", "createdAt");
