import {
  calculateHousingPension,
  interpolateLifetimeFlatPayout,
  TABLE_VERSION,
} from './housing-pension.service.js';

const baseInput = {
  youngerSpouseAge: 60,
  housePrice: 400_000_000,
  productType: 'GENERAL' as const,
  payoutMode: 'LIFETIME' as const,
  payoutStyle: 'FLAT' as const,
  isBasicPensionRecipient: false,
  isSingleHomeUnder250m: false,
};

describe('interpolateLifetimeFlatPayout (일반주택 종신·정액)', () => {
  it('격자점 60세·4억은 HF 표와 동일하다 (842천원)', () => {
    expect(interpolateLifetimeFlatPayout(60, 400_000_000)).toBe(842_000);
  });

  it('격자점 70세·3억은 HF 표와 동일하다 (923천원)', () => {
    expect(interpolateLifetimeFlatPayout(70, 300_000_000)).toBe(923_000);
  });

  it('격자점 55세·1억은 HF 표와 동일하다 (156천원)', () => {
    expect(interpolateLifetimeFlatPayout(55, 100_000_000)).toBe(156_000);
  });

  it('연령·가격 중간값은 양방향 선형 보간한다 (스냅샷)', () => {
    expect(interpolateLifetimeFlatPayout(57.5, 350_000_000)).toBe(641_500);
  });

  it('시세 12억 초과분은 12억 한도로 산정한다', () => {
    expect(interpolateLifetimeFlatPayout(65, 1_500_000_000)).toBe(
      interpolateLifetimeFlatPayout(65, 1_200_000_000),
    );
  });

  it('80세 초과는 80세 행을 사용한다', () => {
    expect(interpolateLifetimeFlatPayout(85, 400_000_000)).toBe(
      interpolateLifetimeFlatPayout(80, 400_000_000),
    );
  });
});

describe('calculateHousingPension — 정액·자격', () => {
  it('해피패스: 60세·4억·일반·종신정액', () => {
    const result = calculateHousingPension(baseInput);
    expect(result.eligible).toBe(true);
    expect(result.monthlyPayout).toBe(842_000);
    expect(result.annualPayout).toBe(842_000 * 12);
    expect(result.initialGuaranteeFee).toBe(4_000_000);
    expect(result.annualGuaranteeFeeRate).toBe(0.0095);
    expect(result.tableVersion).toBe(TABLE_VERSION);
  });

  it('55세 미만이면 MIN_AGE', () => {
    const result = calculateHousingPension({ ...baseInput, youngerSpouseAge: 54 });
    expect(result.eligible).toBe(false);
    expect(result.ineligibilityReasons).toContain('MIN_AGE');
  });

  it('우대형(시가 1.8억 미만)은 25% 가산', () => {
    const general = calculateHousingPension({
      ...baseInput,
      youngerSpouseAge: 70,
      housePrice: 130_000_000,
    });
    const preferential = calculateHousingPension({
      ...baseInput,
      youngerSpouseAge: 70,
      housePrice: 130_000_000,
      productType: 'PREFERENTIAL',
      isBasicPensionRecipient: true,
      isSingleHomeUnder250m: true,
    });
    expect(preferential.monthlyPayout).toBe(Math.round(general.monthlyPayout * 1.25));
  });
});

