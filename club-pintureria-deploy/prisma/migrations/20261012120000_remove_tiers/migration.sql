-- Eliminar por completo el sistema de tiers

-- DropTable TierChangeLog
DROP TABLE IF EXISTS "TierChangeLog";

-- DropTable TierConfig
DROP TABLE IF EXISTS "TierConfig";

-- AlterTable ClientProfile
ALTER TABLE "ClientProfile" DROP COLUMN IF EXISTS "tier";
ALTER TABLE "ClientProfile" DROP COLUMN IF EXISTS "pendingTier";

-- AlterTable Promotion
ALTER TABLE "Promotion" DROP COLUMN IF EXISTS "tiers";

-- AlterTable Challenge
ALTER TABLE "Challenge" DROP COLUMN IF EXISTS "tiers";

-- AlterTable Benefit
DROP INDEX IF EXISTS "Benefit_tierRequired_isActive_idx";
ALTER TABLE "Benefit" DROP COLUMN IF EXISTS "tierRequired";
CREATE INDEX IF NOT EXISTS "Benefit_isActive_idx" ON "Benefit"("isActive");
