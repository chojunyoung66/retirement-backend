/*
  Warnings:

  - You are about to drop the column `monthlyIncome` on the `Diagnosis` table. All the data in the column will be lost.
  - Added the required column `nationalPension` to the `Diagnosis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `personalPension` to the `Diagnosis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `retirementPension` to the `Diagnosis` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Diagnosis" DROP COLUMN "monthlyIncome",
ADD COLUMN     "nationalPension" INTEGER NOT NULL,
ADD COLUMN     "personalPension" INTEGER NOT NULL,
ADD COLUMN     "retirementPension" INTEGER NOT NULL;
