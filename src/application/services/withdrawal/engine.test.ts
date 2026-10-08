import { generateScenarioSet, recommendScenario } from "./engine.js";
import { assessDependent, dependentStatusOf } from "./dependent.js";
import { isaTransferOf } from "./isa-transfer.js";
import { calculateRetirementIncomeTax } from "../calculators/severance-pay.calculator.js";
import {
  annuityLimitOf,
  deferredRatioOf,
  privatePensionRateOf,
  retirementTaxRateOf,
  splitLocalTax,
} from "./tax.js";
import { addMonths, ageAtIndex, indexOfAge, indexToYm, ymToIndex } from "./timeline.js";
import type { EngineAccount, EngineInput } from "./types.js";

const account = (
  id: number,
  accountType: EngineAccount["accountType"],
  balance: number,
  extra: Partial<EngineAccount> = {},
): EngineAccount => ({
  id,
  accountType,
  label: `계좌${id}`,
  balance,
  principalTaxCredited: 0,
  principalNonDeductible: 0,
  investmentGain: 0,
  deferredRetirementIncome: 0,
  irpSource: null,
  pensionSavingsLegacy: null,
  isaMaturityYm: null,
  ...extra,
});

// 골든 페르소나: 1968년생, 2026년 퇴직, 국민연금 64세 개시
const persona = (overrides: Partial<EngineInput> = {}): EngineInput => ({
  startYm: "2026-11",
  birthYear: 1968,
  householdType: "individual",
  monthlyExpense: 3_000_000,
  nationalPension: { monthlyAmount: 1_200_000, startAge: 64, source: "request" },
  unemployment: { startYm: "2026-11", months: 9, monthlyAmount: 1_980_000, source: "request" },
  yearsOfService: { value: 25, source: "request" },
  propertyValue: 400_000_000,
  accounts: [
    account(1, "DC", 300_000_000),
    account(2, "PENSION_SAVINGS", 100_000_000, {
      principalTaxCredited: 60_000_000,
      principalNonDeductible: 20_000_000,
      investmentGain: 20_000_000,
    }),
    account(3, "IRP", 50_000_000, {
      principalTaxCredited: 30_000_000,
      investmentGain: 10_000_000,
      irpSource: "PERSONAL",
    }),
    account(4, "ISA", 30_000_000, { investmentGain: 5_000_000, isaMaturityYm: "2027-03" }),
    account(5, "BROKERAGE", 100_000_000),
    account(6, "CASH", 20_000_000),
  ],
  ...overrides,
});

const scenarioOf = (type: string, input = persona()) => {
  const scenario = generateScenarioSet(input).scenarios.find((s) => s.type === type);
  if (!scenario) throw new Error(`scenario ${type} missing`);
  return scenario;
};

describe("timeline", () => {
  it("월 인덱스와 YYYY-MM을 서로 변환한다", () => {
    expect(indexToYm(ymToIndex("2026-11"))).toBe("2026-11");
    expect(addMonths("2026-11", 3)).toBe("2027-02");
  });

  it("연 단위 나이와 해당 나이 1월 인덱스를 계산한다", () => {
    expect(ageAtIndex(1968, ymToIndex("2026-11"))).toBe(58);
    expect(indexToYm(indexOfAge(1968, 64))).toBe("2032-01");
  });
});

describe("tax helpers", () => {
  it("사적연금 연금소득세율을 나이별로 적용한다", () => {
    expect(privatePensionRateOf(58)).toBe(0.055);
    expect(privatePensionRateOf(70)).toBe(0.044);
    expect(privatePensionRateOf(80)).toBe(0.033);
  });

  it("이연퇴직소득 연금수령 비율은 수령연차별 70/60/50%다", () => {
    expect(deferredRatioOf(1)).toBe(0.7);
    expect(deferredRatioOf(10)).toBe(0.7);
    expect(deferredRatioOf(11)).toBe(0.6);
    expect(deferredRatioOf(21)).toBe(0.5);
  });

  it("퇴직소득세 실효세율은 0~1 사이이고 근속이 길수록 낮다", () => {
    const short = retirementTaxRateOf(300_000_000, 10);
    const long = retirementTaxRateOf(300_000_000, 25);
    expect(short).toBeGreaterThan(0);
    expect(short).toBeLessThan(1);
    expect(long).toBeLessThan(short);
  });

  it("지방소득세 포함 세액을 소득세와 지방소득세(국세의 10%)로 나눈다", () => {
    expect(splitLocalTax(1_100_000)).toEqual({ incomeTax: 1_000_000, localIncomeTax: 100_000 });
    expect(splitLocalTax(0)).toEqual({ incomeTax: 0, localIncomeTax: 0 });
    const { incomeTax, localIncomeTax } = splitLocalTax(17_220_001);
    expect(incomeTax + localIncomeTax).toBe(17_220_001);
  });

  it("연금수령한도는 평가액÷(11−연차)×120%이고 11년차부터 없다", () => {
    expect(annuityLimitOf(100_000_000, 1)).toBeCloseTo(12_000_000);
    expect(annuityLimitOf(100_000_000, 6)).toBeCloseTo(24_000_000);
    expect(annuityLimitOf(100_000_000, 10)).toBeCloseTo(120_000_000);
    expect(annuityLimitOf(100_000_000, 11)).toBeNull();
  });
});

