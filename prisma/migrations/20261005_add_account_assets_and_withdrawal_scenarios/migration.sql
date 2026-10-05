-- CreateEnum
CREATE TYPE "AccountAssetType" AS ENUM ('DC', 'PENSION_SAVINGS', 'IRP', 'ISA', 'BROKERAGE', 'CASH');

-- CreateEnum
CREATE TYPE "IrpSource" AS ENUM ('PERSONAL', 'SEVERANCE', 'MIXED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "AccountAsset" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "accountType" "AccountAssetType" NOT NULL,
    "accountName" TEXT,
    "institution" TEXT,
    "balance" INTEGER NOT NULL,
    "principalTaxCredited" INTEGER NOT NULL DEFAULT 0,
    "principalNonDeductible" INTEGER NOT NULL DEFAULT 0,
    "investmentGain" INTEGER NOT NULL DEFAULT 0,
    "deferredRetirementIncome" INTEGER NOT NULL DEFAULT 0,
    "irpSource" "IrpSource",
    "pensionSavingsLegacy" BOOLEAN,
    "isaMaturityYm" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalScenarioSet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "selectedType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WithdrawalScenarioSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountAsset_userId_idx" ON "AccountAsset"("userId");

-- CreateIndex
CREATE INDEX "WithdrawalScenarioSet_userId_createdAt_idx" ON "WithdrawalScenarioSet"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AccountAsset" ADD CONSTRAINT "AccountAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalScenarioSet" ADD CONSTRAINT "WithdrawalScenarioSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
