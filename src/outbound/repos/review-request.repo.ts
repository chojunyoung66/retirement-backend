import type { ReviewRequest } from "@prisma/client";
import {
  ACTIVE_REVIEW_STATUSES,
  type IReviewRequestRepo,
  type ReviewRequestRecord,
} from "../../application/contracts/review-request-repo.contract.js";
import type { ScenarioType } from "../../application/services/withdrawal/types.js";
import { prisma } from "./prisma-client.js";

const toRecord = (row: ReviewRequest): ReviewRequestRecord => ({
  id: row.id,
  userId: row.userId,
  reportId: row.reportId,
  question: row.question,
  consentAt: row.consentAt,
  status: row.status,
  answer: row.answer,
  answeredAt: row.answeredAt,
  operatorNote: row.operatorNote,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const latestFirst = [{ createdAt: "desc" as const }, { id: "desc" as const }];

export const createReviewRequestRepo = (): IReviewRequestRepo => ({
  async create(data) {
    return toRecord(await prisma.reviewRequest.create({ data }));
  },

  async findById(id) {
    const row = await prisma.reviewRequest.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  },

  async findByUserId(userId) {
    const rows = await prisma.reviewRequest.findMany({ where: { userId }, orderBy: latestFirst });
    return rows.map(toRecord);
  },

  async findActiveByReportId(reportId) {
    const row = await prisma.reviewRequest.findFirst({
      where: { reportId, status: { in: [...ACTIVE_REVIEW_STATUSES] } },
      orderBy: latestFirst,
    });
    return row ? toRecord(row) : null;
  },

  async countActiveByUserId(userId) {
    return prisma.reviewRequest.count({
      where: { userId, status: { in: [...ACTIVE_REVIEW_STATUSES] } },
    });
  },

  async update(id, data) {
    return toRecord(await prisma.reviewRequest.update({ where: { id }, data }));
  },

  async listForAdmin({ status, limit }) {
    const rows = await prisma.reviewRequest.findMany({
      where: status ? { status } : {},
      orderBy: latestFirst,
      take: limit,
      include: {
        user: { select: { email: true } },
        report: { select: { title: true, scenarioType: true, generatedAt: true } },
      },
    });
    return rows.map(({ user, report, ...row }) => ({
      ...toRecord(row),
      userEmail: user.email,
      reportTitle: report.title,
      scenarioType: report.scenarioType as ScenarioType,
      reportGeneratedAt: report.generatedAt,
    }));
  },
});

export type ReviewRequestRepoType = ReturnType<typeof createReviewRequestRepo>;
