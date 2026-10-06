import { createReviewRequestService, MAX_ACTIVE_REVIEWS } from "./review-request.service.js";
import type { IExecutionPlanRepo } from "../contracts/execution-plan-repo.contract.js";
import type { IReportRepo, ReportSnapshotRecord } from "../contracts/report-repo.contract.js";
import type {
  IReviewRequestRepo,
  ReviewRequestRecord,
} from "../contracts/review-request-repo.contract.js";
import { buildReportContent, type ReportContent } from "./report/report-content.js";
import { sampleScenarioSet } from "./report/report.fixture.js";

const NOW = new Date("2026-10-06T01:00:00.000Z");
const content = buildReportContent(sampleScenarioSet(), "D", NOW) as ReportContent;

const report: ReportSnapshotRecord = {
  id: 5,
  userId: 1,
  scenarioSetId: 7,
  scenarioType: "D",
  ruleVersion: content.ruleVersion,
  title: null,
  firstDownloadedAt: null,
  generatedAt: NOW,
  updatedAt: NOW,
  content,
};

const review = (overrides: Partial<ReviewRequestRecord> = {}): ReviewRequestRecord => ({
  id: 9,
  userId: 1,
  reportId: 5,
  question: "DC를 연금으로 받는 게 맞을까요?",
  consentAt: NOW,
  status: "REQUESTED",
  answer: null,
  answeredAt: null,
  operatorNote: "내부 메모",
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const setup = () => {
  const reviewRepo = {
    create: jest.fn(async (data: Partial<ReviewRequestRecord>) => review({ ...data, operatorNote: null })),
    findById: jest.fn(async () => review()),
    findByUserId: jest.fn(async () => [review()]),
    findActiveByReportId: jest.fn(async () => null),
    countActiveByUserId: jest.fn(async () => 0),
    update: jest.fn(async (_id: number, data: Partial<ReviewRequestRecord>) => review(data)),
    listForAdmin: jest.fn(async () => []),
  } as unknown as { [K in keyof IReviewRequestRepo]: jest.Mock };
  const reportRepo = {
    findById: jest.fn(async () => report),
  } as unknown as { [K in keyof IReportRepo]: jest.Mock };
  const executionPlanRepo = {
    findByReportId: jest.fn(async () => null),
  } as unknown as { [K in keyof IExecutionPlanRepo]: jest.Mock };
  const service = createReviewRequestService(
    {
      reviewRepo: reviewRepo as unknown as IReviewRequestRepo,
      reportRepo: reportRepo as unknown as IReportRepo,
      executionPlanRepo: executionPlanRepo as unknown as IExecutionPlanRepo,
      findUserEmail: async () => "user@example.com",
    },
    () => NOW,
  );
  return { service, reviewRepo, reportRepo, executionPlanRepo };
};

const input = { reportId: 5, question: "  DC를 연금으로 받는 게 맞을까요?  ", consent: true as const };

describe("ReviewRequestService", () => {
  it("동의 시각을 기록하고 질문을 다듬어 저장한다", async () => {
    const { service, reviewRepo } = setup();
    const created = await service.create(1, input);
    expect(reviewRepo.create).toHaveBeenCalledWith({
      userId: 1,
      reportId: 5,
      question: "DC를 연금으로 받는 게 맞을까요?",
      consentAt: NOW,
    });
    expect("operatorNote" in created).toBe(false);
    expect("userId" in created).toBe(false);
  });

  it("다른 사용자의 리포트로는 요청할 수 없다", async () => {
    const { service, reportRepo, reviewRepo } = setup();
    reportRepo.findById.mockResolvedValueOnce({ ...report, userId: 2 });
    await expect(service.create(1, input)).rejects.toMatchObject({ code: "REPORT_FORBIDDEN", statusCode: 403 });
    expect(reviewRepo.create).not.toHaveBeenCalled();
  });

  it("같은 리포트에 진행 중인 요청이 있거나 동시 요청 한도를 넘으면 409", async () => {
    const dup = setup();
    dup.reviewRepo.findActiveByReportId.mockResolvedValueOnce(review());
    await expect(dup.service.create(1, input)).rejects.toMatchObject({ code: "REVIEW_ALREADY_REQUESTED" });
    const limit = setup();
    limit.reviewRepo.countActiveByUserId.mockResolvedValueOnce(MAX_ACTIVE_REVIEWS);
    await expect(limit.service.create(1, input)).rejects.toMatchObject({ code: "REVIEW_LIMIT" });
  });

  it("내 요청 목록에는 운영자 메모를 넣지 않는다", async () => {
    const list = await setup().service.listMine(1);
    expect(JSON.stringify(list)).not.toContain("내부 메모");
  });

  it("처리 전 요청만 취소할 수 있다", async () => {
    const { service, reviewRepo } = setup();
    await service.cancel(9, 1);
    expect(reviewRepo.update).toHaveBeenCalledWith(9, { status: "CANCELED" });
    reviewRepo.findById.mockResolvedValueOnce(review({ status: "ANSWERED" }));
    await expect(service.cancel(9, 1)).rejects.toMatchObject({ code: "REVIEW_NOT_CANCELABLE" });
    reviewRepo.findById.mockResolvedValueOnce(review({ userId: 2 }));
    await expect(service.cancel(9, 1)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("운영자 상세는 동의한 리포트 스냅샷과 체크리스트 진행률만 담는다", async () => {
    const { service, executionPlanRepo } = setup();
    executionPlanRepo.findByReportId.mockResolvedValueOnce({
      id: 1,
      userId: 1,
      reportId: 5,
      startDate: NOW,
      items: [
        { key: "a", label: "A", dueDay: 7, doneAt: NOW.toISOString() },
        { key: "b", label: "B", dueDay: 30, doneAt: null },
      ],
      createdAt: NOW,
      updatedAt: NOW,
    });
    const detail = await service.getForAdmin(9);
    expect(detail.request.userEmail).toBe("user@example.com");
    expect(detail.report.content.scenario.type).toBe("D");
    expect(detail.executionPlan?.progress).toEqual({ done: 1, total: 2, currentDay: 1 });
    expect("scenarioSetId" in detail.report).toBe(false);
  });

  it("답변만 넣으면 답변 완료로 바꾸고 답변 시각을 기록한다", async () => {
    const { service, reviewRepo } = setup();
    await service.updateForAdmin(9, { answer: "  연금 수령을 권합니다 " });
    expect(reviewRepo.update).toHaveBeenCalledWith(9, {
      status: "ANSWERED",
      answer: "연금 수령을 권합니다",
      answeredAt: NOW,
    });
    await service.updateForAdmin(9, { operatorNote: "전화 상담 예정" });
    expect(reviewRepo.update).toHaveBeenLastCalledWith(9, { operatorNote: "전화 상담 예정" });
  });

  it("사용자가 취소한 요청은 다른 상태로 되돌리지 않는다", async () => {
    const { service, reviewRepo } = setup();
    reviewRepo.findById.mockResolvedValueOnce(review({ status: "CANCELED" }));
    await expect(service.updateForAdmin(9, { status: "IN_REVIEW" })).rejects.toMatchObject({
      code: "REVIEW_CANCELED",
    });
  });
});
