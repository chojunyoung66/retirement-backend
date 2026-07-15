/*
  Warnings:

  - Added the required column `type` to the `SimulationResult` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SimulationType" AS ENUM ('HEALTH_INSURANCE', 'ISA');

-- AlterTable
ALTER TABLE "SimulationResult" ADD COLUMN     "type" "SimulationType" NOT NULL;

-- CreateIndex
CREATE INDEX "SimulationResult_userId_type_idx" ON "SimulationResult"("userId", "type");
