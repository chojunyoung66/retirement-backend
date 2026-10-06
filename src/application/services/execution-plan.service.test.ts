import { createExecutionPlanService, executionProgress } from "./execution-plan.service.js";
import type {
  ExecutionPlanRecord,
  IExecutionPlanRepo,
} from "../contracts/execution-plan-repo.contract.js";
import type { IReportRepo, ReportSnapshotRecord } from "../contracts/report-repo.contract.js";
import { buildReportContent, type ReportContent } from "./report/report-content.js";
import { sampleScenarioSet } from "./report/report.fixture.js";

const START = new Date("2026-10-06T01:00:00.000Z");
const content = buildReportContent(sampleScenarioSet(), "D", START) as ReportContent;

const report: ReportSnapshotRecord = {
  id: 5,
  userId: 1,
  scenarioSetId: 7,
  scenarioType: "D",
  ruleVersion: content.ruleVersion,
  title: null,
  firstDownloadedAt: null,
  generatedAt: START,
  updatedAt: START,
  content,
};

const setup = (now = START) => {
  let stored: ExecutionPlanRecord | null = null;
  const executionPlanRepo = {
    create: jest.fn(async (data: Omit<ExecutionPlanRecord, "id" | "createdAt" | "updatedAt">) => {
      stored = { id: 3, createdAt: START, updatedAt: START, ...data };
      return stored;
    }),
    findById: jest.fn(async () => stored),
    findByReportId: jest.fn(async () => stored),
    updateItems: jest.fn(async (_id: number, items: ExecutionPlanRecord["items"]) => {
      stored = { ...stored!, items };
      return stored;
    }),
  } as unknown as { [K in keyof IExecutionPlanRepo]: jest.Mock };
  const reportRepo = {
    findById: jest.fn(async () => report),
  } as unknown as { [K in keyof IReportRepo]: jest.Mock };
  const service = createExecutionPlanService(
    {
      executionPlanRepo: executionPlanRepo as unknown as IExecutionPlanRepo,
      reportRepo: reportRepo as unknown as IReportRepo,
    },
    () => now,
  );
  return { service, executionPlanRepo, reportRepo };
};

describe("ExecutionPlanService", () => {
  it("리포트로 100일 체크리스트를 만들고, 다시 시작하면 기존 계획을 돌려준다", async () => {
    const { service, executionPlanRepo } = setup();
    const first = await service.start(1, 5);
    expect(first.created).toBe(true);
    expect(first.plan.items.length).toBeGreaterThan(5);
    expect(first.plan.items.every((item) => item.doneAt === null)).toBe(true);
    expect(first.plan.progress).toEqual({ done: 0, total: first.plan.items.length, currentDay: 1 });
    expect("userId" in first.plan).toBe(false);
    const second = await service.start(1, 5);
    expect(second.created).toBe(false);
    expect(executionPlanRepo.create).toHaveBeenCalledTimes(1);
  });

  it("다른 사용자의 리포트·계획은 403", async () => {
    const { service, reportRepo } = setup();
    reportRepo.findById.mockResolvedValueOnce({ ...report, userId: 2 });
    await expect(service.start(1, 5)).rejects.toMatchObject({ code: "REPORT_FORBIDDEN" });
    await service.start(1, 5);
    await expect(service.setItemDone(2, 3, "review-30", true)).rejects.toMatchObject({
      code: "EXECUTION_PLAN_FORBIDDEN",
    });
  });

  it("항목을 완료·해제하고 진행률을 다시 계산한다", async () => {
    const { service } = setup();
    await service.start(1, 5);
    const done = await service.setItemDone(1, 3, "review-30", true);
    expect(done.items.find((item) => item.key === "review-30")?.doneAt).toBe(START.toISOString());
    expect(done.progress.done).toBe(1);
    const undone = await service.setItemDone(1, 3, "review-30", false);
    expect(undone.progress.done).toBe(0);
    await expect(service.setItemDone(1, 3, "nope", true)).rejects.toMatchObject({
      code: "EXECUTION_ITEM_NOT_FOUND",
    });
  });

  it("오늘이 며칠째인지 시작일을 1일째로, 100일을 넘지 않게 센다", () => {
    const plan = { startDate: START, items: [] } as unknown as ExecutionPlanRecord;
    const day = 24 * 60 * 60 * 1000;
    expect(executionProgress(plan, new Date(START.getTime() + 9 * day)).currentDay).toBe(10);
    expect(executionProgress(plan, new Date(START.getTime() + 150 * day)).currentDay).toBe(100);
  });

  it("시작 전이면 404", async () => {
    await expect(setup().service.getByReport(1, 5)).rejects.toMatchObject({
      code: "EXECUTION_PLAN_NOT_FOUND",
      statusCode: 404,
    });
  });
});
