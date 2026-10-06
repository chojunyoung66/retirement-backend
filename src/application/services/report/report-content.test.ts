import { buildReportContent, pickNextActions, REPORT_TITLE } from "./report-content.js";
import { sampleScenarioSet } from "./report.fixture.js";
import type { PlanItem } from "../withdrawal/types.js";

const item = (overrides: Partial<PlanItem>): PlanItem => ({
  accountId: 1,
  accountType: "CASH",
  label: "현금",
  priority: 1,
  actionType: "AS_NEEDED",
  startYm: "2026-11",
  endYm: null,
  monthlyGross: 0,
  monthlyNet: 0,
  totalGross: 0,
  totalTax: 0,
  method: "필요할 때 인출",
  taxNote: "",
  healthInsuranceNote: "",
  cautions: [],
  ...overrides,
});

describe("buildReportContent", () => {
  const set = sampleScenarioSet();
  const generatedAt = new Date("2026-10-06T01:00:00.000Z");

  it("선택한 시나리오를 월별 배열까지 고정하고 A~D 비교를 함께 담는다", () => {
    const content = buildReportContent(set, "D", generatedAt);
    expect(content).not.toBeNull();
    expect(content!.title).toBe(REPORT_TITLE);
    expect(content!.generatedAt).toBe("2026-10-06T01:00:00.000Z");
    expect(content!.ruleVersion).toBe(set.ruleVersion);
    expect(content!.basisDates.length).toBeGreaterThan(0);
    expect(content!.scenario.type).toBe("D");
    const selected = set.scenarios.find((s) => s.type === "D")!;
    expect(content!.scenario.monthly?.ym).toEqual(selected.monthly.ym);
    expect(content!.comparison.map((row) => row.type)).toEqual(["A", "B", "C", "D"]);
    expect(content!.nextActions.length).toBeGreaterThan(0);
    expect(content!.nextActions.length).toBeLessThanOrEqual(3);
  });

  it("없는 시나리오 유형이면 null", () => {
    const withoutD = { ...set, scenarios: set.scenarios.filter((s) => s.type !== "D") };
    expect(buildReportContent(withoutD, "D", generatedAt)).toBeNull();
  });
});

describe("pickNextActions", () => {
  it("보유 항목을 빼고 시작월이 빠른 순, 같은 달이면 우선순위 순으로 3개까지 고른다", () => {
    const actions = pickNextActions(
      [
        item({ label: "DC", priority: 4, startYm: "2032-01", actionType: "ANNUITY" }),
        item({ label: "보유 연금", priority: 5, startYm: "2026-11", actionType: "HOLD" }),
        item({ label: "주식", priority: 3, startYm: "2026-11" }),
        item({ label: "실업급여", priority: 1, startYm: "2026-11", actionType: "INCOME" }),
        item({ label: "ISA", priority: 2, startYm: "2027-03" }),
      ],
      "2026-11",
    );
    expect(actions.map((a) => a.label)).toEqual(["실업급여", "주식", "ISA"]);
  });

  it("시작월이 없으면 계산 시작월로 본다", () => {
    const actions = pickNextActions(
      [item({ label: "나중", startYm: "2027-01" }), item({ label: "시작월 없음", startYm: null, priority: 2 })],
      "2026-11",
    );
    expect(actions[0].label).toBe("시작월 없음");
  });
});
