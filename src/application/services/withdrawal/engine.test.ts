import { generateScenarioSet } from "./engine.js";
import { dependentStatusOf } from "./dependent.js";
import { deferredRatioOf, privatePensionRateOf, retirementTaxRateOf } from "./tax.js";
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
      A: { totalTax: 48_195_012, depletionAge: 82, firstShortfallYm: "2050-01" },
      B: { totalTax: 44_013_759, depletionAge: 82, firstShortfallYm: "2050-06" },
      C: { totalTax: 50_450_857, depletionAge: 82, firstShortfallYm: "2050-08" },
      D: { totalTax: 41_902_520, depletionAge: 82, firstShortfallYm: "2050-12" },
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
