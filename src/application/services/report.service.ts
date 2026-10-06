import type {
  IReportRepo,
  ReportSnapshotRecord,
  ReportSnapshotSummary,
} from "../contracts/report-repo.contract.js";
import type { IPaymentRepo } from "../contracts/payment-repo.contract.js";
import type {
  IWithdrawalScenarioRepo,
  WithdrawalScenarioSetRecord,
} from "../contracts/withdrawal-scenario-repo.contract.js";
import { RULE_SET_VERSION } from "../rules/rule-set.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import type { PaymentConfig } from "./payment-config.js";
import { buildReportContent, type ReportContent } from "./report/report-content.js";
import type { ScenarioType } from "./withdrawal/types.js";

/** 결제한 리포트가 사라지지 않도록 자동 삭제 대신 상한만 둔다 */
export const MAX_REPORTS = 50;
/** 이 기간이 지나면 다시 계산을 권한다 (PRD: 기준일 경과 시 재계산 안내) */
export const OUTDATED_AFTER_DAYS = 180;
export const MAX_TITLE_LENGTH = 40;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReportPdfRenderer = (content: ReportContent) => Promise<Buffer>;
export type ReportXlsxRenderer = (content: ReportContent) => Promise<Buffer>;

export type ReportSummaryView = Omit<ReportSnapshotSummary, "userId"> & { isOutdated: boolean };
export type ReportView = Omit<ReportSnapshotRecord, "userId"> & { isOutdated: boolean };

export interface CreateReportRequest {
  scenarioSetId: number;
  scenarioType: ScenarioType;
  orderId?: string;
}

export const isReportOutdated = (
  report: Pick<ReportSnapshotSummary, "ruleVersion" | "generatedAt">,
  now: Date,
): boolean =>
  report.ruleVersion !== RULE_SET_VERSION ||
  now.getTime() - report.generatedAt.getTime() > OUTDATED_AFTER_DAYS * DAY_MS;

