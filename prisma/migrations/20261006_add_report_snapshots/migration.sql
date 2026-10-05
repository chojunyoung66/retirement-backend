-- CreateTable
CREATE TABLE "ReportSnapshot" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "scenarioSetId" INTEGER,
    "scenarioType" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportSnapshot_userId_generatedAt_idx" ON "ReportSnapshot"("userId", "generatedAt");

-- AddForeignKey
ALTER TABLE "ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_scenarioSetId_fkey" FOREIGN KEY ("scenarioSetId") REFERENCES "WithdrawalScenarioSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
