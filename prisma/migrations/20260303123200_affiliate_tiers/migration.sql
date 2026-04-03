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
    "tier" TEXT NOT NULL DEFAULT 'STANDARD',
    "defaultRateBps" INTEGER NOT NULL DEFAULT 500,
    "rateOverrideBps" INTEGER,
    "cookieDays" INTEGER NOT NULL DEFAULT 30,
    "perksJson" TEXT,
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
CREATE INDEX "Affiliate_tier_createdAt_idx" ON "Affiliate"("tier", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
