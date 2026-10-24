-- Cuentas corrientes: cliente dueño + pintor designado.
-- Reparto 70/30 de los puntos de cada venta (70% cliente, 30% pintor).

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "clientPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentAccountId" TEXT,
ADD COLUMN     "painterId" TEXT,
ADD COLUMN     "painterPoints" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CurrentAccount" (
    "id" TEXT NOT NULL,
    "clientUserId" TEXT NOT NULL,
    "painterUserId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrentAccountRevision" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "SaleRevisionStatus" NOT NULL DEFAULT 'PENDIENTE',
    "changes" JSONB NOT NULL,
    "originalData" JSONB NOT NULL,
    "observation" TEXT NOT NULL,
    "adminResponse" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrentAccountRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CurrentAccount_clientUserId_key" ON "CurrentAccount"("clientUserId");

-- CreateIndex
CREATE INDEX "CurrentAccount_painterUserId_idx" ON "CurrentAccount"("painterUserId");

-- CreateIndex
CREATE INDEX "CurrentAccount_active_idx" ON "CurrentAccount"("active");

-- CreateIndex
CREATE INDEX "CurrentAccountRevision_accountId_idx" ON "CurrentAccountRevision"("accountId");

-- CreateIndex
CREATE INDEX "CurrentAccountRevision_status_createdAt_idx" ON "CurrentAccountRevision"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CurrentAccountRevision_requestedById_createdAt_idx" ON "CurrentAccountRevision"("requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "Purchase_currentAccountId_idx" ON "Purchase"("currentAccountId");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_painterId_fkey" FOREIGN KEY ("painterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_currentAccountId_fkey" FOREIGN KEY ("currentAccountId") REFERENCES "CurrentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentAccount" ADD CONSTRAINT "CurrentAccount_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentAccount" ADD CONSTRAINT "CurrentAccount_painterUserId_fkey" FOREIGN KEY ("painterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentAccount" ADD CONSTRAINT "CurrentAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentAccountRevision" ADD CONSTRAINT "CurrentAccountRevision_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CurrentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentAccountRevision" ADD CONSTRAINT "CurrentAccountRevision_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentAccountRevision" ADD CONSTRAINT "CurrentAccountRevision_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: las ventas anteriores a las cuentas corrientes repartían el 100%
-- de los puntos al cliente. Se refleja así en el nuevo esquema para que
-- cancelaciones y revisiones de ventas históricas sigan siendo correctas.
UPDATE "Purchase" SET "clientPoints" = "pointsEarned" WHERE "painterPoints" = 0;
