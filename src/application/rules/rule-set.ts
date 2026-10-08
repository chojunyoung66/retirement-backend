/**
 * 제도 수치 단일 정본 — 값 변경 시 RULE_SET_VERSION과 계산기 테스트 정답값을 함께 갱신한다.
 */
export const RULE_SET_VERSION = "KR-2026.10";

export interface RuleMeta {
  effectiveDate: string;
  source: string;
}

export const NATIONAL_PENSION_RULES = {
  meta: {
    effectiveDate: "2026-07-01",
    source: "보건복지부 고시 제2026-12호(A값), 2026년 기준소득월액 상·하한 고시, 국민연금법 개정(소득대체율 43%)",
  } satisfies RuleMeta,
  // 전체 가입자 3년 평균소득월액 (2026.1~12월분)
  aValue: 3_193_511,
  // 2026.1.1 이후 가입기간 비례상수 (소득대체율 43%)
  proportionalConstant: 1.29,
  // 기준소득월액 하한·상한 (2026.7~2027.6)
  minReportedIncome: 410_000,
  maxReportedIncome: 6_590_000,
  // 노령연금 최소 가입기간 (개월)
  minContributionMonths: 120,
  // 20년 기준 가입월수
  baseContributionMonths: 240,
  // 출생연도별 수급개시연령 (국민연금법 부칙)
  startAgeByBirthYear: [
    { fromBirthYear: 1969, age: 65 },
    { fromBirthYear: 1965, age: 64 },
    { fromBirthYear: 1961, age: 63 },
    { fromBirthYear: 1957, age: 62 },
    { fromBirthYear: 1953, age: 61 },
  ],
  defaultStartAge: 60,
} as const;

export const HEALTH_INSURANCE_RULES = {
  meta: {
    effectiveDate: "2026-01-01",
    source: "국민건강보험공단 2026년도 보험료율 기준 안내, 월별 건강보험료액 상·하한 고시(2025.12.24)",
  } satisfies RuleMeta,
  premiumRate: 0.0719,
  // 장기요양보험료율 0.9448% ÷ 건강보험료율 7.19%
  longTermCareRatio: 0.1314,
  propertyScoreUnit: 211.5,
  minMonthlyPremium: 20_160,
  maxMonthlyPremium: 4_591_740,
  // 소득월액 28만원 이하 세대는 소득보험료 대신 최저보험료 적용
  minIncomeMonthlyThreshold: 280_000,
  // 소득 평가율 (2022.9 부과체계 2단계 개편)
  incomeRecognition: {
    pension: 0.5,
    labor: 0.5,
    business: 1.0,
    financial: 1.0,
    // 기타소득은 필요경비 80% 공제 후 소득금액 기준
    other: 0.2,
  },
  // 이자·배당 합계가 이 금액 이하면 지역보험료 소득에서 제외, 초과 시 전액 반영
  financialIncomeExclusion: 10_000_000,
  propertyBasicDeduction: 100_000_000,
  // 재산 등급표 근사: 450만원당 22점
  propertyBracketAmount: 4_500_000,
  propertyBracketScore: 22,
  // 차량 4천만원 이상만 부과 (점수 근사)
  carScores: [
    { minValue: 100_000_000, score: 60 },
    { minValue: 60_000_000, score: 30 },
    { minValue: 40_000_000, score: 10 },
  ],
  dependent: {
    maxAnnualIncome: 20_000_000,
    // 사업자등록 없는 사업소득 허용 한도
    maxBusinessIncome: 5_000_000,
    propertyAlwaysOk: 540_000_000,
    propertyMax: 900_000_000,
    // 재산 5.4억~9억 구간의 연소득 한도
    incomeLimitForMidProperty: 10_000_000,
  },
} as const;

export const UNEMPLOYMENT_RULES = {
  meta: {
    effectiveDate: "2026-01-01",
    source: "고용보험법 시행령 제68조(2025.12.16 개정), 2026년 최저임금 고시(시급 10,320원)",
  } satisfies RuleMeta,
  replacementRate: 0.6,
  maxDailyBenefit: 68_100,
  // 최저임금 10,320원 × 80% × 8시간
  minDailyBenefit: 66_048,
  // 소정급여일수 (고용보험법 별표1) — 가입연수 상한 미만 구간 순
  benefitDays: {
    age50OrOver: [
      { underYears: 1, days: 120 },
      { underYears: 3, days: 180 },
      { underYears: 5, days: 210 },
      { underYears: 10, days: 240 },
      { underYears: Infinity, days: 270 },
    ],
    under50: [
      { underYears: 1, days: 120 },
      { underYears: 3, days: 150 },
      { underYears: 5, days: 180 },
      { underYears: 10, days: 210 },
      { underYears: Infinity, days: 240 },
    ],
  },
} as const;

