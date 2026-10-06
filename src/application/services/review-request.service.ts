import type {
  ExecutionItem,
  IExecutionPlanRepo,
} from "../contracts/execution-plan-repo.contract.js";
import type { IReportRepo } from "../contracts/report-repo.contract.js";
import {
  ACTIVE_REVIEW_STATUSES,
  type IReviewRequestRepo,
  type ReviewRequestAdminSummary,
  type ReviewRequestRecord,
  type ReviewStatus,
} from "../contracts/review-request-repo.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import { executionProgress, type ExecutionProgress } from "./execution-plan.service.js";
import type { ReportContent } from "./report/report-content.js";
import type { ScenarioType } from "./withdrawal/types.js";

/** 한 사용자가 동시에 진행할 수 있는 검토 요청 수 */
export const MAX_ACTIVE_REVIEWS = 3;

/** 사용자에게는 운영자 내부 메모를 보이지 않는다 */
export type ReviewRequestView = Omit<ReviewRequestRecord, "userId" | "operatorNote">;

export interface ReviewRequestAdminDetail {
  request: ReviewRequestRecord & { userEmail: string | null };
  /** 동의받은 리포트 스냅샷만 — 원본 계좌 데이터는 보이지 않는다 */
  report: {
    id: number;
    title: string | null;
    scenarioType: ScenarioType;
    ruleVersion: string;
    generatedAt: Date;
    content: ReportContent;
  };
  executionPlan: { startDate: Date; progress: ExecutionProgress; items: ExecutionItem[] } | null;
}

const toView = ({ userId: _userId, operatorNote: _note, ...rest }: ReviewRequestRecord): ReviewRequestView =>
  rest;

export const createReviewRequestService = (
  deps: {
    reviewRepo: IReviewRequestRepo;
    reportRepo: IReportRepo;
    executionPlanRepo: IExecutionPlanRepo;
    findUserEmail: (userId: number) => Promise<string | null>;
  },
  now: () => Date = () => new Date(),
) => {
  const { reviewRepo, reportRepo, executionPlanRepo, findUserEmail } = deps;

  const findRequest = async (id: number): Promise<ReviewRequestRecord> => {
    const request = await reviewRepo.findById(id);
    if (!request) {
      throw new BusinessException("REVIEW_NOT_FOUND", "검토 요청을 찾을 수 없습니다", 404);
    }
    return request;
  };

  return {
    async create(
      userId: number,
      input: { reportId: number; question: string; consent: true },
    ): Promise<ReviewRequestView> {
      if (input.consent !== true) {
        throw new BusinessException("REVIEW_CONSENT_REQUIRED", "리포트 열람 동의가 필요합니다", 400);
      }
      const report = await reportRepo.findById(input.reportId);
      if (!report) {
        throw new BusinessException("REPORT_NOT_FOUND", "리포트를 찾을 수 없습니다", 404);
      }
      if (report.userId !== userId) {
        throw new BusinessException("REPORT_FORBIDDEN", "접근 권한이 없습니다", 403);
      }
      if (await reviewRepo.findActiveByReportId(report.id)) {
        throw new BusinessException(
          "REVIEW_ALREADY_REQUESTED",
          "이 리포트는 이미 검토를 요청했습니다",
          409,
        );
      }
      if ((await reviewRepo.countActiveByUserId(userId)) >= MAX_ACTIVE_REVIEWS) {
        throw new BusinessException(
          "REVIEW_LIMIT",
          `검토 요청은 동시에 ${MAX_ACTIVE_REVIEWS}건까지 할 수 있습니다`,
          409,
        );
      }
      const created = await reviewRepo.create({
        userId,
        reportId: report.id,
        question: input.question.trim(),
        consentAt: now(),
      });
      return toView(created);
    },

    async listMine(userId: number): Promise<ReviewRequestView[]> {
      return (await reviewRepo.findByUserId(userId)).map(toView);
    },

    async cancel(id: number, userId: number): Promise<ReviewRequestView> {
      const request = await findRequest(id);
      if (request.userId !== userId) {
        throw new BusinessException("REVIEW_FORBIDDEN", "접근 권한이 없습니다", 403);
      }
      if (!ACTIVE_REVIEW_STATUSES.includes(request.status)) {
        throw new BusinessException("REVIEW_NOT_CANCELABLE", "이미 처리된 요청은 취소할 수 없습니다", 409);
      }
      return toView(await reviewRepo.update(id, { status: "CANCELED" }));
    },

    async listForAdmin(filter: { status?: ReviewStatus; limit: number }): Promise<ReviewRequestAdminSummary[]> {
      return reviewRepo.listForAdmin(filter);
    },

    async getForAdmin(id: number): Promise<ReviewRequestAdminDetail> {
      const request = await findRequest(id);
      const report = await reportRepo.findById(request.reportId);
      if (!report) {
        throw new BusinessException("REPORT_NOT_FOUND", "리포트를 찾을 수 없습니다", 404);
      }
      const plan = await executionPlanRepo.findByReportId(report.id);
      return {
        request: { ...request, userEmail: await findUserEmail(request.userId) },
        report: {
          id: report.id,
          title: report.title,
          scenarioType: report.scenarioType,
          ruleVersion: report.ruleVersion,
          generatedAt: report.generatedAt,
          content: report.content,
        },
        executionPlan: plan
          ? { startDate: plan.startDate, progress: executionProgress(plan, now()), items: plan.items }
          : null,
      };
    },

    /** 답변을 넣고 상태를 정하지 않으면 답변 완료로 바꾼다 */
    async updateForAdmin(
      id: number,
      input: { status?: ReviewStatus; answer?: string | null; operatorNote?: string | null },
    ): Promise<ReviewRequestRecord> {
      const request = await findRequest(id);
      if (request.status === "CANCELED" && input.status && input.status !== "CANCELED") {
        throw new BusinessException("REVIEW_CANCELED", "사용자가 취소한 요청입니다", 409);
      }
      const answer = input.answer === undefined ? undefined : input.answer?.trim() || null;
      const status = input.status ?? (answer ? "ANSWERED" : undefined);
      return reviewRepo.update(id, {
        ...(status ? { status } : {}),
        ...(answer !== undefined ? { answer, answeredAt: answer ? now() : null } : {}),
        ...(input.operatorNote !== undefined
          ? { operatorNote: input.operatorNote?.trim() || null }
          : {}),
      });
    },
  };
};

export type ReviewRequestServiceType = ReturnType<typeof createReviewRequestService>;
