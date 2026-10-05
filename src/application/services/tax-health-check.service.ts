import { HEALTH_INSURANCE_RULES, RULE_SET_VERSION } from "../rules/rule-set.js";
import { calculateHealthInsurance } from "./calculators/health-insurance.calculator.js";
import {
  assessDependent,
  DEPENDENT_REASON_LABEL,
  DEPENDENT_STATUS_LABEL,
} from "./withdrawal/dependent.js";
import type { BasisDate, DependentReason, DependentStatus } from "./withdrawal/types.js";

/** 실제 고지액이 추정치의 이 비율 이내면 비슷한 수준으로 본다 */
export const PREMIUM_MATCH_RATIO = 0.1;

export interface TaxHealthCheckRequest {
  /** 연 금액(원) */
  publicPensionAnnual: number;
  laborIncome: number;
  businessIncome: number;
  financialIncome: number;
  otherIncome: number;
  /** 재산 과세표준, 모르면 null */
  propertyValue: number | null;
  carValue: number;
  /** 실제 고지된 월 건강보험료(장기요양 포함), 없으면 null */
  actualMonthlyPremium: number | null;
  /** 배우자 연 소득(공적연금·근로 등 합계), 배우자가 없으면 null */
  spouseAnnualIncome: number | null;
}

export type PremiumComparison = "ESTIMATE_ONLY" | "SIMILAR" | "ACTUAL_HIGHER" | "ACTUAL_LOWER";

export interface TaxHealthCheckResult {
  dependent: {
    status: DependentStatus;
    statusLabel: string;
    reasons: { code: DependentReason; label: string }[];
    likelyFails: boolean;
  };
  premium: {
    estimatedMonthly: number;
    incomePremium: number;
    propertyPremium: number;
    carPremium: number;
    longTermCarePremium: number;
    actualMonthly: number | null;
    differenceMonthly: number | null;
    comparison: PremiumComparison;
  };
  financialIncome: { amount: number; countedInFull: boolean };
  checklist: string[];
  basisDate: BasisDate;
  ruleVersion: string;
  notices: string[];
}

const compare = (estimated: number, actual: number | null): PremiumComparison => {
  if (actual === null) return "ESTIMATE_ONLY";
  const tolerance = Math.max(estimated * PREMIUM_MATCH_RATIO, 1);
  if (Math.abs(actual - estimated) <= tolerance) return "SIMILAR";
  return actual > estimated ? "ACTUAL_HIGHER" : "ACTUAL_LOWER";
};

export const createTaxHealthCheckService = () => ({
  /** 피부양자 추정과 지역 보험료 추정·실제 고지액 비교 — 입력값은 저장하지 않는다 */
  check(req: TaxHealthCheckRequest): TaxHealthCheckResult {
    // 피부양자 3단계 추정
    const assessment = assessDependent({
      publicPensionAnnual: req.publicPensionAnnual,
      otherIncomeAnnual: req.laborIncome + req.businessIncome + req.otherIncome,
      businessIncomeAnnual: req.businessIncome,
      financialIncomeAnnual: req.financialIncome,
      propertyValue: req.propertyValue,
      spousePublicPensionAnnual: req.spouseAnnualIncome,
    });

    // 지역가입자 보험료 추정(재산 미입력이면 재산분 제외)
    const estimate = calculateHealthInsurance({
      pensionIncome: req.publicPensionAnnual,
      laborIncome: req.laborIncome,
      businessIncome: req.businessIncome,
      interestDividendIncome: req.financialIncome,
      otherIncome: req.otherIncome,
      propertyValue: req.propertyValue ?? 0,
      carValue: req.carValue,
    });
    const actual = req.actualMonthlyPremium;
    const countedInFull = req.financialIncome > HEALTH_INSURANCE_RULES.financialIncomeExclusion;

    // 사용자가 확인할 항목
    const checklist: string[] = [
      "건강보험공단 ‘보험료 조회’에서 현재 고지 보험료와 자격(직장·지역·피부양자)을 확인하세요.",
      "국민연금 개시 후 연금액이 늘면 피부양자 요건을 다시 확인하세요.",
    ];
    if (req.propertyValue === null) {
      checklist.unshift("재산세 과세표준(주택·토지)을 입력하면 피부양자 재산요건을 추정할 수 있습니다.");
    }
    if (countedInFull) {
      checklist.push("이자·배당이 1,000만원을 넘으면 전액 소득에 반영됩니다. ISA·연금계좌로 금융소득 분산을 검토하세요.");
    }
    if (req.spouseAnnualIncome !== null) {
      checklist.push("부부는 한 명이라도 소득요건을 넘으면 함께 피부양자에서 제외될 수 있습니다.");
    }

    const notices = [
      "확정 판정이 아닌 추정입니다. 실제 자격과 보험료는 국민건강보험공단 고지 기준을 따릅니다.",
      "사적연금(연금저축·IRP·퇴직연금) 수령액은 현행 기준상 피부양자 소득과 지역보험료 산정에서 제외했습니다.",
    ];
    if (actual !== null) {
      notices.push("고지 보험료는 전년도 소득·당해 재산 기준이라 추정치와 차이가 날 수 있습니다.");
    }

    return {
      dependent: {
        status: assessment.status,
        statusLabel: DEPENDENT_STATUS_LABEL[assessment.status],
        reasons: assessment.reasons.map((code) => ({ code, label: DEPENDENT_REASON_LABEL[code] })),
        likelyFails: assessment.fails,
      },
      premium: {
        estimatedMonthly: estimate.estimatedMonthlyPremium,
        incomePremium: estimate.incomePremium,
        propertyPremium: estimate.propertyPremium,
        carPremium: estimate.carPremium,
        longTermCarePremium: estimate.longTermCarePremium,
        actualMonthly: actual,
        differenceMonthly: actual === null ? null : actual - estimate.estimatedMonthlyPremium,
        comparison: compare(estimate.estimatedMonthlyPremium, actual),
      },
      financialIncome: { amount: req.financialIncome, countedInFull },
      checklist,
      basisDate: { domain: "건강보험", ...HEALTH_INSURANCE_RULES.meta },
      ruleVersion: RULE_SET_VERSION,
      notices,
    };
  },
});

export type TaxHealthCheckServiceType = ReturnType<typeof createTaxHealthCheckService>;
