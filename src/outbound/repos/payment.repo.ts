import type { Payment } from "@prisma/client";
import type {
  IPaymentRepo,
  PaymentRecord,
} from "../../application/contracts/payment-repo.contract.js";
import type { ScenarioType } from "../../application/services/withdrawal/types.js";
import { prisma } from "./prisma-client.js";
import { toReportRecord } from "./report.repo.js";

const toRecord = (row: Payment): PaymentRecord => ({
  id: row.id,
  orderId: row.orderId,
  userId: row.userId,
  product: row.product,
  amount: row.amount,
  status: row.status,
  scenarioSetId: row.scenarioSetId,
  scenarioType: row.scenarioType as ScenarioType,
  paymentKey: row.paymentKey,
  method: row.method,
  approvedAt: row.approvedAt,
  canceledAt: row.canceledAt,
  cancelReason: row.cancelReason,
  receiptUrl: row.receiptUrl,
  failureCode: row.failureCode,
  consumedAt: row.consumedAt,
  reportId: row.reportId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const createPaymentRepo = (): IPaymentRepo => ({
  async create(data) {
    const row = await prisma.payment.create({ data });
    return toRecord(row);
  },

  async findById(id) {
    const row = await prisma.payment.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  },

  async findByOrderId(orderId) {
    const row = await prisma.payment.findUnique({ where: { orderId } });
    return row ? toRecord(row) : null;
  },

  async markPaid(orderId, data) {
    const { count } = await prisma.payment.updateMany({
      where: { orderId, status: "READY" },
      data: { status: "PAID", failureCode: null, ...data },
    });
    if (count === 0) return null;
    const row = await prisma.payment.findUnique({ where: { orderId } });
    return row ? toRecord(row) : null;
  },

  async markFailed(orderId, failureCode) {
    await prisma.payment.updateMany({
      where: { orderId, status: "READY" },
      data: { status: "FAILED", failureCode: failureCode.slice(0, 100) },
    });
  },

  async markRefunded(id, data) {
    const { count } = await prisma.payment.updateMany({
      where: { id, status: "PAID" },
      data: { status: "REFUNDED", ...data },
    });
    if (count === 0) return null;
    const row = await prisma.payment.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  },

  async consumeWithReport(orderId, report) {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.payment.updateMany({
        where: { orderId, status: "PAID", consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (count === 0) return null;
      const row = await tx.reportSnapshot.create({
        data: {
          userId: report.userId,
          scenarioSetId: report.scenarioSetId,
          scenarioType: report.scenarioType,
          ruleVersion: report.ruleVersion,
          content: report.content as object,
        },
      });
      await tx.payment.update({ where: { orderId }, data: { reportId: row.id } });
      return toReportRecord(row);
    });
  },

  async listForAdmin({ status, limit }) {
    const rows = await prisma.payment.findMany({
      where: status ? { status } : {},
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      include: {
        user: { select: { email: true } },
        report: { select: { firstDownloadedAt: true } },
      },
    });
    return rows.map(({ user, report, ...row }) => ({
      ...toRecord(row),
      userEmail: user?.email ?? null,
      reportDownloadedAt: report?.firstDownloadedAt ?? null,
    }));
  },
});

export type PaymentRepoType = ReturnType<typeof createPaymentRepo>;
