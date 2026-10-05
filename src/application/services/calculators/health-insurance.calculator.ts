import {
  HEALTH_INSURANCE_RULES as R,
  RULE_SET_VERSION,
} from "../../rules/rule-set.js";

export interface HealthInsuranceInput {
  pensionIncome: number;
  laborIncome: number;
  businessIncome: number;
  interestDividendIncome: number;
  otherIncome: number;
  propertyValue: number;
  carValue: number;
}

export type DependentStatus = "LIKELY" | "UNLIKELY";

export interface HealthInsuranceOutput {
  recognizedAnnualIncome: number;
  recognizedMonthlyIncome: number;
  incomePremium: number;
  propertyPremium: number;
  carPremium: number;
  longTermCarePremium: number;
  canBeDependent: boolean;
  dependentStatus: DependentStatus;
  estimatedMonthlyPremium: number;
  notice: string;
  ruleVersion: string;
}

const countedFinancialIncome = (amount: number): number =>
  // 금융소득은 기준 이하면 제외, 초과하면 전액 반영
  amount > R.financialIncomeExclusion ? amount : 0;

const isDependentLikely = (input: HealthInsuranceInput): boolean => {
  const d = R.dependent;
  // 소득요건: 합산소득 한도와 사업소득 한도
  const totalIncome =
    input.pensionIncome +
    input.laborIncome +
    input.businessIncome +
    countedFinancialIncome(input.interestDividendIncome) +
    input.otherIncome;
  const incomeOk =
    totalIncome <= d.maxAnnualIncome &&
    input.businessIncome <= d.maxBusinessIncome;

  // 재산요건: 5.4억 이하 가능, 9억 이하는 연소득 1천만원 이하일 때만 가능
  const propertyOk =
    input.propertyValue <= d.propertyAlwaysOk ||
    (input.propertyValue <= d.propertyMax &&
      totalIncome <= d.incomeLimitForMidProperty);

  return incomeOk && propertyOk;
};

export const calculateHealthInsurance = (
  input: HealthInsuranceInput,
): HealthInsuranceOutput => {
  const w = R.incomeRecognition;

  // 소득 유형별 평가율을 적용한 연 소득인정액
  const recognizedAnnualIncome =
    input.pensionIncome * w.pension +
    input.laborIncome * w.labor +
    input.businessIncome * w.business +
    countedFinancialIncome(input.interestDividendIncome) * w.financial +
    input.otherIncome * w.other;
  const recognizedMonthlyIncome = recognizedAnnualIncome / 12;

  // 소득월액 28만원 이하는 소득분 최저보험료, 초과 시 보험료율 적용
  const incomePremium =
    recognizedMonthlyIncome <= R.minIncomeMonthlyThreshold
      ? R.minMonthlyPremium
      : recognizedMonthlyIncome * R.premiumRate;

  // 재산보험료: 기본공제 후 등급표 근사 점수 × 점수당 금액
  const propertyAfterDeduction = Math.max(
    0,
    input.propertyValue - R.propertyBasicDeduction,
  );
  const propertyScore =
    Math.floor(propertyAfterDeduction / R.propertyBracketAmount) *
    R.propertyBracketScore;
  const propertyPremium = propertyScore * R.propertyScoreUnit;

  // 차량보험료: 기준가액 이상 차량만 점수 부과
  const carScore =
    R.carScores.find((c) => input.carValue >= c.minValue)?.score ?? 0;
  const carPremium = carScore * R.propertyScoreUnit;

  // 상·하한 적용 후 장기요양보험료 합산
  const healthPremium = Math.min(
    R.maxMonthlyPremium,
    Math.max(R.minMonthlyPremium, incomePremium + propertyPremium + carPremium),
  );
  const longTermCarePremium = healthPremium * R.longTermCareRatio;
  const estimatedMonthlyPremium = Math.round(
    healthPremium + longTermCarePremium,
  );

  // 피부양자 판정은 추정으로만 안내
  const canBeDependent = isDependentLikely(input);
  const dependentNotice = canBeDependent
    ? "피부양자 요건을 충족할 가능성이 있습니다(추정). 직장가입자 가족 등록 가능 여부는 공단 확인이 필요합니다."
    : "피부양자 요건 미충족 가능성이 높아 지역가입자 보험료 납부 대상으로 추정됩니다.";

  return {
    recognizedAnnualIncome: Math.round(recognizedAnnualIncome),
    recognizedMonthlyIncome: Math.round(recognizedMonthlyIncome),
    incomePremium: Math.round(incomePremium),
    propertyPremium: Math.round(propertyPremium),
    carPremium: Math.round(carPremium),
    longTermCarePremium: Math.round(longTermCarePremium),
    canBeDependent,
    dependentStatus: canBeDependent ? "LIKELY" : "UNLIKELY",
    estimatedMonthlyPremium,
    notice: `소득인정액 월 ${Math.round(recognizedMonthlyIncome / 10000)}만원 기준 2026년 지역가입자 예상 보험료(장기요양 포함)입니다. 재산 점수는 등급표 근사치입니다. ${dependentNotice}`,
    ruleVersion: RULE_SET_VERSION,
  };
};
