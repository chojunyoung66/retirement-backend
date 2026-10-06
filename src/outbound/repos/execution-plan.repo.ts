import type { ExecutionPlan } from "@prisma/client";
import type {
  ExecutionItem,
  ExecutionPlanRecord,
  IExecutionPlanRepo,
} from "../../application/contracts/execution-plan-repo.contract.js";
import { prisma } from "./prisma-client.js";

const toRecord = (row: ExecutionPlan): ExecutionPlanRecord => ({
  id: row.id,
  userId: row.userId,
  reportId: row.reportId,
  startDate: row.startDate,
  items: row.items as unknown as ExecutionItem[],
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const createExecutionPlanRepo = (): IExecutionPlanRepo => ({
  async create(data) {
    const row = await prisma.executionPlan.create({
      data: { ...data, items: data.items as unknown as object },
    });
    return toRecord(row);
  },

  async findById(id) {
    const row = await prisma.executionPlan.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  },

  async findByReportId(reportId) {
    const row = await prisma.executionPlan.findUnique({ where: { reportId } });
    return row ? toRecord(row) : null;
  },

  async updateItems(id, items) {
    const row = await prisma.executionPlan.update({
      where: { id },
      data: { items: items as unknown as object },
    });
    return toRecord(row);
  },
});

export type ExecutionPlanRepoType = ReturnType<typeof createExecutionPlanRepo>;
