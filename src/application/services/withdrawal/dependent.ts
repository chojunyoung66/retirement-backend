import { HEALTH_INSURANCE_RULES } from "../../rules/rule-set.js";
import { isDependentLikely } from "../calculators/health-insurance.calculator.js";
import type { DependentStatus } from "./types.js";

export interface DependentInput {
  /** 공적연금(국민연금) 연 수령액 — 피부양자 소득요건에 전액 반영 */
  publicPensionAnnual: number;
  /** 과세 이자·배당 연 합계 — 1,000만원 초과 시 전액 반영 */
  financialIncomeAnnual: number;
  propertyValue: number | null;
}

// 소득 한도의 이 비율을 넘으면 '주의'
const CAUTION_RATIO = 0.9;

export const DEPENDENT_STATUS_LABEL: Record<DependentStatus, string> = {
  LIKELY: "추정 가능",
  CAUTION: "주의",
  CHECK_NEEDED: "확인 필요",
};

/**
 * 피부양자 상태를 확정 판정이 아닌 3단계 추정으로만 돌려준다.
 * 사적연금·퇴직연금 수령액은 현행 기준상 피부양자 소득에 포함하지 않는다.
 */
export const dependentStatusOf = (input: DependentInput): DependentStatus => {
  if (input.propertyValue === null) return "CHECK_NEEDED";

  const likely = isDependentLikely({
    pensionIncome: input.publicPensionAnnual,
    laborIncome: 0,
    businessIncome: 0,
    interestDividendIncome: input.financialIncomeAnnual,
    otherIncome: 0,
    propertyValue: input.propertyValue,
    carValue: 0,
  });
  if (!likely) return "CAUTION";

  const d = HEALTH_INSURANCE_RULES.dependent;
  const countedFinancial =
    input.financialIncomeAnnual > HEALTH_INSURANCE_RULES.financialIncomeExclusion
      ? input.financialIncomeAnnual
      : 0;
  const income = input.publicPensionAnnual + countedFinancial;
  const nearIncomeLimit = income > d.maxAnnualIncome * CAUTION_RATIO;
  const nearFinancialLimit =
    input.financialIncomeAnnual >
    HEALTH_INSURANCE_RULES.financialIncomeExclusion * CAUTION_RATIO;
  const midProperty = input.propertyValue > d.propertyAlwaysOk;
  return nearIncomeLimit || nearFinancialLimit || midProperty
    ? "CAUTION"
    : "LIKELY";
};
