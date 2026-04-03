-- CreateTable
CREATE TABLE "BusinessExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "amountPennies" INTEGER NOT NULL,
    "incurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "BusinessExpense_incurredAt_idx" ON "BusinessExpense"("incurredAt");

-- CreateIndex
CREATE INDEX "BusinessExpense_category_incurredAt_idx" ON "BusinessExpense"("category", "incurredAt");
