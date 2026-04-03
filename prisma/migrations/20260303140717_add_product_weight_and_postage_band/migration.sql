-- AlterTable
ALTER TABLE "Product" ADD COLUMN "weightGrams" INTEGER;

-- CreateTable
CREATE TABLE "PostageBand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "maxWeightGrams" INTEGER NOT NULL,
    "maxItems" INTEGER,
    "costPennies" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "PostageBand_isActive_sortOrder_idx" ON "PostageBand"("isActive", "sortOrder");
