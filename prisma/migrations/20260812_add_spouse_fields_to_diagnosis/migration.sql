-- AlterTable
ALTER TABLE "Diagnosis" ADD COLUMN "householdSize" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Diagnosis" ADD COLUMN "spouseBirthYear" INTEGER;
ALTER TABLE "Diagnosis" ADD COLUMN "spouseRetirementYear" INTEGER;
