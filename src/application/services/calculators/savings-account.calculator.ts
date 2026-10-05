import { IRP_RULES, ISA_RULES, RULE_SET_VERSION } from "../../rules/rule-set.js";

const formatManwon = (won: number): string =>
  Math.round(won / 10000).toLocaleString("ko-KR");

export interface IsaInput {
  annualContribution: number;
  expectedReturnRate: number;
  investmentYears: number;
}

export interface IsaOutput {
  totalContribution: number;
  expectedProfit: number;
  estimatedTaxSaving: number;
  notice: string;
  ruleVersion: string;
}

export interface IrpInput {
  annualContribution: number;
  expectedReturnRate: number;
  investmentYears: number;
  annualIncome: number;
}

export interface IrpOutput {
  expectedBalance: number;
  annualTaxCredit: number;
  totalTaxCredit: number;
  notice: string;
  ruleVersion: string;
}

const futureValueOfMonthlyDeposits = (
  annualContribution: number,
  annualRatePercent: number,
  years: number,
): number => {
  // 월 적립식 월복리 미래가치
  const monthlyRate = annualRatePercent / 100 / 12;
  const months = years * 12;
  const monthlyContribution = annualContribution / 12;
  if (monthlyRate === 0) return monthlyContribution * months;
  return (
    monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
  );
};

export const calculateIsa = (input: IsaInput): IsaOutput => {
  const { annualContribution, expectedReturnRate, investmentYears } = input;

  // 적립 원금과 예상 수익
  const totalContribution = annualContribution * investmentYears;
  const totalBalance = futureValueOfMonthlyDeposits(
    annualContribution,
    expectedReturnRate,
    investmentYears,
  );
  const expectedProfit = Math.max(
    0,
    Math.round(totalBalance - totalContribution),
  );

  // 비과세 한도 내는 일반과세 전액, 초과분은 분리과세와의 차이만큼 절세
  const taxFree = Math.min(expectedProfit, ISA_RULES.taxFreeLimitGeneral);
  const excess = Math.max(0, expectedProfit - ISA_RULES.taxFreeLimitGeneral);
  const estimatedTaxSaving = Math.round(
    taxFree * ISA_RULES.generalTaxRate +
      excess * (ISA_RULES.generalTaxRate - ISA_RULES.separateTaxRate),
  );

  return {
    totalContribution,
    expectedProfit,
    estimatedTaxSaving,
    notice: `투자원금 ${formatManwon(totalContribution)}만원, 일반형 ISA 기준(비과세 한도 200만원, 의무가입 3년). 수익률은 과거 성과를 보장하지 않습니다.`,
    ruleVersion: RULE_SET_VERSION,
  };
};

export const calculateIrp = (input: IrpInput): IrpOutput => {
  const { annualContribution, expectedReturnRate, investmentYears, annualIncome } =
    input;

  // 예상 적립금
  const expectedBalance = Math.round(
    futureValueOfMonthlyDeposits(
      annualContribution,
      expectedReturnRate,
      investmentYears,
    ),
  );

  // 세액공제: 연금계좌 합산 한도 내 납입액 × 소득구간별 공제율
  const deductible = Math.min(
    annualContribution,
    IRP_RULES.maxDeductibleContribution,
  );
  const taxCreditRate =
    annualIncome <= IRP_RULES.lowIncomeThreshold
      ? IRP_RULES.lowIncomeCreditRate
      : IRP_RULES.highIncomeCreditRate;
  const annualTaxCredit = Math.round(deductible * taxCreditRate);
  const totalTaxCredit = annualTaxCredit * investmentYears;

  return {
    expectedBalance,
    annualTaxCredit,
    totalTaxCredit,
    notice: `연 소득 ${formatManwon(annualIncome)}만원 기준 세액공제율 ${(taxCreditRate * 100).toFixed(1)}% 적용(연금저축 포함 연 900만원 한도). 투자원금 ${formatManwon(annualContribution * investmentYears)}만원 대비 예상 적립금입니다.`,
    ruleVersion: RULE_SET_VERSION,
  };
};
