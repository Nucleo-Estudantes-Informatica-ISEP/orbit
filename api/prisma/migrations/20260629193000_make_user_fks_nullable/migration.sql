-- Make user FKs nullable with ON DELETE SET NULL

-- RecruitmentComment
ALTER TABLE "RecruitmentComment" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "RecruitmentComment" DROP CONSTRAINT "RecruitmentComment_createdById_fkey";
ALTER TABLE "RecruitmentComment" ADD CONSTRAINT "RecruitmentComment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL;

-- AuditLog
ALTER TABLE "AuditLog" ALTER COLUMN "performedById" DROP NOT NULL;
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_performedById_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL;

-- Plan
ALTER TABLE "Plan" DROP CONSTRAINT "Plan_approvedById_fkey";
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL;

-- InventoryItem
ALTER TABLE "InventoryItem" DROP CONSTRAINT "InventoryItem_purchasedById_fkey";
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_purchasedById_fkey" FOREIGN KEY ("purchasedById") REFERENCES "User"("id") ON DELETE SET NULL;
