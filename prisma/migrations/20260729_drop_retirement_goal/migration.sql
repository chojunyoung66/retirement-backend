-- DropForeignKey
ALTER TABLE "RetirementGoal" DROP CONSTRAINT IF EXISTS "RetirementGoal_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "RetirementGoal";
