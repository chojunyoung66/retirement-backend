import { createReportService, isReportOutdated, MAX_REPORTS } from "./report.service.js";
import type { IReportRepo, ReportSnapshotRecord } from "../contracts/report-repo.contract.js";
import type { IPaymentRepo, PaymentRecord } from "../contracts/payment-repo.contract.js";
import type {
  IWithdrawalScenarioRepo,
  WithdrawalScenarioSetRecord,
} from "../contracts/withdrawal-scenario-repo.contract.js";
import { RULE_SET_VERSION } from "../rules/rule-set.js";
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

const paidOrder = (overrides: Partial<PaymentRecord> = {}): PaymentRecord => ({
  id: 1,
  orderId: "rpt_order0001",
  userId: 1,
  product: "REPORT",
  amount: 9900,
  status: "PAID",
  scenarioSetId: 7,
  scenarioType: "D",
  paymentKey: "pk_1",
  method: "카드",
  approvedAt: NOW,
  canceledAt: null,
  cancelReason: null,
  receiptUrl: null,
  failureCode: null,
  consumedAt: null,
  reportId: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const setup = (
  set: WithdrawalScenarioSetRecord | null = scenarioSet(),
  options: { paymentEnabled?: boolean; order?: PaymentRecord | null } = {},
) => {
  const stored = new Map<number, ReportSnapshotRecord>();
  const save = (userId: number, data: Pick<ReportSnapshotRecord, "scenarioSetId" | "scenarioType" | "ruleVersion" | "content">) => {
    const record: ReportSnapshotRecord = {
      id: stored.size + 1,
      userId,
      title: null,
      firstDownloadedAt: null,
      generatedAt: NOW,
      updatedAt: NOW,
      ...data,
    };
    stored.set(record.id, record);
    return record;
  };
  const reportRepo = {
    create: jest.fn(async (userId: number, data: Parameters<typeof save>[1]) => save(userId, data)),
    findById: jest.fn(async (id: number) => stored.get(id) ?? null),
    findByUserId: jest.fn(async (userId: number) =>
      [...stored.values()]
        .filter((r) => r.userId === userId)
        .map(({ content: _content, ...summary }) => summary),
    ),
    countByUserId: jest.fn(async () => stored.size),
    updateTitle: jest.fn(async (id: number, title: string | null) => {
      const record = { ...stored.get(id)!, title };
      stored.set(id, record);
      const { content: _content, ...summary } = record;
      return summary;
    }),
    markDownloaded: jest.fn(),
    delete: jest.fn(async (id: number) => {
      stored.delete(id);
    }),
  } as unknown as { [K in keyof IReportRepo]: jest.Mock };
  const scenarioRepo = {
    findById: jest.fn(async () => set),
  } as unknown as { [K in keyof IWithdrawalScenarioRepo]: jest.Mock };
  const paymentRepo = {
    findByOrderId: jest.fn(async () => options.order ?? null),
    consumeWithReport: jest.fn(async (_orderId: string, data: { userId: number } & Parameters<typeof save>[1]) =>
      save(data.userId, data),
    ),
  } as unknown as { [K in keyof IPaymentRepo]: jest.Mock };
  const renderPdf = jest.fn(async () => Buffer.from("%PDF-1.3"));
  const renderXlsx = jest.fn(async () => Buffer.from("PK\u0003\u0004"));

  const service = createReportService(
    {
      reportRepo: reportRepo as unknown as IReportRepo,
      scenarioRepo: scenarioRepo as unknown as IWithdrawalScenarioRepo,
      paymentRepo: paymentRepo as unknown as IPaymentRepo,
      renderPdf,
      renderXlsx,
      paymentConfig: { enabled: options.paymentEnabled ?? false, price: 9900 },
    },
    () => NOW,
  );
  return { service, reportRepo, scenarioRepo, paymentRepo, renderPdf, renderXlsx, stored };
};

describe("ReportService", () => {
  it("결제가 꺼져 있으면 시나리오 세트로 바로 스냅샷을 만든다", async () => {
    const { service, reportRepo, paymentRepo } = setup();
    const report = await service.create(1, { scenarioSetId: 7, scenarioType: "B" });
    expect(report).toMatchObject({ id: 1, scenarioSetId: 7, scenarioType: "B", title: null });
    expect(report.content.scenario.type).toBe("B");
    expect(report.content.scenario.monthly?.ym.length).toBeGreaterThan(0);
    expect(report.content.generatedAt).toBe(NOW.toISOString());
    expect("userId" in report).toBe(false);
    expect(reportRepo.create).toHaveBeenCalled();
    expect(paymentRepo.consumeWithReport).not.toHaveBeenCalled();
  });

  it(`보관 한도(${MAX_REPORTS}개)에 이르면 409 REPORT_LIMIT — 오래된 리포트를 지우지 않는다`, async () => {
    const { service, reportRepo } = setup();
    reportRepo.countByUserId.mockResolvedValueOnce(MAX_REPORTS);
    await expect(
      service.create(1, { scenarioSetId: 7, scenarioType: "D" }),
    ).rejects.toMatchObject({ code: "REPORT_LIMIT", statusCode: 409 });
    expect(reportRepo.delete).not.toHaveBeenCalled();
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

  describe("결제가 켜져 있을 때", () => {
    it("주문 ID가 없으면 402 PAYMENT_REQUIRED", async () => {
      const { service, reportRepo } = setup(scenarioSet(), { paymentEnabled: true });
      await expect(
        service.create(1, { scenarioSetId: 7, scenarioType: "D" }),
      ).rejects.toMatchObject({ code: "PAYMENT_REQUIRED", statusCode: 402 });
      expect(reportRepo.create).not.toHaveBeenCalled();
    });

    it("결제 완료·미사용 주문이면 주문을 사용 처리하며 리포트를 만든다", async () => {
      const { service, paymentRepo, reportRepo } = setup(scenarioSet(), {
        paymentEnabled: true,
        order: paidOrder(),
      });
      const report = await service.create(1, { scenarioSetId: 7, scenarioType: "D", orderId: "rpt_order0001" });
      expect(report.scenarioType).toBe("D");
      expect(paymentRepo.consumeWithReport).toHaveBeenCalledWith(
        "rpt_order0001",
        expect.objectContaining({ userId: 1, scenarioSetId: 7, scenarioType: "D" }),
      );
      expect(reportRepo.create).not.toHaveBeenCalled();
    });

    it("결제를 마친 주문은 보관 한도에 걸려도 리포트를 만든다", async () => {
      const { service, reportRepo } = setup(scenarioSet(), { paymentEnabled: true, order: paidOrder() });
      reportRepo.countByUserId.mockResolvedValue(MAX_REPORTS);
      await expect(
        service.create(1, { scenarioSetId: 7, scenarioType: "D", orderId: "rpt_order0001" }),
      ).resolves.toMatchObject({ scenarioType: "D" });
    });

    it.each([
      ["미결제", paidOrder({ status: "READY" }), "PAYMENT_REQUIRED", 402],
      ["이미 사용", paidOrder({ consumedAt: NOW }), "PAYMENT_REQUIRED", 402],
      ["다른 사용자", paidOrder({ userId: 2 }), "PAYMENT_FORBIDDEN", 403],
      ["다른 시나리오", paidOrder({ scenarioType: "A" }), "PAYMENT_ORDER_MISMATCH", 400],
    ])("%s 주문은 거절한다", async (_name, order, code, statusCode) => {
      const { service, paymentRepo } = setup(scenarioSet(), { paymentEnabled: true, order });
      await expect(
        service.create(1, { scenarioSetId: 7, scenarioType: "D", orderId: "rpt_order0001" }),
      ).rejects.toMatchObject({ code, statusCode });
      expect(paymentRepo.consumeWithReport).not.toHaveBeenCalled();
    });

    it("동시에 사용돼 consumeWithReport가 null이면 402", async () => {
      const { service, paymentRepo } = setup(scenarioSet(), { paymentEnabled: true, order: paidOrder() });
      paymentRepo.consumeWithReport.mockResolvedValueOnce(null);
      await expect(
        service.create(1, { scenarioSetId: 7, scenarioType: "D", orderId: "rpt_order0001" }),
      ).rejects.toMatchObject({ code: "PAYMENT_REQUIRED" });
    });
  });

  it("assertCreatable은 저장하지 않고 생성 가능 여부만 확인한다", async () => {
    const { service, reportRepo } = setup();
    await expect(service.assertCreatable(1, { scenarioSetId: 7, scenarioType: "D" })).resolves.toBeUndefined();
    expect(reportRepo.create).not.toHaveBeenCalled();
    reportRepo.countByUserId.mockResolvedValueOnce(MAX_REPORTS);
    await expect(
      service.assertCreatable(1, { scenarioSetId: 7, scenarioType: "D" }),
    ).rejects.toMatchObject({ code: "REPORT_LIMIT" });
  });

  it("스냅샷은 세트와 별개로 조회된다", async () => {
    const { service, scenarioRepo } = setup();
    const created = await service.create(1, { scenarioSetId: 7, scenarioType: "D" });
    scenarioRepo.findById.mockResolvedValue(null);
    const report = await service.get(created.id, 1);
    expect(report.content.scenario.type).toBe("D");
  });

  it("목록은 본문 없이 재계산 권장 여부와 함께 돌려준다", async () => {
    const { service } = setup();
    await service.create(1, { scenarioSetId: 7, scenarioType: "D" });
    const list = await service.list(1);
    expect(list).toHaveLength(1);
    expect("content" in list[0]).toBe(false);
    expect("userId" in list[0]).toBe(false);
    expect(list[0].isOutdated).toBe(false);
  });

  it("규칙 버전이 다르거나 180일이 지나면 재계산을 권한다", () => {
    expect(isReportOutdated({ ruleVersion: RULE_SET_VERSION, generatedAt: NOW }, NOW)).toBe(false);
    expect(isReportOutdated({ ruleVersion: "KR-2025.01", generatedAt: NOW }, NOW)).toBe(true);
    const old = new Date(NOW.getTime() - 181 * 24 * 60 * 60 * 1000);
    expect(isReportOutdated({ ruleVersion: RULE_SET_VERSION, generatedAt: old }, NOW)).toBe(true);
  });

  it("이름을 바꾸고, 빈 문자열이면 기본 이름(null)으로 되돌린다", async () => {
    const { service, reportRepo } = setup();
    const created = await service.create(1, { scenarioSetId: 7, scenarioType: "D" });
    expect((await service.rename(created.id, 1, "  퇴직 첫해 계획 ")).title).toBe("퇴직 첫해 계획");
    expect(reportRepo.updateTitle).toHaveBeenLastCalledWith(created.id, "퇴직 첫해 계획");
    expect((await service.rename(created.id, 1, "   ")).title).toBeNull();
    await expect(service.rename(created.id, 2, "남의 것")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("다른 사용자의 리포트는 조회·삭제·PDF·엑셀 모두 403, 없으면 404", async () => {
    const { service, renderPdf, renderXlsx, reportRepo } = setup();
    const created = await service.create(1, { scenarioSetId: 7, scenarioType: "D" });
    await expect(service.get(created.id, 2)).rejects.toMatchObject({ code: "REPORT_FORBIDDEN" });
    await expect(service.delete(created.id, 2)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.renderPdf(created.id, 2)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.renderXlsx(created.id, 2)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.get(99, 1)).rejects.toMatchObject({ code: "REPORT_NOT_FOUND", statusCode: 404 });
    expect(renderPdf).not.toHaveBeenCalled();
    expect(renderXlsx).not.toHaveBeenCalled();
    expect(reportRepo.delete).not.toHaveBeenCalled();
    expect(reportRepo.markDownloaded).not.toHaveBeenCalled();
  });

  it("PDF·엑셀을 만들면 처음 받은 시각을 기록하고, 삭제할 수 있다", async () => {
    const { service, renderPdf, renderXlsx, reportRepo, stored } = setup();
    const created = await service.create(1, { scenarioSetId: 7, scenarioType: "D" });
    const pdf = await service.renderPdf(created.id, 1);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(renderPdf).toHaveBeenCalledWith(created.content);
    const xlsx = await service.renderXlsx(created.id, 1);
    expect(xlsx.subarray(0, 2).toString()).toBe("PK");
    expect(renderXlsx).toHaveBeenCalledWith(created.content);
    expect(reportRepo.markDownloaded).toHaveBeenCalledWith(created.id, NOW);
    await service.delete(created.id, 1);
    expect(stored.size).toBe(0);
  });
});
