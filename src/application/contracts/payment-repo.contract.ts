import type { ReportSnapshotRecord } from "./report-repo.contract.js";
import type { ReportContent } from "../services/report/report-content.js";
import type { ScenarioType } from "../services/withdrawal/types.js";

export type PaymentStatus = "READY" | "PAID" | "FAILED" | "CANCELED" | "REFUNDED";
export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "READY",
  "PAID",
  "FAILED",
  "CANCELED",
  "REFUNDED",
];

export interface PaymentRecord {
  id: number;
  orderId: string;
  userId: number | null;
  product: string;
  amount: number;
  status: PaymentStatus;
  scenarioSetId: number | null;
  scenarioType: ScenarioType;
  paymentKey: string | null;
  method: string | null;
  approvedAt: Date | null;
  canceledAt: Date | null;
  cancelReason: string | null;
  receiptUrl: string | null;
  failureCode: string | null;
  consumedAt: Date | null;
  reportId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 운영자 목록용 — 사용자 식별은 이메일까지만 */
export interface PaymentAdminRecord extends PaymentRecord {
  userEmail: string | null;
  reportDownloadedAt: Date | null;
}

export interface IPaymentRepo {
  create(data: {
    orderId: string;
    userId: number;
    amount: number;
    scenarioSetId: number;
    scenarioType: ScenarioType;
  }): Promise<PaymentRecord>;
  findById(id: number): Promise<PaymentRecord | null>;
  findByOrderId(orderId: string): Promise<PaymentRecord | null>;
  /** READY 주문만 PAID로 바꾼다 — 바뀌지 않았으면 null */
  markPaid(
    orderId: string,
    data: { paymentKey: string; method: string | null; approvedAt: Date | null; receiptUrl: string | null },
  ): Promise<PaymentRecord | null>;
  /** READY 주문만 FAILED로 바꾼다 */
  markFailed(orderId: string, failureCode: string): Promise<void>;
  /** PAID 주문만 REFUNDED로 바꾼다 */
  markRefunded(id: number, data: { canceledAt: Date; cancelReason: string }): Promise<PaymentRecord | null>;
  /**
   * 결제 완료·미사용 주문을 사용 처리하고 리포트를 만든다 (한 트랜잭션).
   * 이미 사용했거나 결제 완료가 아니면 null
   */
  consumeWithReport(
    orderId: string,
    report: {
      userId: number;
      scenarioSetId: number;
      scenarioType: ScenarioType;
      ruleVersion: string;
      content: ReportContent;
    },
  ): Promise<ReportSnapshotRecord | null>;
  listForAdmin(filter: { status?: PaymentStatus; limit: number }): Promise<PaymentAdminRecord[]>;
}
