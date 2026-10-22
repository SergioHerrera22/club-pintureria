-- CreateTable
CREATE TABLE "TierConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minPoints" INTEGER NOT NULL DEFAULT 0,
    "maxPoints" INTEGER,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "pointsMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "pointsExpiryDays" INTEGER,
    "birthdayBonusPoints" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TierConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TierConfig_name_key" ON "TierConfig"("name");

-- CreateIndex
CREATE INDEX "TierConfig_isActive_sortOrder_idx" ON "TierConfig"("isActive", "sortOrder");
