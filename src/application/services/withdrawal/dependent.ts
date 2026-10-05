import { HEALTH_INSURANCE_RULES } from "../../rules/rule-set.js";
import type { DependentReason, DependentStatus } from "./types.js";

export interface DependentInput {
  /** 공적연금(국민연금) 연 수령액 — 피부양자 소득요건에 전액 반영 */
  publicPensionAnnual: number;
  /** 과세 이자·배당 연 합계 — 1,000만원 초과 시 전액 반영 */
  financialIncomeAnnual: number;
  propertyValue: number | null;
  /** 근로·기타 등 공적연금 외 연 소득(사업소득 포함) */
  otherIncomeAnnual?: number;
  /** 사업자등록 없는 사업소득 — 500만원 초과 시 요건 초과 */
  businessIncomeAnnual?: number;
  /** 배우자 연 소득(공적연금 등) — 배우자가 없으면 생략 */
  spousePublicPensionAnnual?: number | null;
}

export interface DependentAssessment {
  status: DependentStatus;
  reasons: DependentReason[];
  /** 경계 근접이 아니라 요건 초과로 지역가입 전환이 예상되는지 */
  fails: boolean;
}

// 소득 한도의 이 비율을 넘으면 '주의'
const CAUTION_RATIO = 0.9;

export const DEPENDENT_STATUS_LABEL: Record<DependentStatus, string> = {
  LIKELY: "추정 가능",
  CAUTION: "주의",
  CHECK_NEEDED: "확인 필요",
};

export const DEPENDENT_REASON_LABEL: Record<DependentReason, string> = {
  PROPERTY_UNKNOWN: "재산 정보가 없어 판단할 수 없음",
  INCOME_OVER: "연 소득이 2,000만원 기준을 넘음",
  INCOME_NEAR: "연 소득이 2,000만원 기준에 가까움",
  BUSINESS_INCOME_OVER: "사업소득이 500만원 기준을 넘음",
  FINANCIAL_INCOME_OVER: "이자·배당이 1,000만원을 넘어 전액 소득에 반영됨",
  FINANCIAL_INCOME_NEAR: "이자·배당이 1,000만원 기준에 가까움",
  PROPERTY_MID: "재산 5.4억 초과 구간(연 소득 1,000만원 이하만 가능)",
  PROPERTY_OVER: "재산이 9억 기준을 넘음",
  SPOUSE_INCOME_OVER: "배우자 소득이 기준을 넘어 부부가 함께 탈락할 수 있음",
  SPOUSE_INCOME_NEAR: "배우자 소득이 기준에 가까움",
};

/**
 * 피부양자 요건을 확정 판정이 아닌 3단계 추정과 사유로 돌려준다.
 * 사적연금·퇴직연금 수령액은 현행 기준상 피부양자 소득에 포함하지 않는다.
 * 부부는 한 명이라도 소득요건을 넘으면 함께 탈락하므로 배우자 소득도 본다.
 */
export const assessDependent = (input: DependentInput): DependentAssessment => {
  if (input.propertyValue === null) {
    return { status: "CHECK_NEEDED", reasons: ["PROPERTY_UNKNOWN"], fails: false };
  }

  const d = HEALTH_INSURANCE_RULES.dependent;
  const exclusion = HEALTH_INSURANCE_RULES.financialIncomeExclusion;
  const reasons: DependentReason[] = [];

  // 소득요건: 공적연금 + 기타 소득 + 기준 초과 금융소득, 사업소득 별도 한도
  const countedFinancial = input.financialIncomeAnnual > exclusion ? input.financialIncomeAnnual : 0;
  const income = input.publicPensionAnnual + (input.otherIncomeAnnual ?? 0) + countedFinancial;
  if (income > d.maxAnnualIncome) reasons.push("INCOME_OVER");
  else if (income > d.maxAnnualIncome * CAUTION_RATIO) reasons.push("INCOME_NEAR");
  if ((input.businessIncomeAnnual ?? 0) > d.maxBusinessIncome) reasons.push("BUSINESS_INCOME_OVER");

  // 금융소득 경계
  if (input.financialIncomeAnnual > exclusion) reasons.push("FINANCIAL_INCOME_OVER");
  else if (input.financialIncomeAnnual > exclusion * CAUTION_RATIO) {
    reasons.push("FINANCIAL_INCOME_NEAR");
  }

  // 재산요건: 9억 초과 불가, 5.4억 초과는 소득 1천만원 이하만 가능
  if (input.propertyValue > d.propertyMax) reasons.push("PROPERTY_OVER");
  else if (input.propertyValue > d.propertyAlwaysOk) reasons.push("PROPERTY_MID");

  // 배우자 소득요건
  const spouse = input.spousePublicPensionAnnual;
  if (spouse != null) {
    if (spouse > d.maxAnnualIncome) reasons.push("SPOUSE_INCOME_OVER");
    else if (spouse > d.maxAnnualIncome * CAUTION_RATIO) reasons.push("SPOUSE_INCOME_NEAR");
  }

  // 요건 초과 여부: 소득·재산·배우자 소득 초과 또는 재산 중간 구간에서 소득 1천만원 초과
  const fails =
    reasons.includes("INCOME_OVER") ||
    reasons.includes("BUSINESS_INCOME_OVER") ||
    reasons.includes("PROPERTY_OVER") ||
    reasons.includes("SPOUSE_INCOME_OVER") ||
    (reasons.includes("PROPERTY_MID") && income > d.incomeLimitForMidProperty);

  return { status: reasons.length === 0 ? "LIKELY" : "CAUTION", reasons, fails };
};

export const dependentStatusOf = (input: DependentInput): DependentStatus =>
  assessDependent(input).status;
