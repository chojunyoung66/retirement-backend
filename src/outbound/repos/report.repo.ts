import type { ReportSnapshot } from "@prisma/client";
import type {
  IReportRepo,
  ReportSnapshotRecord,
  ReportSnapshotSummary,
} from "../../application/contracts/report-repo.contract.js";
import type { ReportContent } from "../../application/services/report/report-content.js";
import type { ScenarioType } from "../../application/services/withdrawal/types.js";
import { prisma } from "./prisma-client.js";

const summarySelect = {
  id: true,
  userId: true,
  scenarioSetId: true,
  scenarioType: true,
  ruleVersion: true,
  title: true,
  firstDownloadedAt: true,
  generatedAt: true,
  updatedAt: true,
} as const;

const toSummary = (
  row: Pick<ReportSnapshot, keyof typeof summarySelect>,
): ReportSnapshotSummary => ({
  id: row.id,
  userId: row.userId,
  scenarioSetId: row.scenarioSetId,
  scenarioType: row.scenarioType as ScenarioType,
  ruleVersion: row.ruleVersion,
  title: row.title,
  firstDownloadedAt: row.firstDownloadedAt,
  generatedAt: row.generatedAt,
  updatedAt: row.updatedAt,
});

export const toReportRecord = (row: ReportSnapshot): ReportSnapshotRecord => ({
  ...toSummary(row),
  content: row.content as unknown as ReportContent,
});

const latestFirst = [{ generatedAt: "desc" as const }, { id: "desc" as const }];

export const createReportRepo = (): IReportRepo => ({
  async create(userId, data) {
    const row = await prisma.reportSnapshot.create({
      data: {
        userId,
        scenarioSetId: data.scenarioSetId,
        scenarioType: data.scenarioType,
        ruleVersion: data.ruleVersion,
        content: data.content as object,
      },
    });
    return toReportRecord(row);
  },

  async findById(id) {
    const row = await prisma.reportSnapshot.findUnique({ where: { id } });
    return row ? toReportRecord(row) : null;
  },

  async findByUserId(userId) {
    const rows = await prisma.reportSnapshot.findMany({
      where: { userId },
      orderBy: latestFirst,
      select: summarySelect,
    });
    return rows.map(toSummary);
  },

  async countByUserId(userId) {
    return prisma.reportSnapshot.count({ where: { userId } });
  },

  async updateTitle(id, title) {
    const row = await prisma.reportSnapshot.update({
      where: { id },
      data: { title },
      select: summarySelect,
    });
    return toSummary(row);
  },

  async markDownloaded(id, at) {
    await prisma.reportSnapshot.updateMany({
      where: { id, firstDownloadedAt: null },
      data: { firstDownloadedAt: at },
    });
  },

  async delete(id) {
    await prisma.reportSnapshot.delete({ where: { id } });
  },
});

export type ReportRepoType = ReturnType<typeof createReportRepo>;