export const SEVERANCE_TAX_RULES = {
  meta: {
    effectiveDate: "2023-01-01",
    source: "소득세법 제48조(퇴직소득공제), 제55조(기본세율), 2023년 귀속 이후",
  } satisfies RuleMeta,
  // 근속연수공제: 상한 근속연수 이하 구간 → base + perYear × (연수 - fromYears)
  serviceDeduction: [
    { upToYears: 5, base: 0, perYear: 1_000_000, fromYears: 0 },
    { upToYears: 10, base: 5_000_000, perYear: 2_000_000, fromYears: 5 },
    { upToYears: 20, base: 15_000_000, perYear: 2_500_000, fromYears: 10 },
    { upToYears: Infinity, base: 40_000_000, perYear: 3_000_000, fromYears: 20 },
  ],
  // 환산급여공제: 하한 초과분 × rate + base
  convertedPayDeduction: [
    { upTo: 8_000_000, base: 0, rate: 1.0, from: 0 },
    { upTo: 70_000_000, base: 8_000_000, rate: 0.6, from: 8_000_000 },
    { upTo: 100_000_000, base: 45_200_000, rate: 0.55, from: 70_000_000 },
    { upTo: 300_000_000, base: 61_700_000, rate: 0.45, from: 100_000_000 },
    { upTo: Infinity, base: 151_700_000, rate: 0.35, from: 300_000_000 },
  ],
  // 종합소득 기본세율 (누진공제 방식)
  basicTaxBrackets: [
    { upTo: 14_000_000, rate: 0.06, progressiveDeduction: 0 },
    { upTo: 50_000_000, rate: 0.15, progressiveDeduction: 1_260_000 },
    { upTo: 88_000_000, rate: 0.24, progressiveDeduction: 5_760_000 },
    { upTo: 150_000_000, rate: 0.35, progressiveDeduction: 15_440_000 },
    { upTo: 300_000_000, rate: 0.38, progressiveDeduction: 19_940_000 },
    { upTo: 500_000_000, rate: 0.4, progressiveDeduction: 25_940_000 },
    { upTo: 1_000_000_000, rate: 0.42, progressiveDeduction: 35_940_000 },
    { upTo: Infinity, rate: 0.45, progressiveDeduction: 65_940_000 },
  ],
  localIncomeTaxRate: 0.1,
} as const;

export const ISA_RULES = {
  meta: {
    effectiveDate: "2025-01-01",
    source: "조세특례제한법 제91조의18 (일반형 기준)",
  } satisfies RuleMeta,
  annualContributionLimit: 20_000_000,
  taxFreeLimitGeneral: 2_000_000,
  // 세율은 지방소득세 포함(14%+1.4%, 9%+0.9%) — 세금 분리 표시가 이 전제에 의존한다
  generalTaxRate: 0.154,
  separateTaxRate: 0.099,
  // 만기 후 60일 이내 연금계좌 전환 시 전환액의 10%(최대 300만원)를 세액공제 대상 납입액에 추가
  pensionTransfer: {
    effectiveDate: "2020-01-01",
    source: "소득세법 제59조의3 제3항, 시행령 제118조의2",
    creditBaseRate: 0.1,
    maxExtraCreditBase: 3_000_000,
    // 이 금액을 넘는 전환분은 추가 공제 효과가 없음
    fullEffectTransferAmount: 30_000_000,
    deadlineDays: 60,
  },
} as const;

export const PENSION_INCOME_TAX_RULES = {
  meta: {
    effectiveDate: "2026-01-01",
    source: "소득세법 제129조 제1항 제5호의2·5호의3, 제14조 제3항 제9호(사적연금 1,500만원), 시행령 제40조의2(연금수령한도), 국세청 연금소득 안내(2026.1.1 이후 연금수령분)",
  } satisfies RuleMeta,
  // 아래 세율은 모두 지방소득세(국세의 10%)를 더한 값이다 — 세금 분리 표시(splitLocalTax)가 이 전제에 의존한다
  // 연금수령 최소 연령
  annuityMinAge: 55,
  // 연금수령한도 = 연초 평가액 ÷ (11 − 연금수령연차) × 120%, 11년차부터 한도 없음
  annuityLimitMultiplier: 1.2,
  annuityLimitFreeFromYear: 11,
  // 2013.3 이전 가입 연금저축(구계좌)은 6년차부터 기산
  legacyStartReceiptYear: 6,
  // 세액공제 원금·운용수익 연금수령 원천징수세율(지방소득세 포함), 나이 하한 내림차순
  privatePensionRateByAge: [
    { fromAge: 80, rate: 0.033 },
    { fromAge: 70, rate: 0.044 },
    { fromAge: 0, rate: 0.055 },
  ],
  // 이연퇴직소득·의료목적 인출 외 사적연금 연 합계가 이 금액을 넘으면 종합과세 또는 16.5% 분리과세
  separateTaxThreshold: 15_000_000,
  overThresholdSeparateRate: 0.165,
  // 연금외수령(일시 인출) 기타소득세(지방소득세 포함)
  nonAnnuityOtherIncomeRate: 0.165,
  // 이연퇴직소득 연금수령: 퇴직소득세(연금외수령 세율) 대비 적용 비율, 실제 수령연차 기준
  deferredRetirementRatioByYear: [
    { upToYear: 10, ratio: 0.7 },
    { upToYear: 20, ratio: 0.6 },
    { upToYear: Infinity, ratio: 0.5 },
  ],
} as const;

export const IRP_RULES = {
  meta: {
    effectiveDate: "2023-01-01",
    source: "소득세법 제59조의3 (연금계좌 세액공제)",
  } satisfies RuleMeta,
  // 연금저축 포함 연금계좌 합산 세액공제 한도
  maxDeductibleContribution: 9_000_000,
  lowIncomeThreshold: 55_000_000,
  lowIncomeCreditRate: 0.165,
  highIncomeCreditRate: 0.132,
} as const;
