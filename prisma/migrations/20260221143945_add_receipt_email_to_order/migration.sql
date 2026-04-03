-- AlterTable
ALTER TABLE "Order" ADD COLUMN "receiptEmail" TEXT;

-- CreateIndex
CREATE INDEX "Order_receiptEmail_createdAt_idx" ON "Order"("receiptEmail", "createdAt");
