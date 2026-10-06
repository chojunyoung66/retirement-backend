import { randomUUID } from "node:crypto";
import {
  PaymentGatewayError,
  type IPaymentGateway,
  type PaymentApproval,
} from "../contracts/payment-gateway.contract.js";
import type {
  IPaymentRepo,
  PaymentAdminRecord,
  PaymentRecord,
  PaymentStatus,
} from "../contracts/payment-repo.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import { TechnicalException } from "../../shared/exceptions/technical.exception.js";
import type { PaymentConfig } from "./payment-config.js";
import type { ReportServiceType } from "./report.service.js";
import type { ScenarioType } from "./withdrawal/types.js";

export const REPORT_ORDER_NAME = "은퇴현금 실행계획 리포트";
/** 토스가 이미 승인한 결제를 다시 승인하려 할 때 돌려주는 코드 */
const ALREADY_PROCESSED = "ALREADY_PROCESSED_PAYMENT";

export interface ReportOrderView {
  orderId: string;
  amount: number;
  orderName: string;
}

export interface ConfirmResult {
  orderId: string;
  status: PaymentStatus;
  scenarioType: ScenarioType;
  /** 결제사가 알려 준 결제수단 이름 (카드·간편결제 등) */
  method: string | null;
  /** 리포트를 지운 뒤 다시 승인을 호출하면 null */
  reportId: number | null;
}

export type PaymentAdminView = Omit<PaymentAdminRecord, "paymentKey">;

const toAdminView = ({ paymentKey: _paymentKey, ...rest }: PaymentAdminRecord): PaymentAdminView =>
  rest;

/** 토스 orderId 규칙: 영문·숫자·-·_ 6~64자 */
const newOrderId = (): string => `rpt_${randomUUID().replace(/-/g, "")}`;