describe('calculateHousingPension — P1 지급유형·방식', () => {
  it('초기증액형: 증액기간 월액 > 정액, 이후는 최초 월액의 70%', () => {
    const flat = calculateHousingPension(baseInput);
    const front = calculateHousingPension({
      ...baseInput,
      payoutStyle: 'FRONT_LOADED',
      frontLoadYears: 10,
    });

    expect(front.eligible).toBe(true);
    expect(front.monthlyPayout).toBeGreaterThan(flat.monthlyPayout);
    expect(front.monthlyPayoutAfterBoost).toBe(Math.round(front.monthlyPayout * 0.7));
    expect(front.frontLoadYears).toBe(10);
  });

  it('정기증가형: 최초 월액 < 정액, 3년마다 4.5% 증가 가정', () => {
    const flat = calculateHousingPension(baseInput);
    const step = calculateHousingPension({
      ...baseInput,
      payoutStyle: 'STEP_UP',
    });

    expect(step.eligible).toBe(true);
    expect(step.monthlyPayout).toBeLessThan(flat.monthlyPayout);
    expect(step.stepUpRate).toBe(0.045);
    expect(step.payoutScheduleSummary).toContain('4.5%');
  });

  it('확정기간혼합: 55~74만 가능, 기간 짧을수록 월액↑, 인출한도·의무인출 반환', () => {
    const result = calculateHousingPension({
      ...baseInput,
      youngerSpouseAge: 60,
      payoutMode: 'FIXED_TERM_MIXED',
      payoutStyle: 'FLAT',
      fixedTermYears: 10,
      withdrawalRatio: 0.5,
    });

    expect(result.eligible).toBe(true);
    expect(result.monthlyPayout).toBeGreaterThan(842_000 * 0.4);
    expect(result.fixedTermYears).toBe(10);
    expect(result.withdrawLimit).toBeGreaterThan(0);
    expect(result.mandatoryWithdrawReserve).toBe(Math.round((result.estimatedLoanLimit ?? 0) * 0.05));
  });

  it('확정기간혼합은 75세 이상이면 거부', () => {
    const result = calculateHousingPension({
      ...baseInput,
      youngerSpouseAge: 75,
      payoutMode: 'FIXED_TERM_MIXED',
      fixedTermYears: 10,
    });
    expect(result.eligible).toBe(false);
    expect(result.ineligibilityReasons).toContain('FIXED_TERM_AGE');
  });

  it('확정기간혼합은 정액형만 허용', () => {
    const result = calculateHousingPension({
      ...baseInput,
      payoutMode: 'FIXED_TERM_MIXED',
      payoutStyle: 'FRONT_LOADED',
      fixedTermYears: 10,
      frontLoadYears: 5,
    });
    expect(result.eligible).toBe(false);
    expect(result.ineligibilityReasons).toContain('FIXED_TERM_FLAT_ONLY');
  });

  it('종신혼합: 인출비율만큼 월액 감소', () => {
    const flat = calculateHousingPension(baseInput);
    const mixed = calculateHousingPension({
      ...baseInput,
      payoutMode: 'LIFETIME_MIXED',
      withdrawalRatio: 0.5,
    });
    expect(mixed.monthlyPayout).toBe(Math.round(flat.monthlyPayout * 0.5));
    expect(mixed.withdrawLimit).toBeGreaterThan(0);
  });
});

describe('calculateHousingPension — 상환용 인출 한도(50~90%)', () => {
  it('주담대 잔액이 대출한도 50% 미만이면 최소 50%까지 인출한다', () => {
    const repay = calculateHousingPension({
      ...baseInput,
      youngerSpouseAge: 65,
      productType: 'LOAN_REPAY',
      existingMortgageBalance: 10_000_000,
    });

    expect(repay.eligible).toBe(true);
    expect(repay.estimatedLoanLimit).toBeGreaterThan(0);
    const minWithdraw = Math.ceil((repay.estimatedLoanLimit as number) * 0.5);
    expect(repay.lumpSumWithdrawal).toBe(minWithdraw);
    expect(repay.monthlyPayout).toBeLessThan(interpolateLifetimeFlatPayout(65, 400_000_000));
  });

  it('주담대 잔액이 대출한도 90%를 넘으면 90%로 캡한다', () => {
    const repay = calculateHousingPension({
      ...baseInput,
      youngerSpouseAge: 65,
      productType: 'LOAN_REPAY',
      existingMortgageBalance: 10_000_000_000,
    });
    const maxWithdraw = Math.floor((repay.estimatedLoanLimit as number) * 0.9);
    expect(repay.lumpSumWithdrawal).toBe(maxWithdraw);
  });
});
