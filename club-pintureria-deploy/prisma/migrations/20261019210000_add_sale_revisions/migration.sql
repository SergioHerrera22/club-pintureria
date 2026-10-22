-- CreateEnum
CREATE TYPE "SaleRevisionStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "SaleRevision" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "SaleRevisionStatus" NOT NULL DEFAULT 'PENDIENTE',
    "changes" JSONB NOT NULL,
    "originalData" JSONB NOT NULL,
    "observation" TEXT NOT NULL,
    "preview" JSONB,
    "adminResponse" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaleRevision_purchaseId_idx" ON "SaleRevision"("purchaseId");
CREATE INDEX "SaleRevision_status_createdAt_idx" ON "SaleRevision"("status", "createdAt");
CREATE INDEX "SaleRevision_requestedById_createdAt_idx" ON "SaleRevision"("requestedById", "createdAt");
CREATE INDEX "Purchase_cashierId_createdAt_idx" ON "Purchase"("cashierId", "createdAt");

-- AddForeignKey
ALTER TABLE "SaleRevision" ADD CONSTRAINT "SaleRevision_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleRevision" ADD CONSTRAINT "SaleRevision_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleRevision" ADD CONSTRAINT "SaleRevision_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
