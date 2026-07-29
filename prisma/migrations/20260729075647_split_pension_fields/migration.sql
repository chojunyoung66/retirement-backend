/*
  Warnings:

  - You are about to drop the column `monthlyIncome` on the `Diagnosis` table. All the data in the column will be lost.
  - Added the required column `nationalPension` to the `Diagnosis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `personalPension` to the `Diagnosis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `retirementPension` to the `Diagnosis` table without a default value. This is not possible if the table is not empty.

*/
-- Step 1: nullable로 컬럼 추가
ALTER TABLE "Diagnosis"
ADD COLUMN "nationalPension" INTEGER,
ADD COLUMN "retirementPension" INTEGER,
ADD COLUMN "personalPension" INTEGER;

-- Step 2: 기존 데이터 이관 (monthlyIncome → nationalPension, 나머지 0)
UPDATE "Diagnosis"
SET "nationalPension" = "monthlyIncome",
    "retirementPension" = 0,
    "personalPension" = 0;

-- Step 3: NOT NULL 제약 추가
ALTER TABLE "Diagnosis"
ALTER COLUMN "nationalPension" SET NOT NULL,
ALTER COLUMN "retirementPension" SET NOT NULL,
ALTER COLUMN "personalPension" SET NOT NULL;

-- Step 4: 기존 컬럼 제거
ALTER TABLE "Diagnosis" DROP COLUMN "monthlyIncome";
