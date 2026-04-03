-- AlterTable
ALTER TABLE "Order" ADD COLUMN "postageCostPennies" INTEGER;
ALTER TABLE "Order" ADD COLUMN "shippingChargedPennies" INTEGER;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "unitCostPennies" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "costPennies" INTEGER;
