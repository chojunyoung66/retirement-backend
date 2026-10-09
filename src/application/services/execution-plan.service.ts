import type {
  ExecutionPlanRecord,
  IExecutionPlanRepo,
} from "../contracts/execution-plan-repo.contract.js";
import type { IReportRepo } from "../contracts/report-repo.contract.js";
import { buildExecutionChecklist, EXECUTION_PLAN_DAYS } from "../rules/execution-checklist.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ExecutionProgress {
  done: number;
  total: number;
  /** 시작일을 1일째로 센 오늘 (1~100) */
  currentDay: number;
}

export type ExecutionPlanView = Omit<ExecutionPlanRecord, "userId"> & {
  progress: ExecutionProgress;
};

export const executionProgress = (plan: ExecutionPlanRecord, now: Date): ExecutionProgress => ({
  done: plan.items.filter((item) => item.doneAt !== null).length,
  total: plan.items.length,
  currentDay: Math.min(
    EXECUTION_PLAN_DAYS,
    Math.max(1, Math.floor((now.getTime() - plan.startDate.getTime()) / DAY_MS) + 1),
  ),
});

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";

export const createExecutionPlanService = (
  deps: { executionPlanRepo: IExecutionPlanRepo; reportRepo: IReportRepo },
  now: () => Date = () => new Date(),
) => {
  const { executionPlanRepo, reportRepo } = deps;

  const toView = (plan: ExecutionPlanRecord): ExecutionPlanView => {
    const { userId: _userId, ...rest } = plan;
    return { ...rest, progress: executionProgress(plan, now()) };
  };

  const findOwnedReport = async (reportId: number, userId: number) => {
    const report = await reportRepo.findById(reportId);
    if (!report) {
      throw new BusinessException("REPORT_NOT_FOUND", "리포트를 찾을 수 없습니다", 404);
    }
    if (report.userId !== userId) {
      throw new BusinessException("REPORT_FORBIDDEN", "접근 권한이 없습니다", 403);
    }
    return report;
  };

  return {
    /** 리포트당 하나 — 이미 시작했으면 기존 계획을 돌려준다 */
    async start(userId: number, reportId: number): Promise<{ plan: ExecutionPlanView; created: boolean }> {
      const report = await findOwnedReport(reportId, userId);
      const existing = await executionPlanRepo.findByReportId(reportId);
      if (existing) return { plan: toView(existing), created: false };

      const startDate = now();
      const items = buildExecutionChecklist(report.content, startDate).map((item) => ({
        ...item,
        doneAt: null,
      }));
      try {
        const plan = await executionPlanRepo.create({ userId, reportId, startDate, items });
        return { plan: toView(plan), created: true };
      } catch (error) {
        // 동시에 두 번 시작한 경우
        if (!isUniqueViolation(error)) throw error;
        const raced = await executionPlanRepo.findByReportId(reportId);
        if (!raced) throw error;
        return { plan: toView(raced), created: false };
      }
    },

    /** 아직 시작하지 않았으면 null — 리포트 화면이 매번 조회하므로 404로 응답하지 않는다 */
    async getByReport(userId: number, reportId: number): Promise<ExecutionPlanView | null> {
      await findOwnedReport(reportId, userId);
      const plan = await executionPlanRepo.findByReportId(reportId);
      return plan ? toView(plan) : null;
    },

    async setItemDone(
      userId: number,
      planId: number,
      key: string,
      done: boolean,
    ): Promise<ExecutionPlanView> {
      const plan = await executionPlanRepo.findById(planId);
      if (!plan) {
        throw new BusinessException("EXECUTION_PLAN_NOT_FOUND", "실행 계획을 찾을 수 없습니다", 404);
      }
      if (plan.userId !== userId) {
        throw new BusinessException("EXECUTION_PLAN_FORBIDDEN", "접근 권한이 없습니다", 403);
      }
      if (!plan.items.some((item) => item.key === key)) {
        throw new BusinessException("EXECUTION_ITEM_NOT_FOUND", "체크리스트 항목을 찾을 수 없습니다", 404);
      }
      const at = now().toISOString();
      const items = plan.items.map((item) =>
        item.key === key ? { ...item, doneAt: done ? (item.doneAt ?? at) : null } : item,
      );
      return toView(await executionPlanRepo.updateItems(plan.id, items));
    },
  };
};

export type ExecutionPlanServiceType = ReturnType<typeof createExecutionPlanService>;