export const createPaymentService = (
  deps: {
    paymentRepo: IPaymentRepo;
    gateway: IPaymentGateway;
    reportService: Pick<ReportServiceType, "assertCreatable" | "create">;
    config: PaymentConfig;
  },
) => {
  const { paymentRepo, gateway, reportService, config } = deps;

  const findOwnedOrder = async (orderId: string, userId: number): Promise<PaymentRecord> => {
    const order = await paymentRepo.findByOrderId(orderId);
    if (!order) {
      throw new BusinessException("PAYMENT_NOT_FOUND", "주문을 찾을 수 없습니다", 404);
    }
    if (order.userId !== userId) {
      throw new BusinessException("PAYMENT_FORBIDDEN", "접근 권한이 없습니다", 403);
    }
    return order;
  };

  /** 승인 결과가 주문과 같은지 — 다르면 위·변조로 보고 취소한다 */
  const assertApprovalMatches = async (order: PaymentRecord, approval: PaymentApproval) => {
    if (
      approval.status === "DONE" &&
      approval.orderId === order.orderId &&
      approval.totalAmount === order.amount
    ) {
      return;
    }
    if (approval.status === "DONE") {
      await gateway.cancel(approval.paymentKey, "주문 정보 불일치").catch(() => undefined);
    }
    await paymentRepo.markFailed(order.orderId, "APPROVAL_MISMATCH");
    throw new TechnicalException(
      "PAYMENT_APPROVAL_MISMATCH",
      "결제 정보가 주문과 달라 승인하지 않았습니다",
      502,
    );
  };

  const approve = async (order: PaymentRecord, paymentKey: string): Promise<PaymentApproval> => {
    try {
      return await gateway.confirm({ paymentKey, orderId: order.orderId, amount: order.amount });
    } catch (error) {
      if (!(error instanceof PaymentGatewayError)) throw error;
      // 네트워크 재시도 등으로 이미 승인된 결제는 조회해서 이어간다
      if (error.code === ALREADY_PROCESSED) return gateway.getPayment(paymentKey);
      await paymentRepo.markFailed(order.orderId, error.code);
      throw new BusinessException("PAYMENT_REJECTED", error.message, 400);
    }
  };

  /** 결제 완료 주문으로 리포트를 만든다 — 이미 만들었으면 그 리포트를 돌려준다 */
  const fulfill = async (order: PaymentRecord, userId: number): Promise<ConfirmResult> => {
    const base = { orderId: order.orderId, scenarioType: order.scenarioType, method: order.method };
    if (order.consumedAt) {
      return { ...base, status: order.status, reportId: order.reportId };
    }
    if (order.scenarioSetId === null) {
      throw new BusinessException(
        "SCENARIO_SET_NOT_FOUND",
        "인출 시나리오를 찾을 수 없습니다",
        404,
      );
    }
    const report = await reportService.create(userId, {
      scenarioSetId: order.scenarioSetId,
      scenarioType: order.scenarioType,
      orderId: order.orderId,
    });
    return { ...base, status: "PAID", reportId: report.id };
  };

  return {
    getConfig(): PaymentConfig {
      return { ...config };
    },

    async createReportOrder(
      userId: number,
      request: { scenarioSetId: number; scenarioType: ScenarioType },
    ): Promise<ReportOrderView> {
      if (!config.enabled) {
        throw new BusinessException(
          "PAYMENT_DISABLED",
          "지금은 결제 없이 리포트를 만들 수 있습니다",
          400,
        );
      }
      await reportService.assertCreatable(userId, request);
      const order = await paymentRepo.create({
        orderId: newOrderId(),
        userId,
        amount: config.price,
        scenarioSetId: request.scenarioSetId,
        scenarioType: request.scenarioType,
      });
      return { orderId: order.orderId, amount: order.amount, orderName: REPORT_ORDER_NAME };
    },

    async confirm(
      userId: number,
      request: { paymentKey: string; orderId: string; amount: number },
    ): Promise<ConfirmResult> {
      const order = await findOwnedOrder(request.orderId, userId);
      if (request.amount !== order.amount) {
        await paymentRepo.markFailed(order.orderId, "AMOUNT_MISMATCH");
        throw new BusinessException(
          "PAYMENT_AMOUNT_MISMATCH",
          "결제 금액이 주문 금액과 다릅니다",
          400,
        );
      }
      if (order.status === "PAID") {
        if (order.paymentKey !== request.paymentKey) {
          throw new BusinessException("PAYMENT_CONFLICT", "이미 다른 결제로 처리된 주문입니다", 409);
        }
        return fulfill(order, userId);
      }
      if (order.status !== "READY") {
        throw new BusinessException("PAYMENT_NOT_PAYABLE", "이미 처리된 주문입니다", 409);
      }

      const approval = await approve(order, request.paymentKey);
      await assertApprovalMatches(order, approval);
      const paid =
        (await paymentRepo.markPaid(order.orderId, {
          paymentKey: approval.paymentKey,
          method: approval.method,
          approvedAt: approval.approvedAt,
          receiptUrl: approval.receiptUrl,
        })) ?? (await paymentRepo.findByOrderId(order.orderId));
      if (!paid || paid.status !== "PAID") {
        throw new BusinessException("PAYMENT_NOT_PAYABLE", "이미 처리된 주문입니다", 409);
      }
      return fulfill(paid, userId);
    },

    /** 결제창에서 실패·취소하고 돌아온 주문을 닫는다 */
    async fail(userId: number, request: { orderId: string; code: string }): Promise<void> {
      const order = await findOwnedOrder(request.orderId, userId);
      if (order.status === "READY") {
        await paymentRepo.markFailed(order.orderId, request.code);
      }
    },

    async listForAdmin(filter: { status?: PaymentStatus; limit: number }): Promise<PaymentAdminView[]> {
      return (await paymentRepo.listForAdmin(filter)).map(toAdminView);
    },

    async refund(paymentId: number, reason: string): Promise<PaymentAdminView> {
      const payment = await paymentRepo.findById(paymentId);
      if (!payment) {
        throw new BusinessException("PAYMENT_NOT_FOUND", "결제를 찾을 수 없습니다", 404);
      }
      if (payment.status !== "PAID" || !payment.paymentKey) {
        throw new BusinessException("PAYMENT_NOT_REFUNDABLE", "환불할 수 있는 결제가 아닙니다", 409);
      }
      let canceledAt: Date;
      try {
        ({ canceledAt } = await gateway.cancel(payment.paymentKey, reason));
      } catch (error) {
        if (!(error instanceof PaymentGatewayError)) throw error;
        throw new BusinessException("PAYMENT_REFUND_REJECTED", error.message, 400);
      }
      const refunded = await paymentRepo.markRefunded(payment.id, { canceledAt, cancelReason: reason });
      if (!refunded) {
        throw new BusinessException("PAYMENT_NOT_REFUNDABLE", "환불할 수 있는 결제가 아닙니다", 409);
      }
      return toAdminView({ ...refunded, userEmail: null, reportDownloadedAt: null });
    },
  };
};

export type PaymentServiceType = ReturnType<typeof createPaymentService>;
