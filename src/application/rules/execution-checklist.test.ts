import { buildExecutionChecklist, EXECUTION_PLAN_DAYS } from "./execution-checklist.js";
import { buildReportContent, type ReportContent } from "../services/report/report-content.js";
import { sampleScenarioSet } from "../services/report/report.fixture.js";

const START = new Date("2026-10-06T00:00:00.000Z");
const content = buildReportContent(sampleScenarioSet(), "D", START) as ReportContent;

describe("buildExecutionChecklist", () => {
  const items = buildExecutionChecklist(content, START);

  it("기한순으로 정렬하고 모든 기한이 1~100일 안에 있다", () => {
    const days = items.map((item) => item.dueDay);
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(Math.min(...days)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...days)).toBe(EXECUTION_PLAN_DAYS);
  });

  it("표준 점검 항목과 리포트의 지금 할 일을 함께 담고 키가 겹치지 않는다", () => {
    const keys = items.map((item) => item.key);
    expect(keys).toEqual(expect.arrayContaining(["health-premium-check", "review-30", "review-100"]));
    expect(keys.filter((key) => key.startsWith("next-action-"))).toHaveLength(content.nextActions.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("실업급여·DC·ISA가 있으면 해당 준비 항목을 넣는다", () => {
    const keys = items.map((item) => item.key);
    expect(keys).toEqual(expect.arrayContaining(["unemployment-apply", "dc-to-irp", "isa-transfer-plan"]));
  });

  it("금액을 넣지 않는다 (운영자 열람 시 원자료 최소화)", () => {
    expect(JSON.stringify(items)).not.toMatch(/\d+만원|\d{1,3}(,\d{3})+원/);
  });
});
