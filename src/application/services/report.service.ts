import type {
  IReportRepo,
  ReportSnapshotRecord,
  ReportSnapshotSummary,
} from "../contracts/report-repo.contract.js";
import type { IWithdrawalScenarioRepo } from "../contracts/withdrawal-scenario-repo.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import { buildReportContent, type ReportContent } from "./report/report-content.js";
import type { ScenarioType } from "./withdrawal/types.js";

export const MAX_REPORTS = 10;

export type ReportPdfRenderer = (content: ReportContent) => Promise<Buffer>;

export type ReportSummaryView = Omit<ReportSnapshotSummary, "userId">;
export type ReportView = Omit<ReportSnapshotRecord, "userId">;

const toSummaryView = ({ userId: _userId, ...rest }: ReportSnapshotSummary): ReportSummaryView =>
  rest;
const toView = ({ userId: _userId, ...rest }: ReportSnapshotRecord): ReportView => rest;

export const createReportService = (
  deps: {
    reportRepo: IReportRepo;
    scenarioRepo: IWithdrawalScenarioRepo;
    renderPdf: ReportPdfRenderer;
  },
  now: () => Date = () => new Date(),
) => {
  const { reportRepo, scenarioRepo, renderPdf } = deps;

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

  return {
    async create(
      userId: number,
      request: { scenarioSetId: number; scenarioType: ScenarioType },
    ): Promise<ReportView> {
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
      const saved = await reportRepo.create(userId, {
        scenarioSetId: set.id,
        scenarioType: request.scenarioType,
        ruleVersion: set.ruleVersion,
        content,
      });
      await reportRepo.pruneByUserId(userId, MAX_REPORTS);
      return toView(saved);
    },

    async list(userId: number): Promise<ReportSummaryView[]> {
      return (await reportRepo.findByUserId(userId)).map(toSummaryView);
    },

    async get(id: number, userId: number): Promise<ReportView> {
      return toView(await findOwned(id, userId));
    },

    async delete(id: number, userId: number): Promise<void> {
      await findOwned(id, userId);
      await reportRepo.delete(id);
    },

    async renderPdf(id: number, userId: number): Promise<Buffer> {
      const report = await findOwned(id, userId);
      return renderPdf(report.content);
    },
  };
};

export type ReportServiceType = ReturnType<typeof createReportService>;
