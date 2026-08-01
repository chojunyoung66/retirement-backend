/** HF 종신·정액(일반주택) 공개표 기준 버전 — 표 교체 시 테스트 스냅샷과 함께 갱신 */
export const TABLE_VERSION = 'HF-2026-03-01';

const MIN_AGE = 55;
const MAX_AGE_ROW = 80;
const MAX_FIXED_TERM_AGE = 74;
const MAX_PRICE_FOR_PAYOUT = 1_200_000_000;
const INITIAL_GUARANTEE_FEE_RATE = 0.01;
const ANNUAL_GUARANTEE_FEE_RATE = 0.0095;
const STEP_UP_RATE = 0.045;
const FRONT_LOAD_LATER_RATIO = 0.7;
const LIFE_HORIZON_AGE = 90;

/** 연령 격자 (세) */
const AGES = [55, 60, 65, 70, 75, 80] as const;

/** 주택가격 격자 (원) */
const PRICES = [
  100_000_000, 200_000_000, 300_000_000, 400_000_000, 500_000_000, 600_000_000,
  700_000_000, 800_000_000, 900_000_000, 1_000_000_000, 1_100_000_000, 1_200_000_000,
] as const;

/**
 * 일반주택 · 종신지급 · 정액형 월지급금 (단위: 천원)
 * Source: 한국주택금융공사 월지급금 예시 (2026.03.01)
 */
const LIFETIME_FLAT_THOUSANDS: readonly (readonly number[])[] = [
  [156, 312, 468, 624, 780, 936, 1092, 1248, 1404, 1560, 1716, 1872],
  [210, 421, 632, 842, 1053, 1264, 1475, 1685, 1896, 2107, 2318, 2528],
  [252, 505, 758, 1011, 1264, 1517, 1770, 2023, 2276, 2529, 2782, 3035],
  [307, 615, 923, 1231, 1539, 1847, 2155, 2462, 2770, 3078, 3386, 3414],
  [381, 762, 1143, 1525, 1906, 2287, 2669, 3050, 3431, 3666, 3666, 3666],
  [483, 966, 1449, 1932, 2416, 2899, 3382, 3865, 4060, 4060, 4060, 4060],
];

export type HousingPensionProductType = 'GENERAL' | 'PREFERENTIAL' | 'LOAN_REPAY';
export type HousingPensionPayoutMode = 'LIFETIME' | 'LIFETIME_MIXED' | 'FIXED_TERM_MIXED';
export type HousingPensionPayoutStyle = 'FLAT' | 'FRONT_LOADED' | 'STEP_UP';
export type FrontLoadYears = 3 | 5 | 7 | 10;
export type FixedTermYears = 10 | 15 | 20;

export interface HousingPensionInput {
  youngerSpouseAge: number;
  housePrice: number;
  productType: HousingPensionProductType;
  payoutMode: HousingPensionPayoutMode;
  payoutStyle: HousingPensionPayoutStyle;
  isBasicPensionRecipient: boolean;
  isSingleHomeUnder250m: boolean;
  existingMortgageBalance?: number;
  /** 초기증액형 증액기간 (년) — 기본 10 */
  frontLoadYears?: FrontLoadYears;
  /** 확정기간혼합 지급기간 (년) */
  fixedTermYears?: FixedTermYears;
  /** 혼합방식 인출비율 0~0.5 — 기본 0.5 (대출한도의 50%) */
  withdrawalRatio?: number;
}

export interface HousingPensionOutput {
  monthlyPayout: number;
  annualPayout: number;
  initialGuaranteeFee: number;
  annualGuaranteeFeeRate: number;
  eligible: boolean;
  ineligibilityReasons: string[];
  notice: string;
  tableVersion: string;
  lumpSumWithdrawal?: number;
  monthlyPayoutAfterBoost?: number;
  frontLoadYears?: number;
  stepUpRate?: number;
  payoutScheduleSummary?: string;
  fixedTermYears?: number;
  withdrawLimit?: number;
  mandatoryWithdrawReserve?: number;
  estimatedLoanLimit?: number;
}

