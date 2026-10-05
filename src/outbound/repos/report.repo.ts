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
  generatedAt: true,
} as const;

const toSummary = (
  row: Pick<ReportSnapshot, keyof typeof summarySelect>,
): ReportSnapshotSummary => ({
  id: row.id,
  userId: row.userId,
  scenarioSetId: row.scenarioSetId,
  scenarioType: row.scenarioType as ScenarioType,
  ruleVersion: row.ruleVersion,
  generatedAt: row.generatedAt,
});

const toRecord = (row: ReportSnapshot): ReportSnapshotRecord => ({
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
    return toRecord(row);
  },

  async findById(id) {
    const row = await prisma.reportSnapshot.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  },

  async findByUserId(userId) {
    const rows = await prisma.reportSnapshot.findMany({
      where: { userId },
      orderBy: latestFirst,
      select: summarySelect,
    });
    return rows.map(toSummary);
  },

  async delete(id) {
    await prisma.reportSnapshot.delete({ where: { id } });
  },

  async pruneByUserId(userId, keep) {
    const stale = await prisma.reportSnapshot.findMany({
      where: { userId },
      orderBy: latestFirst,
      skip: keep,
      select: { id: true },
    });
    if (stale.length === 0) return;
    await prisma.reportSnapshot.deleteMany({
      where: { id: { in: stale.map((s) => s.id) } },
    });
  },
});

export type ReportRepoType = ReturnType<typeof createReportRepo>;
