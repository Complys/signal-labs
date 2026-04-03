/*
  Warnings:

  - You are about to drop the `AffiliatePayout` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `payoutDetails` on the `Affiliate` table. All the data in the column will be lost.
  - You are about to drop the column `payoutMethod` on the `Affiliate` table. All the data in the column will be lost.
  - Made the column `name` on table `Affiliate` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "AffiliatePayout_status_createdAt_idx";

-- DropIndex
DROP INDEX "AffiliatePayout_affiliateId_createdAt_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AffiliatePayout";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "AffiliateApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "instagram" TEXT,
    "tiktok" TEXT,
    "youtube" TEXT,
    "notes" TEXT,
    "affiliateId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AffiliateApplication_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliatePayoutRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amountPennies" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'gbp',
    "accountName" TEXT NOT NULL,
    "sortCode" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "reference" TEXT,
    "adminNote" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AffiliatePayoutRequest_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Affiliate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "tiktok" TEXT,
    "youtube" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultRateBps" INTEGER NOT NULL DEFAULT 500,
    "termsVersion" TEXT,
    "termsAcceptedAt" DATETIME,
    "termsIpHash" TEXT,
    "termsUserAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Affiliate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Affiliate" ("code", "createdAt", "defaultRateBps", "email", "id", "instagram", "isActive", "name", "status", "termsAcceptedAt", "termsIpHash", "termsUserAgent", "termsVersion", "tiktok", "updatedAt", "userId", "website", "youtube") SELECT "code", "createdAt", "defaultRateBps", "email", "id", "instagram", "isActive", "name", "status", "termsAcceptedAt", "termsIpHash", "termsUserAgent", "termsVersion", "tiktok", "updatedAt", "userId", "website", "youtube" FROM "Affiliate";
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
CREATE INDEX "AffiliateApplication_status_createdAt_idx" ON "AffiliateApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliateApplication_requestedCode_idx" ON "AffiliateApplication"("requestedCode");

-- CreateIndex
CREATE INDEX "AffiliateApplication_email_idx" ON "AffiliateApplication"("email");

-- CreateIndex
CREATE INDEX "AffiliatePayoutRequest_affiliateId_requestedAt_idx" ON "AffiliatePayoutRequest"("affiliateId", "requestedAt");

-- CreateIndex
CREATE INDEX "AffiliatePayoutRequest_status_requestedAt_idx" ON "AffiliatePayoutRequest"("status", "requestedAt");
