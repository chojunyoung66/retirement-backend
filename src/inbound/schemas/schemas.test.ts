import { diagnosisDataSchema } from "./diagnosis.schemas.js";
import { portfolioDataSchema, portfolioUpdateSchema } from "./portfolio.schemas.js";
import { isaSimulationSchema, unemploymentBenefitSimulationSchema } from "./simulation.schemas.js";

const baseDiagnosis = {
  householdType: "individual",
  householdSize: 1,
  birthYear: 1966,
  retirementYear: 2026,
  nationalPension: 0,
  retirementPension: 0,
  personalPension: 0,
  monthlyExpense: 2_500_000,
};

const basePortfolio = {
  accountType: "IRP",
  name: "안정형",
  items: [
    { symbol: "BOND", name: "채권 ETF", allocation: 60 },
    { symbol: "STOCK", name: "주식 ETF", allocation: 40 },
  ],
};

describe("diagnosisDataSchema", () => {
  it("금액이 소수면 거부", () => {
    const result = diagnosisDataSchema.safeParse({ ...baseDiagnosis, monthlyExpense: 2_500_000.5 });
    expect(result.success).toBe(false);
  });

  it("개인 가구는 잘못된 배우자 값이 있어도 무시하고 null로 저장", () => {
    const result = diagnosisDataSchema.safeParse({
      ...baseDiagnosis,
      spouseBirthYear: 1800,
      spouseRetirementYear: 1700,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.spouseBirthYear).toBeNull();
      expect(result.data.spouseRetirementYear).toBeNull();
    }
  });

  it("부부 가구는 배우자 값을 검증·유지", () => {
    const ok = diagnosisDataSchema.safeParse({
      ...baseDiagnosis,
      householdType: "couple",
      householdSize: 2,
      spouseBirthYear: 1968,
      spouseRetirementYear: 2028,
    });
    expect(ok.success && ok.data.spouseBirthYear).toBe(1968);

    const bad = diagnosisDataSchema.safeParse({
      ...baseDiagnosis,
      householdType: "couple",
      spouseBirthYear: 1968,
      spouseRetirementYear: 1960,
    });
    expect(bad.success).toBe(false);
  });
});

describe("portfolioDataSchema", () => {
  it("정상 입력 통과", () => {
    expect(portfolioDataSchema.safeParse(basePortfolio).success).toBe(true);
  });

  it("비중 합이 100이 아니면 거부", () => {
    const result = portfolioDataSchema.safeParse({
      ...basePortfolio,
      items: [{ symbol: "BOND", name: "채권", allocation: 70 }],
    });
    expect(result.success).toBe(false);
  });

  it("허용되지 않은 계좌 유형 거부", () => {
    expect(portfolioDataSchema.safeParse({ ...basePortfolio, accountType: "코인" }).success).toBe(false);
  });

  it("항목 수 상한 초과 거부", () => {
    const items = Array.from({ length: 51 }, (_, i) => ({
      symbol: `S${i}`,
      name: `종목${i}`,
      allocation: 100 / 51,
    }));
    expect(portfolioDataSchema.safeParse({ ...basePortfolio, items }).success).toBe(false);
  });

  it("수정 시에도 비중 합 100 검증", () => {
    const result = portfolioUpdateSchema.safeParse({
      items: [{ symbol: "BOND", name: "채권", allocation: 50 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("시뮬레이션 스키마 상·하한", () => {
  it("ISA 연 납입 2천만원 초과 거부", () => {
    const input = { annualContribution: 20_000_001, expectedReturnRate: 5, investmentYears: 5 };
    expect(isaSimulationSchema.safeParse(input).success).toBe(false);
    expect(isaSimulationSchema.safeParse({ ...input, annualContribution: 20_000_000 }).success).toBe(true);
  });

  it("실업급여 가입 기간 0.5년 미만 거부", () => {
    const input = { averageMonthlyWage: 3_000_000, insuranceYears: 0.4, age: 60 };
    expect(unemploymentBenefitSimulationSchema.safeParse(input).success).toBe(false);
    expect(unemploymentBenefitSimulationSchema.safeParse({ ...input, insuranceYears: 0.5 }).success).toBe(true);
  });
});
