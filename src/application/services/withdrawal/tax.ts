import {
  ISA_RULES,
  PENSION_INCOME_TAX_RULES as P,
  SEVERANCE_TAX_RULES,
} from "../../rules/rule-set.js";
import { calculateRetirementIncomeTax } from "../calculators/severance-pay.calculator.js";

/** 세액공제 원금·운용수익을 연금수령할 때 나이별 원천징수세율 */
export const privatePensionRateOf = (age: number): number =>
  P.privatePensionRateByAge.find((row) => age >= row.fromAge)!.rate;

/** 이연퇴직소득 연금수령 시 퇴직소득세 대비 적용 비율(실제 수령연차 기준) */
export const deferredRatioOf = (receiptYear: number): number =>
  P.deferredRetirementRatioByYear.find((row) => receiptYear <= row.upToYear)!
    .ratio;

/** 퇴직소득 재원 전체를 일시금으로 받을 때의 실효 퇴직소득세율 */
export const retirementTaxRateOf = (
  retirementIncome: number,
  yearsOfService: number,
): number => {
  if (retirementIncome <= 0) return 0;
  const { totalTax } = calculateRetirementIncomeTax(
    retirementIncome,
    yearsOfService,
  );
  return totalTax / retirementIncome;
};

/** 연간 사적연금 과세대상 수령액이 기준을 넘으면 16.5% 분리과세로 보수 계산할 때의 추가 세액 */
export const overThresholdExtraTax = (
  annualTaxableAnnuity: number,
  taxAlreadyWithheld: number,
): number => {
  if (annualTaxableAnnuity <= P.separateTaxThreshold) return 0;
  return Math.max(
    0,
    annualTaxableAnnuity * P.overThresholdSeparateRate - taxAlreadyWithheld,
  );
};

/**
 * 지방소득세가 포함된 세액을 소득세와 지방소득세로 나눈다.
 * 엔진의 모든 세율이 국세 × (1 + 지방소득세율)이라는 전제에 의존한다.
 */
export const splitLocalTax = (
  totalTax: number,
): { incomeTax: number; localIncomeTax: number } => {
  const r = SEVERANCE_TAX_RULES.localIncomeTaxRate;
  const localIncomeTax = Math.round((totalTax * r) / (1 + r));
  return { incomeTax: totalTax - localIncomeTax, localIncomeTax };
};

/** 연금수령한도 — 11년차부터는 한도가 없어 null */
export const annuityLimitOf = (
  openingBalance: number,
  receiptYear: number,
): number | null =>
  receiptYear >= P.annuityLimitFreeFromYear
    ? null
    : (openingBalance / (P.annuityLimitFreeFromYear - receiptYear)) *
      P.annuityLimitMultiplier;

/** 일반 계좌 이자·배당 원천징수세율(지방소득세 포함) */
export const interestTaxRate = ISA_RULES.generalTaxRate;
export const isaGainTaxRate = ISA_RULES.separateTaxRate;
export const isaTaxFreeLimit = ISA_RULES.taxFreeLimitGeneral;
export const nonAnnuityRate = P.nonAnnuityOtherIncomeRate;
export const annuityMinAge = P.annuityMinAge;
export const separateTaxThreshold = P.separateTaxThreshold;
