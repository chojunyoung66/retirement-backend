import {
  UNEMPLOYMENT_RULES as R,
  RULE_SET_VERSION,
} from "../../rules/rule-set.js";

export interface UnemploymentBenefitInput {
  averageMonthlyWage: number;
  insuranceYears: number;
  age: number;
}

export interface UnemploymentBenefitOutput {
  benefitDays: number;
  dailyBenefit: number;
  monthlyBenefit: number;
  totalBenefit: number;
  notice: string;
  ruleVersion: string;
}

export const getBenefitDays = (age: number, insuranceYears: number): number => {
  // 연령대·가입기간 구간별 소정급여일수
  const table = age >= 50 ? R.benefitDays.age50OrOver : R.benefitDays.under50;
  return table.find((r) => insuranceYears < r.underYears)!.days;
};

export const calculateUnemploymentBenefit = (
  input: UnemploymentBenefitInput,
): UnemploymentBenefitOutput => {
  const { averageMonthlyWage, insuranceYears, age } = input;
  const benefitDays = getBenefitDays(age, insuranceYears);

  // 1일 구직급여: 평균임금 일액 × 60%를 상·하한으로 제한
  const dailyWage = averageMonthlyWage / 30;
  const dailyBenefit = Math.round(
    Math.min(
      R.maxDailyBenefit,
      Math.max(R.minDailyBenefit, dailyWage * R.replacementRate),
    ),
  );

  // 월 환산과 총액
  const monthlyBenefit = dailyBenefit * 30;
  const totalBenefit = dailyBenefit * benefitDays;
  const months = Math.round(benefitDays / 30);

  return {
    benefitDays,
    dailyBenefit,
    monthlyBenefit,
    totalBenefit,
    notice: `고용보험 ${insuranceYears}년 가입, ${age}세 기준 ${benefitDays}일(약 ${months}개월) 수급 추정치입니다(2026년 상·하한 적용). 수급 자격과 일수는 고용센터에서 확인하세요.`,
    ruleVersion: RULE_SET_VERSION,
  };
};