// 기대 수령 연수 근사 — 90세 호라이즌, 최소 10년
function expectedPayoutYears(age: number): number {
  return Math.max(10, LIFE_HORIZON_AGE - age);
}

// 구간 [lo, hi]에서 value의 위치 비율(0~1)
function ratio(value: number, lo: number, hi: number): number {
  if (hi === lo) return 0;
  return (value - lo) / (hi - lo);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// 연령·가격 격자 bilinear 보간 — 원 단위
export function interpolateLifetimeFlatPayout(age: number, housePrice: number): number {
  const clampedAge = Math.min(Math.max(age, AGES[0]), MAX_AGE_ROW);
  const clampedPrice = Math.min(Math.max(housePrice, 0), MAX_PRICE_FOR_PAYOUT);

  if (clampedPrice < PRICES[0]) {
    const atMin = interpolateLifetimeFlatPayout(clampedAge, PRICES[0]);
    return Math.round(atMin * (clampedPrice / PRICES[0]));
  }

  let ageLoIdx = 0;
  for (let i = 0; i < AGES.length - 1; i++) {
    if (clampedAge >= AGES[i]) ageLoIdx = i;
  }
  const ageHiIdx = Math.min(ageLoIdx + 1, AGES.length - 1);
  const ageT = ratio(clampedAge, AGES[ageLoIdx], AGES[ageHiIdx]);

  let priceLoIdx = 0;
  for (let i = 0; i < PRICES.length - 1; i++) {
    if (clampedPrice >= PRICES[i]) priceLoIdx = i;
  }
  const priceHiIdx = Math.min(priceLoIdx + 1, PRICES.length - 1);
  const priceT = ratio(clampedPrice, PRICES[priceLoIdx], PRICES[priceHiIdx]);

  const v00 = LIFETIME_FLAT_THOUSANDS[ageLoIdx][priceLoIdx];
  const v01 = LIFETIME_FLAT_THOUSANDS[ageLoIdx][priceHiIdx];
  const v10 = LIFETIME_FLAT_THOUSANDS[ageHiIdx][priceLoIdx];
  const v11 = LIFETIME_FLAT_THOUSANDS[ageHiIdx][priceHiIdx];
  const thousands = lerp(lerp(v00, v01, priceT), lerp(v10, v11, priceT), ageT);

  return Math.round(thousands * 1000);
}

// 우대형 가산율 — HF 안내 최대 약 20%/25%
function preferentialMultiplier(housePrice: number): number {
  if (housePrice < 180_000_000) return 1.25;
  if (housePrice < 250_000_000) return 1.2;
  return 1;
}

// 정액형 월액 기준 대출한도 근사 (시세 상한)
function estimateLoanLimit(age: number, housePrice: number, flatMonthly: number): number {
  const fromAnnuity = Math.round(flatMonthly * 12 * expectedPayoutYears(age));
  return Math.min(housePrice, Math.max(fromAnnuity, flatMonthly * 12 * 10));
}

// 초기증액형: 기대총액≈정액 총액이 되도록 최초 월액 산정, 이후 70%
function applyFrontLoaded(
  flat: number,
  age: number,
  frontLoadYears: FrontLoadYears,
): { monthly: number; afterBoost: number; summary: string } {
  const horizon = expectedPayoutYears(age);
  const boost = frontLoadYears;
  const rest = Math.max(0, horizon - boost);
  const initial = Math.round((flat * (boost + rest)) / (boost + FRONT_LOAD_LATER_RATIO * rest));
  const afterBoost = Math.round(initial * FRONT_LOAD_LATER_RATIO);
  return {
    monthly: initial,
    afterBoost,
    summary: `최초 ${boost}년 월 ${initial.toLocaleString('ko-KR')}원 → 이후 월 ${afterBoost.toLocaleString('ko-KR')}원(최초액의 70%)`,
  };
}

// 정기증가형: 36개월마다 4.5% 증가, 기대연수 평균≈정액이 되도록 최초액 산정
function applyStepUp(
  flat: number,
  age: number,
): { monthly: number; summary: string } {
  const years = expectedPayoutYears(age);
  let monthsLeft = years * 12;
  let factor = 1;
  let yearWeight = 0;

  while (monthsLeft > 0) {
    const chunk = Math.min(36, monthsLeft);
    yearWeight += (chunk / 12) * factor;
    factor *= 1 + STEP_UP_RATE;
    monthsLeft -= chunk;
  }

  const initial = Math.round((flat * years) / yearWeight);
  return {
    monthly: initial,
    summary: `최초 월 ${initial.toLocaleString('ko-KR')}원, 36개월마다 ${STEP_UP_RATE * 100}% 증가 (정액 대비 초기가 낮음)`,
  };
}

function buildNotice(parts: string[]): string {
  return [
    'HF 공개 월지급금 표(종신·정액, 2026.03.01) 보간 + 지급유형 규칙 근사입니다.',
    '실제 가입액은 한국주택금융공사 조회·상담으로 확인하세요. 기존 가입자 소급 없음.',
    '실거주 예외(질병·봉양·노인복지시설 등)는 1주택·공사 인정 사유에 한함(2026.6.1~).',
    ...parts,
  ].join(' ');
}

export function calculateHousingPension(input: HousingPensionInput): HousingPensionOutput {
  const reasons: string[] = [];
  const frontLoadYears: FrontLoadYears = input.frontLoadYears ?? 10;
  const withdrawalRatio = Math.min(0.5, Math.max(0, input.withdrawalRatio ?? 0.5));

  if (!Number.isFinite(input.youngerSpouseAge) || input.youngerSpouseAge < MIN_AGE) {
    reasons.push('MIN_AGE');
  }
  if (!Number.isFinite(input.housePrice) || input.housePrice <= 0) {
    reasons.push('INVALID_HOUSE_PRICE');
  }

  if (input.productType === 'PREFERENTIAL') {
    if (!input.isBasicPensionRecipient || !input.isSingleHomeUnder250m) {
      reasons.push('PREFERENTIAL_NOT_QUALIFIED');
    }
    if (input.housePrice >= 250_000_000) {
      reasons.push('PREFERENTIAL_PRICE_LIMIT');
    }
  }

  // 확정기간혼합: 연소자 55~74, 정액형만, 지급기간 필수
  if (input.payoutMode === 'FIXED_TERM_MIXED') {
    if (input.youngerSpouseAge > MAX_FIXED_TERM_AGE) {
      reasons.push('FIXED_TERM_AGE');
    }
    if (input.payoutStyle !== 'FLAT') {
      reasons.push('FIXED_TERM_FLAT_ONLY');
    }
    if (!input.fixedTermYears) {
      reasons.push('FIXED_TERM_YEARS_REQUIRED');
    }
  }

  // 초기증액·정기증가는 종신(혼합)에서만
  if (
    (input.payoutStyle === 'FRONT_LOADED' || input.payoutStyle === 'STEP_UP') &&
    input.payoutMode === 'FIXED_TERM_MIXED'
  ) {
    if (!reasons.includes('FIXED_TERM_FLAT_ONLY')) {
      reasons.push('FIXED_TERM_FLAT_ONLY');
    }
  }

  if (reasons.length > 0) {
    return {
      monthlyPayout: 0,
      annualPayout: 0,
      initialGuaranteeFee: 0,
      annualGuaranteeFeeRate: ANNUAL_GUARANTEE_FEE_RATE,
      eligible: false,
      ineligibilityReasons: reasons,
      notice: buildNotice([]),
      tableVersion: TABLE_VERSION,
    };
  }

  const age = input.youngerSpouseAge;
  let flatBase = interpolateLifetimeFlatPayout(age, input.housePrice);

  if (input.productType === 'PREFERENTIAL') {
    flatBase = Math.round(flatBase * preferentialMultiplier(input.housePrice));
  }

  const loanLimit = estimateLoanLimit(age, input.housePrice, flatBase);
  const extraNotice: string[] = [];
  let monthly = flatBase;
  let monthlyPayoutAfterBoost: number | undefined;
  let payoutScheduleSummary: string | undefined;
  let lumpSumWithdrawal: number | undefined;
  let withdrawLimit: number | undefined;
  let mandatoryWithdrawReserve: number | undefined;
  let usedFrontLoadYears: number | undefined;
  let stepUpRate: number | undefined;
  let fixedTermYearsOut: number | undefined;

  // 상환용: 인출 50%~90% 구간으로 잔여 대출한도 비율만큼 월액 축소
  if (input.productType === 'LOAN_REPAY') {
    const balance = Math.max(0, input.existingMortgageBalance ?? 0);
    const minWithdraw = Math.ceil(loanLimit * 0.5);
    const maxWithdraw = Math.floor(loanLimit * 0.9);
    lumpSumWithdrawal = Math.min(maxWithdraw, Math.max(minWithdraw, balance));
    const remainingRatio = Math.max(0, (loanLimit - lumpSumWithdrawal) / loanLimit);
    monthly = Math.round(flatBase * remainingRatio);
    extraNotice.push(
      `상환용 인출 ${lumpSumWithdrawal.toLocaleString('ko-KR')}원(대출한도 50~90% 구간).`,
    );
  }

  // 혼합방식: 인출한도 설정 후 잔여로 월액
  if (input.payoutMode === 'LIFETIME_MIXED' || input.payoutMode === 'FIXED_TERM_MIXED') {
    withdrawLimit = Math.round(loanLimit * withdrawalRatio);
    mandatoryWithdrawReserve =
      input.payoutMode === 'FIXED_TERM_MIXED' ? Math.round(loanLimit * 0.05) : undefined;
    monthly = Math.round(monthly * (1 - withdrawalRatio));
    extraNotice.push(
      `인출한도 비율 ${(withdrawalRatio * 100).toFixed(0)}%(대출한도 대비).`,
    );
  }

  // 확정기간: 기대수명 대비 기간 단축분만큼 월액 상향
  if (input.payoutMode === 'FIXED_TERM_MIXED' && input.fixedTermYears) {
    const horizon = expectedPayoutYears(age);
    const termFactor = horizon / input.fixedTermYears;
    monthly = Math.round(monthly * termFactor);
    fixedTermYearsOut = input.fixedTermYears;
    extraNotice.push(`${input.fixedTermYears}년 확정기간 혼합(정액).`);
  }

  // 지급유형 (종신·종신혼합)
  if (input.payoutMode !== 'FIXED_TERM_MIXED') {
    if (input.payoutStyle === 'FRONT_LOADED') {
      const front = applyFrontLoaded(monthly, age, frontLoadYears);
      monthly = front.monthly;
      monthlyPayoutAfterBoost = front.afterBoost;
      payoutScheduleSummary = front.summary;
      usedFrontLoadYears = frontLoadYears;
    } else if (input.payoutStyle === 'STEP_UP') {
      const step = applyStepUp(monthly, age);
      monthly = step.monthly;
      stepUpRate = STEP_UP_RATE;
      payoutScheduleSummary = step.summary;
    }
  }

  return {
    monthlyPayout: monthly,
    annualPayout: monthly * 12,
    initialGuaranteeFee: Math.round(input.housePrice * INITIAL_GUARANTEE_FEE_RATE),
    annualGuaranteeFeeRate: ANNUAL_GUARANTEE_FEE_RATE,
    eligible: true,
    ineligibilityReasons: [],
    notice: buildNotice(extraNotice),
    tableVersion: TABLE_VERSION,
    estimatedLoanLimit: loanLimit,
    ...(lumpSumWithdrawal !== undefined ? { lumpSumWithdrawal } : {}),
    ...(monthlyPayoutAfterBoost !== undefined ? { monthlyPayoutAfterBoost } : {}),
    ...(usedFrontLoadYears !== undefined ? { frontLoadYears: usedFrontLoadYears } : {}),
    ...(stepUpRate !== undefined ? { stepUpRate } : {}),
    ...(payoutScheduleSummary !== undefined ? { payoutScheduleSummary } : {}),
    ...(fixedTermYearsOut !== undefined ? { fixedTermYears: fixedTermYearsOut } : {}),
    ...(withdrawLimit !== undefined ? { withdrawLimit } : {}),
    ...(mandatoryWithdrawReserve !== undefined
      ? { mandatoryWithdrawReserve }
      : {}),
  };
}