describe("dependentStatusOf", () => {
  it("재산 정보가 없으면 확인 필요", () => {
    expect(
      dependentStatusOf({ publicPensionAnnual: 0, financialIncomeAnnual: 0, propertyValue: null }),
    ).toBe("CHECK_NEEDED");
  });

  it("소득·재산이 기준보다 충분히 낮으면 추정 가능", () => {
    expect(
      dependentStatusOf({
        publicPensionAnnual: 12_000_000,
        financialIncomeAnnual: 3_000_000,
        propertyValue: 300_000_000,
      }),
    ).toBe("LIKELY");
  });

  it("기준을 넘거나 경계에 가까우면 주의", () => {
    expect(
      dependentStatusOf({
        publicPensionAnnual: 25_000_000,
        financialIncomeAnnual: 0,
        propertyValue: 300_000_000,
      }),
    ).toBe("CAUTION");
    expect(
      dependentStatusOf({
        publicPensionAnnual: 19_000_000,
        financialIncomeAnnual: 0,
        propertyValue: 300_000_000,
      }),
    ).toBe("CAUTION");
  });
});

describe("generateScenarioSet (골든 페르소나)", () => {
  const set = generateScenarioSet(persona());

  it("A~D 4개 시나리오를 같은 입력·기간으로 만든다 (AC-03)", () => {
    expect(set.scenarios.map((s) => s.type)).toEqual(["A", "B", "C", "D"]);
    for (const s of set.scenarios) {
      expect(s.monthly.ym[0]).toBe(set.startYm);
      expect(s.monthly.ym[s.monthly.ym.length - 1]).toBe(set.endYm);
      expect(s.yearly[0].expense).toBe(set.scenarios[0].yearly[0].expense);
    }
    expect(set.inputSummary.accountsCount).toBe(6);
    expect(set.inputSummary.totalBalance).toBe(600_000_000);
  });

  it("규칙 버전·기준일과 추천 시나리오를 함께 반환한다", () => {
    expect(set.ruleVersion).toMatch(/^KR-/);
    expect(set.basisDates.length).toBeGreaterThan(0);
    expect(set.recommendedType).toBe("D");
    expect(set.scenarios.filter((s) => s.recommended).map((s) => s.type)).toEqual(["D"]);
  });

  it("시나리오마다 계좌별 실행안이 1개 이상 있다", () => {
    for (const s of set.scenarios) {
      expect(s.planItems.length).toBeGreaterThan(0);
      expect(s.planItems.every((p) => p.method.length > 0 && p.taxNote.length > 0)).toBe(true);
    }
  });

  it("D의 우선순위는 실업급여 → 주식 → ISA → DC → 연금저축·IRP (AC-05)", () => {
    const d = scenarioOf("D");
    expect(d.priorityOrder).toEqual([
      "실업급여",
      "주식계좌",
      "ISA",
      "퇴직연금 DC(국민연금 개시 후)",
      "연금저축·IRP(70세 이후)",
    ]);
    expect(d.planItems[0].accountType).toBe("UNEMPLOYMENT");
    const dc = d.planItems.find((p) => p.accountType === "DC");
    expect(dc?.actionType).toBe("ANNUITY");
    expect(dc?.startYm).toBe("2032-01");
  });

  it("비공제 원금 미입력 연금계좌에는 확인 필요 문구를 단다 (AC-06)", () => {
    for (const s of set.scenarios) {
      const irp = s.planItems.find((p) => p.accountType === "IRP");
      expect(irp?.cautions.some((c) => c.includes("비공제 원금 확인 필요"))).toBe(true);
      const pensionSavings = s.planItems.find((p) => p.accountType === "PENSION_SAVINGS");
      expect(pensionSavings?.cautions.some((c) => c.includes("비공제 원금 확인 필요"))).toBe(
        false,
      );
    }
    const checks = Object.fromEntries(set.accountChecks.map((c) => [c.accountType, c]));
    expect(checks.IRP.nonDeductibleStatus).toBe("CHECK_NEEDED");
    expect(checks.IRP.unknownAmount).toBe(10_000_000);
    expect(checks.PENSION_SAVINGS.nonDeductibleStatus).toBe("CONFIRMED");
    expect(checks.DC.nonDeductibleStatus).toBe("NOT_APPLICABLE");
  });

  it("DC는 비과세로 안내하지 않고 세금이 발생한다 (AC-07)", () => {
    for (const s of set.scenarios) {
      const dc = s.planItems.find((p) => p.accountType === "DC");
      expect(dc).toBeDefined();
      expect(dc?.taxNote).not.toContain("비과세");
      expect(dc?.totalTax).toBeGreaterThan(0);
    }
  });

  it("ISA 연금 전환 안내에 3천만원 초과분 효과 제한을 적는다 (AC-08)", () => {
    for (const s of set.scenarios) {
      const isa = s.planItems.find((p) => p.accountType === "ISA");
      expect(isa?.taxNote).toContain("3천만원");
    }
  });

  it("피부양자 상태는 3단계 중 하나다 (AC-09)", () => {
    for (const s of set.scenarios) {
      for (const row of s.yearly) {
        expect(["LIKELY", "CAUTION", "CHECK_NEEDED"]).toContain(row.dependentStatus);
      }
    }
  });

  it("세전 = 세후 + 세금이고 금액이 음수가 아니다", () => {
    for (const s of set.scenarios) {
      const { grossWithdrawal, totalTax, netWithdrawal } = s.summary;
      expect(grossWithdrawal).toBe(netWithdrawal + totalTax);
      expect(totalTax).toBeGreaterThanOrEqual(0);
      for (const row of s.yearly) {
        expect(row.grossWithdrawal).toBeGreaterThanOrEqual(0);
        expect(row.endingBalance).toBeGreaterThanOrEqual(0);
        expect(row.shortfall).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("A는 시작 시점에 연금계좌를 일시금으로 받는다", () => {
    const a = scenarioOf("A");
    for (const type of ["DC", "PENSION_SAVINGS", "IRP"]) {
      const item = a.planItems.find((p) => p.accountType === type);
      expect(item?.actionType).toBe("LUMP_SUM");
      expect(item?.startYm).toBe("2026-11");
    }
  });

  it("연금수령(D)은 일시금(A)보다 총세금이 적고 부족 시점이 늦다", () => {
    const a = scenarioOf("A").summary;
    const d = scenarioOf("D").summary;
    expect(d.totalTax).toBeLessThan(a.totalTax);
    expect((d.firstShortfallYm ?? "9999") >= (a.firstShortfallYm ?? "9999")).toBe(true);
  });

  // KR-2026.10 고도화: 국민연금이 피부양자 소득 기준을 넘는 연도에 지역보험료를 지출에 더해 소진이 앞당겨졌다
  it("골든 결과가 유지된다", () => {
    const summary = Object.fromEntries(
      set.scenarios.map((s) => [
        s.type,
        {
          totalTax: s.summary.totalTax,
          depletionAge: s.summary.depletionAge,
          firstShortfallYm: s.summary.firstShortfallYm,
        },
      ]),
    );
    expect(summary).toEqual({
      A: { totalTax: 48_186_238, depletionAge: 81, firstShortfallYm: "2049-03" },
      B: { totalTax: 43_999_241, depletionAge: 81, firstShortfallYm: "2049-07" },
      C: { totalTax: 48_288_871, depletionAge: 81, firstShortfallYm: "2049-10" },
      D: { totalTax: 42_883_763, depletionAge: 81, firstShortfallYm: "2049-12" },
    });
  });
});

describe("generateScenarioSet (예외 입력)", () => {
  it("IRP 원천이 퇴직금이고 구분이 없으면 전액 이연퇴직소득으로 본다", () => {
    const input = persona({
      accounts: [account(1, "IRP", 100_000_000, { irpSource: "SEVERANCE" })],
    });
    const set = generateScenarioSet(input);
    expect(set.accountChecks[0].nonDeductibleStatus).toBe("NOT_APPLICABLE");
    const irp = set.scenarios
      .find((s) => s.type === "A")
      ?.planItems.find((p) => p.accountType === "IRP");
    expect(irp?.cautions.some((c) => c.includes("비공제 원금 확인 필요"))).toBe(false);
    expect(irp?.totalTax).toBeGreaterThan(0);
  });

  it("근속연수가 기본값이면 경고를 남긴다", () => {
    const input = persona({ yearsOfService: { value: 20, source: "default" } });
    const dc = generateScenarioSet(input)
      .scenarios.find((s) => s.type === "D")
      ?.planItems.find((p) => p.accountType === "DC");
    expect(dc?.cautions.some((c) => c.includes("근속"))).toBe(true);
  });

  it("재산 정보가 없으면 피부양자 상태는 확인 필요다", () => {
    const set = generateScenarioSet(persona({ propertyValue: null }));
    for (const s of set.scenarios) {
      expect(s.yearly.every((row) => row.dependentStatus === "CHECK_NEEDED")).toBe(true);
    }
  });

  it("실업급여가 없으면 실업급여 항목을 만들지 않는다", () => {
    const d = scenarioOf("D", persona({ unemployment: null }));
    expect(d.planItems.some((p) => p.accountType === "UNEMPLOYMENT")).toBe(false);
  });
});

describe("assessDependent", () => {
  it("판단 사유와 요건 초과 여부를 함께 돌려준다", () => {
    expect(
      assessDependent({ publicPensionAnnual: 25_000_000, financialIncomeAnnual: 0, propertyValue: 300_000_000 }),
    ).toEqual({ status: "CAUTION", reasons: ["INCOME_OVER"], fails: true });
    expect(
      assessDependent({ publicPensionAnnual: 19_000_000, financialIncomeAnnual: 0, propertyValue: 300_000_000 }),
    ).toEqual({ status: "CAUTION", reasons: ["INCOME_NEAR"], fails: false });
  });

  it("부부는 배우자 소득이 기준을 넘으면 함께 탈락할 수 있다", () => {
    const result = assessDependent({
      publicPensionAnnual: 0,
      financialIncomeAnnual: 0,
      propertyValue: 300_000_000,
      spousePublicPensionAnnual: 22_000_000,
    });
    expect(result.reasons).toEqual(["SPOUSE_INCOME_OVER"]);
    expect(result.fails).toBe(true);
  });

  it("재산 5.4억~9억 구간은 소득 1천만원 초과일 때만 요건 초과다", () => {
    const low = assessDependent({ publicPensionAnnual: 8_000_000, financialIncomeAnnual: 0, propertyValue: 600_000_000 });
    const high = assessDependent({ publicPensionAnnual: 12_000_000, financialIncomeAnnual: 0, propertyValue: 600_000_000 });
    expect(low).toMatchObject({ status: "CAUTION", reasons: ["PROPERTY_MID"], fails: false });
    expect(high).toMatchObject({ reasons: ["PROPERTY_MID"], fails: true });
  });
});

describe("isaTransferOf", () => {
  it("전환액 10%(최대 300만원)를 추가 공제대상으로 보고 3천만원 초과분은 효과가 없다 (AC-08)", () => {
    expect(isaTransferOf(20_000_000)).toMatchObject({ extraCreditBase: 2_000_000, excessOverCap: 0 });
    expect(isaTransferOf(50_000_000)).toMatchObject({
      extraCreditBase: 3_000_000,
      excessOverCap: 20_000_000,
      maxTaxCreditEstimate: 396_000,
    });
  });

  it("세트 결과에 ISA 전략을 담고, 퇴직 후 만기면 효과 제한으로 표시한다", () => {
    const set = generateScenarioSet(persona());
    expect(set.isaStrategy).toHaveLength(1);
    const isa = set.isaStrategy[0];
    expect(isa).toMatchObject({ maturityYm: "2027-03", extraCreditBase: 3_000_000, effectLimitedAfterRetirement: true });
    expect(isa.notes.some((n) => n.includes("60일"))).toBe(true);
  });
});

describe("generateScenarioSet (고도화)", () => {
  it("피부양자 요건을 넘는 연도에만 지역 건강보험료를 지출에 더한다", () => {
    const set = generateScenarioSet(persona());
    const d = set.scenarios.find((s) => s.type === "D")!;
    for (const row of d.yearly) {
      if (row.dependentStatus === "LIKELY") expect(row.healthPremium).toBe(0);
      if (row.dependentReasons.includes("INCOME_OVER")) expect(row.healthPremium).toBeGreaterThan(0);
    }
    expect(d.yearly.some((r) => r.healthPremium > 0)).toBe(true);
  });

  it("진단 건강보험료는 피부양자 추정 가능 연도에 0원으로 대체된다", () => {
    const base = scenarioOf("D", persona({ nationalPension: { monthlyAmount: 0, startAge: 64, source: "none" } }));
    const withInput = scenarioOf(
      "D",
      persona({
        nationalPension: { monthlyAmount: 0, startAge: 64, source: "none" },
        monthlyExpense: 3_200_000,
        healthInsuranceInExpense: 200_000,
      }),
    );
    expect(withInput.yearly[1].expense).toBe(base.yearly[1].expense);
  });

  it("재산 미입력이면 진단 건강보험료를 그대로 유지한다", () => {
    const d = scenarioOf("D", persona({ propertyValue: null, healthInsuranceInExpense: 200_000 }));
    expect(d.yearly[0].healthPremium).toBe(200_000 * 2);
    expect(d.yearly[0].dependentReasons).toEqual(["PROPERTY_UNKNOWN"]);
  });

  it("배우자 국민연금을 배우자 나이 기준으로 수입에 반영한다", () => {
    const d = scenarioOf(
      "D",
      persona({
        householdType: "couple",
        spouseBirthYear: 1970,
        spouseNationalPension: { monthlyAmount: 800_000, startAge: 65, source: "request" },
      }),
    );
    const before = d.yearly.find((r) => r.year === 2034)!;
    const after = d.yearly.find((r) => r.year === 2035)!;
    expect(before.spouseNationalPension).toBe(0);
    expect(after.spouseNationalPension).toBeGreaterThan(800_000 * 12);
  });

  it("월별 세후 인출 시리즈를 함께 돌려준다", () => {
    const d = scenarioOf("D");
    expect(d.monthly.net).toHaveLength(d.monthly.ym.length);
    expect(d.monthly.net.every((v) => v >= 0)).toBe(true);
  });

  it("추천은 하나뿐이고 recommendedType과 일치한다", () => {
    const set = generateScenarioSet(persona());
    const recommended = set.scenarios.filter((s) => s.recommended);
    expect(recommended).toHaveLength(1);
    expect(recommended[0].type).toBe(set.recommendedType);
    expect(set.recommendationNote).toContain("추천합니다");
  });
});

describe("generateScenarioSet (계좌 총액·연금수령한도)", () => {
  it("계좌 항목에 시작 시점 총액을 담고 실업급여·잉여 적립은 비운다", () => {
    const d = scenarioOf("D");
    expect(d.planItems.find((p) => p.accountType === "DC")?.startBalance).toBe(300_000_000);
    expect(d.planItems.find((p) => p.accountType === "UNEMPLOYMENT")?.startBalance).toBeNull();
  });

  it("첫해 한도는 시작 잔액의 12%이고 10년차까지만 담는다", () => {
    const dc = scenarioOf("B").planItems.find((p) => p.accountType === "DC")!;
    const limit = dc.annuityLimit!;
    expect(limit.baseYear).toBe(2026);
    expect(limit.legacy).toBe(false);
    expect(limit.years[0]).toMatchObject({
      year: 2026,
      receiptYear: 1,
      openingBalance: 300_000_000,
      limit: 36_000_000,
    });
    expect(limit.years[0].planned).toBeGreaterThan(0);
    expect(limit.years[limit.years.length - 1].receiptYear).toBeLessThanOrEqual(10);
    expect(limit.exceededYears).toEqual([]);
  });

  it("만 55세 전에 시작하면 55세가 되는 해를 1년차로 본다", () => {
    const dc = scenarioOf("B", persona({ birthYear: 1975 })).planItems.find(
      (p) => p.accountType === "DC",
    )!;
    expect(dc.annuityLimit!.baseYear).toBe(2030);
    expect(dc.annuityLimit!.years[0].year).toBe(2030);
  });

  it("구계좌 연금저축은 6년차부터 기산한다", () => {
    const input = persona({
      unemployment: null,
      monthlyExpense: 500_000,
      accounts: [account(1, "PENSION_SAVINGS", 100_000_000, { pensionSavingsLegacy: true })],
    });
    const item = scenarioOf("B", input).planItems.find((p) => p.accountType === "PENSION_SAVINGS")!;
    expect(item.annuityLimit!.legacy).toBe(true);
    expect(item.annuityLimit!.years[0]).toMatchObject({ receiptYear: 6, limit: 24_000_000 });
    expect(item.annuityLimit!.years.map((y) => y.receiptYear)).toEqual([6, 7, 8, 9, 10]);
  });

  it("필요할 때 인출이 한도를 넘는 해를 찾아 운영 메모로 알린다", () => {
    const input = persona({
      unemployment: null,
      nationalPension: { monthlyAmount: 0, startAge: 65, source: "none" },
      accounts: [account(1, "PENSION_SAVINGS", 100_000_000)],
    });
    const item = scenarioOf("D", input).planItems.find((p) => p.accountType === "PENSION_SAVINGS")!;
    const limit = item.annuityLimit!;
    // 2026년은 11~12월 두 달만 인출해 첫해 한도(1,200만원) 안이다
    expect(limit.exceededYears).not.toContain(2026);
    expect(limit.exceededYears).toContain(2027);
    expect(item.cautions.some((c) => c.includes("2027") && c.includes("연금수령한도를 넘어"))).toBe(
      true,
    );
    expect(item.cautions.some((c) => c.includes("2026년을 연금수령 1년차"))).toBe(true);
  });

  it("A안 일시금 계좌와 비연금 계좌는 한도를 비운다", () => {
    const a = scenarioOf("A");
    for (const type of ["DC", "PENSION_SAVINGS", "IRP"]) {
      expect(a.planItems.find((p) => p.accountType === type)?.annuityLimit).toBeNull();
    }
    const d = scenarioOf("D");
    for (const type of ["ISA", "BROKERAGE", "CASH", "UNEMPLOYMENT"]) {
      expect(d.planItems.find((p) => p.accountType === type)?.annuityLimit).toBeNull();
    }
  });
});

describe("generateScenarioSet (지방소득세 분리)", () => {
  const set = generateScenarioSet(persona());

  it("항목·연도·요약 모두 지방소득세가 세금의 1/11이다", () => {
    for (const s of set.scenarios) {
      expect(s.summary.localIncomeTax).toBe(splitLocalTax(s.summary.totalTax).localIncomeTax);
      for (const row of s.yearly) {
        expect(row.localIncomeTax).toBe(Math.round(row.tax / 11));
      }
      for (const item of s.planItems) {
        expect(item.localIncomeTax).toBe(Math.round(item.totalTax / 11));
      }
    }
  });

  it("퇴직소득 일시금의 지방소득세는 퇴직소득세 계산기와 1원 이내로 같다", () => {
    const dc = scenarioOf("A").planItems.find((p) => p.accountType === "DC")!;
    const calculated = calculateRetirementIncomeTax(300_000_000, 25);
    expect(dc.totalTax).toBe(calculated.totalTax);
    expect(Math.abs(dc.localIncomeTax - calculated.localIncomeTax)).toBeLessThanOrEqual(1);
  });
});

describe("recommendScenario", () => {
  const card = (
    type: "A" | "B" | "C" | "D",
    summary: Partial<{ firstShortfallYm: string | null; dependentLikelyYears: number; totalTax: number }>,
  ) => ({
    ...scenarioOf(type),
    summary: {
      ...scenarioOf(type).summary,
      firstShortfallYm: null,
      dependentLikelyYears: 0,
      totalTax: 10_000_000,
      ...summary,
    },
  });

  it("소진이 가장 늦은 안들 중 피부양자 연수가 긴 안을 고른다", () => {
    const result = recommendScenario([
      card("A", { firstShortfallYm: "2040-01" }),
      card("B", { dependentLikelyYears: 3 }),
      card("C", { dependentLikelyYears: 5, totalTax: 20_000_000 }),
      card("D", { dependentLikelyYears: 2 }),
    ]);
    expect(result.type).toBe("C");
  });

  it("피부양자 연수가 같으면 세금이 적은 안, 그마저 같으면 D를 고른다", () => {
    expect(
      recommendScenario([card("A", {}), card("B", { totalTax: 5_000_000 }), card("C", {}), card("D", {})]).type,
    ).toBe("B");
    expect(recommendScenario([card("A", {}), card("B", {}), card("C", {}), card("D", {})]).type).toBe("D");
  });

  it("12개월 이내 소진 차이는 같은 수준으로 본다", () => {
    const result = recommendScenario([
      card("A", { firstShortfallYm: "2049-12" }),
      card("D", { firstShortfallYm: "2049-03", dependentLikelyYears: 4 }),
    ]);
    expect(result.type).toBe("D");
  });
});
