import { createTaxHealthCheckService, type TaxHealthCheckRequest } from "./tax-health-check.service.js";

const base: TaxHealthCheckRequest = {
  publicPensionAnnual: 12_000_000,
  laborIncome: 0,
  businessIncome: 0,
  financialIncome: 3_000_000,
  otherIncome: 0,
  propertyValue: 300_000_000,
  carValue: 0,
  actualMonthlyPremium: null,
  spouseAnnualIncome: null,
};

describe("TaxHealthCheckService.check", () => {
  const service = createTaxHealthCheckService();

  it("소득·재산이 기준보다 낮으면 피부양자 추정 가능, 추정 보험료만 돌려준다", () => {
    const result = service.check(base);
    expect(result.dependent).toMatchObject({ status: "LIKELY", reasons: [], likelyFails: false });
    expect(result.premium.estimatedMonthly).toBeGreaterThan(0);
    expect(result.premium.comparison).toBe("ESTIMATE_ONLY");
    expect(result.premium.differenceMonthly).toBeNull();
    expect(result.basisDate.domain).toBe("건강보험");
    expect(result.ruleVersion).toMatch(/^KR-/);
  });

  it("실제 고지 보험료와 추정치를 비교한다", () => {
    const estimated = service.check(base).premium.estimatedMonthly;
    const similar = service.check({ ...base, actualMonthlyPremium: estimated });
    const higher = service.check({ ...base, actualMonthlyPremium: estimated * 2 });
    expect(similar.premium).toMatchObject({ comparison: "SIMILAR", differenceMonthly: 0 });
    expect(higher.premium.comparison).toBe("ACTUAL_HIGHER");
    expect(higher.premium.differenceMonthly).toBe(estimated);
  });

  it("근로·사업소득도 소득요건에 반영하고 사업소득 500만원 초과는 요건 초과다 (AC-09)", () => {
    const result = service.check({ ...base, businessIncome: 6_000_000 });
    expect(result.dependent.status).toBe("CAUTION");
    expect(result.dependent.reasons.map((r) => r.code)).toContain("BUSINESS_INCOME_OVER");
    expect(result.dependent.likelyFails).toBe(true);
  });

  it("재산을 모르면 확인 필요와 재산 입력 안내를 준다", () => {
    const result = service.check({ ...base, propertyValue: null });
    expect(result.dependent.status).toBe("CHECK_NEEDED");
    expect(result.checklist[0]).toContain("과세표준");
  });

  it("배우자 소득이 기준을 넘으면 부부 동반 탈락 사유를 표시한다", () => {
    const result = service.check({ ...base, spouseAnnualIncome: 25_000_000 });
    expect(result.dependent.reasons.map((r) => r.code)).toEqual(["SPOUSE_INCOME_OVER"]);
    expect(result.checklist.some((c) => c.includes("부부"))).toBe(true);
  });
});
