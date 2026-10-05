import {
  NATIONAL_PENSION_RULES as R,
  RULE_SET_VERSION,
} from "../../rules/rule-set.js";

export interface NationalPensionInput {
  monthlyIncome: number;
  contributionYears: number;
  birthYear: number;
}

export interface NationalPensionOutput {
  eligible: boolean;
  estimatedMonthlyPension: number;
  pensionStartAge: number;
  appliedIncome: number;
  notice: string;
  ruleVersion: string;
}

export const getPensionStartAge = (birthYear: number): number => {
  // 출생연도 구간별 수급개시연령 조회
  const row = R.startAgeByBirthYear.find((r) => birthYear >= r.fromBirthYear);
  return row ? row.age : R.defaultStartAge;
};

export const calculateNationalPension = (
  input: NationalPensionInput,
): NationalPensionOutput => {
  const { monthlyIncome, contributionYears, birthYear } = input;

  // 본인 소득을 기준소득월액 상·하한으로 제한해 B값으로 사용
  const appliedIncome = Math.min(
    R.maxReportedIncome,
    Math.max(R.minReportedIncome, monthlyIncome),
  );
  const contributionMonths = Math.round(contributionYears * 12);
  const pensionStartAge = getPensionStartAge(birthYear);

  // 최소 가입기간 미달 시 노령연금 대신 반환일시금 대상
  if (contributionMonths < R.minContributionMonths) {
    return {
      eligible: false,
      estimatedMonthlyPension: 0,
      pensionStartAge,
      appliedIncome,
      notice: `가입기간 ${contributionYears}년은 노령연금 최소 가입기간(10년)에 못 미쳐 반환일시금 대상입니다. 임의계속가입으로 기간을 채울 수 있는지 국민연금공단에 확인하세요.`,
      ruleVersion: RULE_SET_VERSION,
    };
  }

  // 기본연금액(연) = 비례상수 × (A + B) × (1 + 0.05 × (가입월수 - 240) / 12), 월액은 12로 나눔
  const annualPension =
    R.proportionalConstant *
    (R.aValue + appliedIncome) *
    (1 + (0.05 * (contributionMonths - R.baseContributionMonths)) / 12);
  const estimatedMonthlyPension = Math.round(annualPension / 12);

  return {
    eligible: true,
    estimatedMonthlyPension,
    pensionStartAge,
    appliedIncome,
    notice: `${contributionYears}년 가입, 현재 소득을 생애 평균소득으로 가정한 추정치입니다(2026년 A값·소득대체율 43% 적용). 실제 수령액은 국민연금공단 '내 연금 알아보기'에서 확인하세요.`,
    ruleVersion: RULE_SET_VERSION,
  };
};
