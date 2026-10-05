import { createReportService, MAX_REPORTS } from "./report.service.js";
import type { IReportRepo, ReportSnapshotRecord } from "../contracts/report-repo.contract.js";
import type {
  IWithdrawalScenarioRepo,
  WithdrawalScenarioSetRecord,
} from "../contracts/withdrawal-scenario-repo.contract.js";
import { sampleScenarioSet } from "./report/report.fixture.js";
import type { EngineInput } from "./withdrawal/types.js";

const NOW = new Date("2026-10-06T01:00:00.000Z");

const scenarioSet = (overrides: Partial<WithdrawalScenarioSetRecord> = {}): WithdrawalScenarioSetRecord => {
  const result = sampleScenarioSet();
  return {
    id: 7,
    userId: 1,
    ruleVersion: result.ruleVersion,
    input: {} as EngineInput,
    result,
    selectedType: "D",
    createdAt: NOW,
    ...overrides,
  };
};

const setup = (set: WithdrawalScenarioSetRecord | null = scenarioSet()) => {
  const stored = new Map<number, ReportSnapshotRecord>();
  const reportRepo = {
    create: jest.fn(async (userId: number, data: Omit<ReportSnapshotRecord, "id" | "userId" | "generatedAt">) => {
      const record = { id: stored.size + 1, userId, generatedAt: NOW, ...data };
      stored.set(record.id, record);
      return record;
    }),
    findById: jest.fn(async (id: number) => stored.get(id) ?? null),
    findByUserId: jest.fn(async (userId: number) =>
      [...stored.values()]
        .filter((r) => r.userId === userId)
        .map(({ content: _content, ...summary }) => summary),
    ),
    delete: jest.fn(async (id: number) => {
      stored.delete(id);
    }),
    pruneByUserId: jest.fn(),
  } as unknown as { [K in keyof IReportRepo]: jest.Mock };
  const scenarioRepo = {
    findById: jest.fn(async () => set),
  } as unknown as { [K in keyof IWithdrawalScenarioRepo]: jest.Mock };
  const renderPdf = jest.fn(async () => Buffer.from("%PDF-1.3"));

  const service = createReportService(
    {
      reportRepo: reportRepo as unknown as IReportRepo,
      scenarioRepo: scenarioRepo as unknown as IWithdrawalScenarioRepo,
      renderPdf,
    },
    () => NOW,
  );
  return { service, reportRepo, scenarioRepo, renderPdf, stored };
};

describe("ReportService", () => {
  it("시나리오 세트로 스냅샷을 만들고 최근 10건만 남긴다", async () => {
    const { service, reportRepo } = setup();
    const report = await service.create(1, { scenarioSetId: 7, scenarioType: "B" });
    expect(report).toMatchObject({ id: 1, scenarioSetId: 7, scenarioType: "B" });
    expect(report.content.scenario.type).toBe("B");
    expect(report.content.generatedAt).toBe(NOW.toISOString());
    expect("userId" in report).toBe(false);
    expect(reportRepo.pruneByUserId).toHaveBeenCalledWith(1, MAX_REPORTS);
  });

  it("세트가 없으면 404, 다른 사용자 세트면 403", async () => {
    await expect(
      setup(null).service.create(1, { scenarioSetId: 7, scenarioType: "D" }),
    ).rejects.toMatchObject({ code: "SCENARIO_SET_NOT_FOUND", statusCode: 404 });
    await expect(
      setup(scenarioSet({ userId: 2 })).service.create(1, { scenarioSetId: 7, scenarioType: "D" }),
    ).rejects.toMatchObject({ code: "SCENARIO_SET_FORBIDDEN", statusCode: 403 });
  });

  it("세트에 해당 시나리오가 없으면 SCENARIO_NOT_FOUND", async () => {
    const set = scenarioSet();
    set.result = { ...set.result, scenarios: set.result.scenarios.filter((s) => s.type !== "C") };
    await expect(
      setup(set).service.create(1, { scenarioSetId: 7, scenarioType: "C" }),
    ).rejects.toMatchObject({ code: "SCENARIO_NOT_FOUND", statusCode: 404 });
  });

  it("스냅샷은 세트와 별개로 조회된다", async () => {
    const { service, scenarioRepo } = setup();
    const created = await service.create(1, { scenarioSetId: 7, scenarioType: "D" });
    scenarioRepo.findById.mockResolvedValue(null);
    const report = await service.get(created.id, 1);
    expect(report.content.scenario.type).toBe("D");
  });

  it("목록은 본문 없이 돌려준다", async () => {
    const { service } = setup();
    await service.create(1, { scenarioSetId: 7, scenarioType: "D" });
    const list = await service.list(1);
    expect(list).toHaveLength(1);
    expect("content" in list[0]).toBe(false);
    expect("userId" in list[0]).toBe(false);
  });

  it("다른 사용자의 리포트는 조회·삭제·PDF 모두 403, 없으면 404", async () => {
    const { service, renderPdf, reportRepo } = setup();
    const created = await service.create(1, { scenarioSetId: 7, scenarioType: "D" });
    await expect(service.get(created.id, 2)).rejects.toMatchObject({ code: "REPORT_FORBIDDEN" });
    await expect(service.delete(created.id, 2)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.renderPdf(created.id, 2)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.get(99, 1)).rejects.toMatchObject({ code: "REPORT_NOT_FOUND", statusCode: 404 });
    expect(renderPdf).not.toHaveBeenCalled();
    expect(reportRepo.delete).not.toHaveBeenCalled();
  });

  it("본인 리포트의 PDF를 만들고 삭제한다", async () => {
    const { service, renderPdf, stored } = setup();
    const created = await service.create(1, { scenarioSetId: 7, scenarioType: "D" });
    const pdf = await service.renderPdf(created.id, 1);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(renderPdf).toHaveBeenCalledWith(created.content);
    await service.delete(created.id, 1);
    expect(stored.size).toBe(0);
  });
});
