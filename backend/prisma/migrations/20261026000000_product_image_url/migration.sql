-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "imageUrl" TEXT;

-- RenameIndex
ALTER INDEX "Purchase_vendorId_idx" RENAME TO "Purchase_vendorId_createdAt_idx";
