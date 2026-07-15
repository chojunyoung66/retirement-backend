-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetirementGoal" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "birthYear" INTEGER NOT NULL,
    "retirementYear" INTEGER NOT NULL,
    "monthlyLivingExpense" INTEGER NOT NULL,
    "nationalPension" INTEGER NOT NULL,
    "retirementAsset" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetirementGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthInsuranceSimulation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "monthlyIncome" INTEGER NOT NULL,
    "propertyValue" INTEGER NOT NULL,
    "carValue" INTEGER NOT NULL,
    "estimatedMonthlyPremium" DOUBLE PRECISION NOT NULL,
    "notice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthInsuranceSimulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IsaSimulation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "annualContribution" INTEGER NOT NULL,
    "expectedReturnRate" DOUBLE PRECISION NOT NULL,
    "investmentYears" INTEGER NOT NULL,
    "expectedProfit" DOUBLE PRECISION NOT NULL,
    "estimatedTaxSaving" DOUBLE PRECISION NOT NULL,
    "notice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IsaSimulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PensionPortfolio" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "accountType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PensionPortfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PensionPortfolioItem" (
    "id" SERIAL NOT NULL,
    "portfolioId" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "allocation" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PensionPortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RetirementGoal_userId_key" ON "RetirementGoal"("userId");

-- AddForeignKey
ALTER TABLE "RetirementGoal" ADD CONSTRAINT "RetirementGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthInsuranceSimulation" ADD CONSTRAINT "HealthInsuranceSimulation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IsaSimulation" ADD CONSTRAINT "IsaSimulation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PensionPortfolio" ADD CONSTRAINT "PensionPortfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PensionPortfolioItem" ADD CONSTRAINT "PensionPortfolioItem_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "PensionPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
