import type { ReportContent } from "../services/report/report-content.js";
import type { ScenarioType } from "../services/withdrawal/types.js";

export interface ReportSnapshotSummary {
  id: number;
  userId: number;
  scenarioSetId: number | null;
  scenarioType: ScenarioType;
  ruleVersion: string;
  generatedAt: Date;
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
  delete(id: number): Promise<void>;
  /** 최신 keep건만 남긴다 */
  pruneByUserId(userId: number, keep: number): Promise<void>;
}