export const createReportService = (
  deps: {
    reportRepo: IReportRepo;
    scenarioRepo: IWithdrawalScenarioRepo;
    paymentRepo: IPaymentRepo;
    renderPdf: ReportPdfRenderer;
    renderXlsx: ReportXlsxRenderer;
    paymentConfig: PaymentConfig;
  },
  now: () => Date = () => new Date(),
) => {
  const { reportRepo, scenarioRepo, paymentRepo, renderPdf, renderXlsx, paymentConfig } = deps;

  const toSummaryView = ({ userId: _userId, ...rest }: ReportSnapshotSummary): ReportSummaryView => ({
    ...rest,
    isOutdated: isReportOutdated(rest, now()),
  });
  const toView = ({ userId: _userId, ...rest }: ReportSnapshotRecord): ReportView => ({
    ...rest,
    isOutdated: isReportOutdated(rest, now()),
  });

  const findOwned = async (id: number, userId: number): Promise<ReportSnapshotRecord> => {
    const report = await reportRepo.findById(id);
    if (!report) {
      throw new BusinessException("REPORT_NOT_FOUND", "리포트를 찾을 수 없습니다", 404);
    }
    if (report.userId !== userId) {
      throw new BusinessException("REPORT_FORBIDDEN", "접근 권한이 없습니다", 403);
    }
    return report;
  };

  /** 세트 소유·시나리오 존재·보관 한도를 확인하고 본문을 만든다 */
  const prepare = async (
    userId: number,
    request: { scenarioSetId: number; scenarioType: ScenarioType },
    options: { checkLimit: boolean },
  ): Promise<{ set: WithdrawalScenarioSetRecord; content: ReportContent }> => {
    const set = await scenarioRepo.findById(request.scenarioSetId);
    if (!set) {
      throw new BusinessException(
        "SCENARIO_SET_NOT_FOUND",
        "인출 시나리오를 찾을 수 없습니다",
        404,
      );
    }
    if (set.userId !== userId) {
      throw new BusinessException("SCENARIO_SET_FORBIDDEN", "접근 권한이 없습니다", 403);
    }
    const content = buildReportContent(set.result, request.scenarioType, now());
    if (!content) {
      throw new BusinessException(
        "SCENARIO_NOT_FOUND",
        "해당 시나리오를 찾을 수 없습니다",
        404,
      );
    }
    if (options.checkLimit && (await reportRepo.countByUserId(userId)) >= MAX_REPORTS) {
      throw new BusinessException(
        "REPORT_LIMIT",
        `리포트는 최대 ${MAX_REPORTS}개까지 보관할 수 있습니다. 필요 없는 리포트를 지운 뒤 다시 시도해주세요`,
        409,
      );
    }
    return { set, content };
  };

  const createFromOrder = async (
    userId: number,
    request: CreateReportRequest,
  ): Promise<ReportSnapshotRecord> => {
    if (!request.orderId) {
      throw new BusinessException("PAYMENT_REQUIRED", "리포트를 만들려면 결제가 필요합니다", 402);
    }
    const order = await paymentRepo.findByOrderId(request.orderId);
    if (!order) {
      throw new BusinessException("PAYMENT_NOT_FOUND", "주문을 찾을 수 없습니다", 404);
    }
    if (order.userId !== userId) {
      throw new BusinessException("PAYMENT_FORBIDDEN", "접근 권한이 없습니다", 403);
    }
    if (order.scenarioSetId !== request.scenarioSetId || order.scenarioType !== request.scenarioType) {
      throw new BusinessException(
        "PAYMENT_ORDER_MISMATCH",
        "주문한 시나리오와 요청한 시나리오가 다릅니다",
        400,
      );
    }
    if (order.status !== "PAID" || order.consumedAt) {
      throw new BusinessException(
        "PAYMENT_REQUIRED",
        "결제가 완료되지 않았거나 이미 리포트를 만든 주문입니다",
        402,
      );
    }
    // 결제를 마친 주문은 보관 한도 때문에 막지 않는다
    const { set, content } = await prepare(userId, request, { checkLimit: false });
    const saved = await paymentRepo.consumeWithReport(order.orderId, {
      userId,
      scenarioSetId: set.id,
      scenarioType: request.scenarioType,
      ruleVersion: set.ruleVersion,
      content,
    });
    if (!saved) {
      throw new BusinessException(
        "PAYMENT_REQUIRED",
        "결제가 완료되지 않았거나 이미 리포트를 만든 주문입니다",
        402,
      );
    }
    return saved;
  };

  return {
    /** 결제 전 확인 — 결제 후에 만들 수 없는 요청을 미리 막는다 */
    async assertCreatable(
      userId: number,
      request: { scenarioSetId: number; scenarioType: ScenarioType },
    ): Promise<void> {
      await prepare(userId, request, { checkLimit: true });
    },

    async create(userId: number, request: CreateReportRequest): Promise<ReportView> {
      if (paymentConfig.enabled) {
        return toView(await createFromOrder(userId, request));
      }
      const { set, content } = await prepare(userId, request, { checkLimit: true });
      const saved = await reportRepo.create(userId, {
        scenarioSetId: set.id,
        scenarioType: request.scenarioType,
        ruleVersion: set.ruleVersion,
        content,
      });
      return toView(saved);
    },

    async list(userId: number): Promise<ReportSummaryView[]> {
      return (await reportRepo.findByUserId(userId)).map(toSummaryView);
    },

    async get(id: number, userId: number): Promise<ReportView> {
      return toView(await findOwned(id, userId));
    },

    async rename(id: number, userId: number, title: string | null): Promise<ReportSummaryView> {
      await findOwned(id, userId);
      const trimmed = title?.trim() ?? "";
      return toSummaryView(await reportRepo.updateTitle(id, trimmed.length > 0 ? trimmed : null));
    },

    async delete(id: number, userId: number): Promise<void> {
      await findOwned(id, userId);
      await reportRepo.delete(id);
    },

    async renderPdf(id: number, userId: number): Promise<Buffer> {
      const report = await findOwned(id, userId);
      const pdf = await renderPdf(report.content);
      await reportRepo.markDownloaded(id, now());
      return pdf;
    },

    async renderXlsx(id: number, userId: number): Promise<Buffer> {
      const report = await findOwned(id, userId);
      const xlsx = await renderXlsx(report.content);
      await reportRepo.markDownloaded(id, now());
      return xlsx;
    },
  };
};

export type ReportServiceType = ReturnType<typeof createReportService>;
