import type { ReportContent } from "../services/report/report-content.js";
import type { ScenarioType } from "../services/withdrawal/types.js";

export interface ReportSnapshotSummary {
  id: number;
  userId: number;
  scenarioSetId: number | null;
  scenarioType: ScenarioType;
  ruleVersion: string;
  title: string | null;
  firstDownloadedAt: Date | null;
  generatedAt: Date;
  updatedAt: Date;
}

export interface ReportSnapshotRecord extends ReportSnapshotSummary {
  content: ReportContent;
}

export interface IReportRepo {
  create(
    userId: number,
    data: {
      scenarioSetId: number;
      scenarioType: ScenarioType;
      ruleVersion: string;
      content: ReportContent;
    },
  ): Promise<ReportSnapshotRecord>;
  findById(id: number): Promise<ReportSnapshotRecord | null>;
  /** 목록은 본문 없이 최신순 */
  findByUserId(userId: number): Promise<ReportSnapshotSummary[]>;
  countByUserId(userId: number): Promise<number>;
  updateTitle(id: number, title: string | null): Promise<ReportSnapshotSummary>;
  /** 처음 받은 시각만 기록한다 */
  markDownloaded(id: number, at: Date): Promise<void>;
  delete(id: number): Promise<void>;
}
