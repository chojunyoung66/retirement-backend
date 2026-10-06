import { createPaymentService, REPORT_ORDER_NAME } from "./payment.service.js";
import {
  PaymentGatewayError,
  type IPaymentGateway,
  type PaymentApproval,
} from "../contracts/payment-gateway.contract.js";
import type { IPaymentRepo, PaymentRecord } from "../contracts/payment-repo.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

const NOW = new Date("2026-10-06T01:00:00.000Z");

const order = (overrides: Partial<PaymentRecord> = {}): PaymentRecord => ({
  id: 1,
  orderId: "rpt_order0001",
  userId: 1,
  product: "REPORT",
  amount: 9900,
  status: "READY",
  scenarioSetId: 7,
  scenarioType: "D",
  paymentKey: null,
  method: null,
  approvedAt: null,
  canceledAt: null,
  cancelReason: null,
  receiptUrl: null,
  failureCode: null,
  consumedAt: null,
  reportId: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const approval = (overrides: Partial<PaymentApproval> = {}): PaymentApproval => ({
  paymentKey: "pk_1",
  orderId: "rpt_order0001",
  status: "DONE",
  totalAmount: 9900,
  method: "카드",
  approvedAt: NOW,
  receiptUrl: "https://receipt.example/1",
  ...overrides,
});

const setup = (options: { enabled?: boolean; stored?: PaymentRecord | null } = {}) => {
  let stored: PaymentRecord | null = options.stored === undefined ? order() : options.stored;
  const paymentRepo = {
    create: jest.fn(async (data: Partial<PaymentRecord>) => {
      stored = order(data);
      return stored;
    }),
    findById: jest.fn(async () => stored),
    findByOrderId: jest.fn(async () => stored),
    markPaid: jest.fn(async (_orderId: string, data: Partial<PaymentRecord>) => {
      if (!stored || stored.status !== "READY") return null;
      stored = { ...stored, ...data, status: "PAID" };
      return stored;
    }),
    markFailed: jest.fn(async (_orderId: string, failureCode: string) => {
      if (stored?.status === "READY") stored = { ...stored, status: "FAILED", failureCode };
    }),
    markRefunded: jest.fn(async (_id: number, data: Partial<PaymentRecord>) => {
      if (stored?.status !== "PAID") return null;
      stored = { ...stored, ...data, status: "REFUNDED" };
      return stored;
    }),
    listForAdmin: jest.fn(async () => [{ ...stored!, userEmail: "a@example.com", reportDownloadedAt: null }]),
  } as unknown as { [K in keyof IPaymentRepo]: jest.Mock };
  const gateway = {
    confirm: jest.fn(async () => approval()),
    getPayment: jest.fn(async () => approval()),
    cancel: jest.fn(async () => ({ canceledAt: NOW })),
  } as unknown as { [K in keyof IPaymentGateway]: jest.Mock };
  const reportService = {
    assertCreatable: jest.fn(async () => undefined),
    create: jest.fn(async () => {
      stored = { ...stored!, consumedAt: NOW, reportId: 42 };
      return { id: 42 };
    }),
  };
  const service = createPaymentService({
    paymentRepo: paymentRepo as unknown as IPaymentRepo,
    gateway: gateway as unknown as IPaymentGateway,
    reportService: reportService as never,
    config: { enabled: options.enabled ?? true, price: 9900 },
  });
  return { service, paymentRepo, gateway, reportService, current: () => stored };
};

const confirmBody = { paymentKey: "pk_1", orderId: "rpt_order0001", amount: 9900 };

describe("PaymentService", () => {
  describe("createReportOrder", () => {
    it("금액은 서버 설정값으로 정하고 생성 가능 여부를 먼저 확인한다", async () => {
      const { service, paymentRepo, reportService } = setup({ stored: null });
      const created = await service.createReportOrder(1, { scenarioSetId: 7, scenarioType: "D" });
      expect(reportService.assertCreatable).toHaveBeenCalledWith(1, { scenarioSetId: 7, scenarioType: "D" });
      expect(created.amount).toBe(9900);
      expect(created.orderName).toBe(REPORT_ORDER_NAME);
      expect(created.orderId).toMatch(/^rpt_[a-f0-9]{32}$/);
      expect(paymentRepo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, amount: 9900 }));
    });

    it("결제가 꺼져 있으면 PAYMENT_DISABLED", async () => {
      const { service, paymentRepo } = setup({ enabled: false });
      await expect(
        service.createReportOrder(1, { scenarioSetId: 7, scenarioType: "D" }),
      ).rejects.toMatchObject({ code: "PAYMENT_DISABLED" });
      expect(paymentRepo.create).not.toHaveBeenCalled();
    });

    it("생성할 수 없는 요청이면 주문을 만들지 않는다", async () => {
      const { service, paymentRepo, reportService } = setup();
      reportService.assertCreatable.mockRejectedValueOnce(
        new BusinessException("REPORT_LIMIT", "한도", 409),
      );
      await expect(
        service.createReportOrder(1, { scenarioSetId: 7, scenarioType: "D" }),
      ).rejects.toMatchObject({ code: "REPORT_LIMIT" });
      expect(paymentRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("confirm", () => {
    it("승인 후 PAID로 저장하고 리포트를 만든다", async () => {
      const { service, gateway, reportService, current } = setup();
      const result = await service.confirm(1, confirmBody);
      expect(gateway.confirm).toHaveBeenCalledWith({ paymentKey: "pk_1", orderId: "rpt_order0001", amount: 9900 });
      expect(reportService.create).toHaveBeenCalledWith(1, {
        scenarioSetId: 7,
        scenarioType: "D",
        orderId: "rpt_order0001",
      });
      expect(result).toEqual({
        orderId: "rpt_order0001",
        status: "PAID",
        scenarioType: "D",
        method: "카드",
        reportId: 42,
      });
      expect(current()?.paymentKey).toBe("pk_1");
      expect(current()?.receiptUrl).toBe("https://receipt.example/1");
    });

    it("요청 금액이 주문 금액과 다르면 결제사를 부르지 않고 실패 처리한다", async () => {
      const { service, gateway, current } = setup();
      await expect(service.confirm(1, { ...confirmBody, amount: 100 })).rejects.toMatchObject({
        code: "PAYMENT_AMOUNT_MISMATCH",
        statusCode: 400,
      });
      expect(gateway.confirm).not.toHaveBeenCalled();
      expect(current()?.status).toBe("FAILED");
    });

    it("다른 사용자의 주문은 403, 없는 주문은 404", async () => {
      await expect(setup({ stored: order({ userId: 2 }) }).service.confirm(1, confirmBody)).rejects.toMatchObject({
        code: "PAYMENT_FORBIDDEN",
        statusCode: 403,
      });
      await expect(setup({ stored: null }).service.confirm(1, confirmBody)).rejects.toMatchObject({
        code: "PAYMENT_NOT_FOUND",
        statusCode: 404,
      });
    });

    it("중복 승인 호출은 결제사를 다시 부르지 않고 같은 리포트를 돌려준다", async () => {
      const { service, gateway, reportService } = setup();
      const first = await service.confirm(1, confirmBody);
      const second = await service.confirm(1, confirmBody);
      expect(second).toEqual(first);
      expect(gateway.confirm).toHaveBeenCalledTimes(1);
      expect(reportService.create).toHaveBeenCalledTimes(1);
    });

    it("이미 PAID인 주문에 다른 결제 키로 승인하면 409", async () => {
      const { service } = setup({ stored: order({ status: "PAID", paymentKey: "pk_other" }) });
      await expect(service.confirm(1, confirmBody)).rejects.toMatchObject({ code: "PAYMENT_CONFLICT" });
    });

    it("리포트 생성이 실패해도 결제는 PAID로 남고, 다시 승인을 부르면 생성만 다시 한다", async () => {
      const { service, gateway, reportService, current } = setup();
      reportService.create.mockRejectedValueOnce(new Error("db down"));
      await expect(service.confirm(1, confirmBody)).rejects.toThrow("db down");
      expect(current()?.status).toBe("PAID");
      const retried = await service.confirm(1, confirmBody);
      expect(retried.reportId).toBe(42);
      expect(gateway.confirm).toHaveBeenCalledTimes(1);
    });

    it("결제사가 거절하면 FAILED로 두고 결제사 메시지를 전달한다", async () => {
      const { service, gateway, current } = setup();
      gateway.confirm.mockRejectedValueOnce(new PaymentGatewayError("REJECT_CARD_PAYMENT", "한도 초과"));
      await expect(service.confirm(1, confirmBody)).rejects.toMatchObject({
        code: "PAYMENT_REJECTED",
        message: "한도 초과",
      });
      expect(current()?.status).toBe("FAILED");
      expect(current()?.failureCode).toBe("REJECT_CARD_PAYMENT");
    });

    it("이미 승인된 결제(ALREADY_PROCESSED_PAYMENT)는 조회해서 이어간다", async () => {
      const { service, gateway } = setup();
      gateway.confirm.mockRejectedValueOnce(new PaymentGatewayError("ALREADY_PROCESSED_PAYMENT", "이미 처리"));
      const result = await service.confirm(1, confirmBody);
      expect(gateway.getPayment).toHaveBeenCalledWith("pk_1");
      expect(result.reportId).toBe(42);
    });

    it("승인 결과 금액이 주문과 다르면 결제를 취소하고 실패 처리한다", async () => {
      const { service, gateway, reportService, current } = setup();
      gateway.confirm.mockResolvedValueOnce(approval({ totalAmount: 100 }));
      await expect(service.confirm(1, confirmBody)).rejects.toMatchObject({
        code: "PAYMENT_APPROVAL_MISMATCH",
      });
      expect(gateway.cancel).toHaveBeenCalledWith("pk_1", expect.any(String));
      expect(reportService.create).not.toHaveBeenCalled();
      expect(current()?.status).toBe("FAILED");
    });

    it("실패·환불된 주문은 다시 승인하지 않는다", async () => {
      const { service, gateway } = setup({ stored: order({ status: "FAILED" }) });
      await expect(service.confirm(1, confirmBody)).rejects.toMatchObject({ code: "PAYMENT_NOT_PAYABLE" });
      expect(gateway.confirm).not.toHaveBeenCalled();
    });
  });

  it("결제창 실패는 READY 주문만 닫는다", async () => {
    const { service, paymentRepo } = setup();
    await service.fail(1, { orderId: "rpt_order0001", code: "PAY_PROCESS_CANCELED" });
    expect(paymentRepo.markFailed).toHaveBeenCalledWith("rpt_order0001", "PAY_PROCESS_CANCELED");
    const paid = setup({ stored: order({ status: "PAID" }) });
    await paid.service.fail(1, { orderId: "rpt_order0001", code: "X" });
    expect(paid.paymentRepo.markFailed).not.toHaveBeenCalled();
  });

  describe("refund", () => {
    it("결제 완료 건을 결제사에서 취소하고 REFUNDED로 바꾼다", async () => {
      const { service, gateway, current } = setup({ stored: order({ status: "PAID", paymentKey: "pk_1" }) });
      const refunded = await service.refund(1, "고객 요청");
      expect(gateway.cancel).toHaveBeenCalledWith("pk_1", "고객 요청");
      expect(refunded.status).toBe("REFUNDED");
      expect("paymentKey" in refunded).toBe(false);
      expect(current()?.cancelReason).toBe("고객 요청");
    });

    it("결제 완료가 아니면 409, 결제사가 거절하면 400", async () => {
      await expect(setup().service.refund(1, "사유")).rejects.toMatchObject({ code: "PAYMENT_NOT_REFUNDABLE" });
      const { service, gateway } = setup({ stored: order({ status: "PAID", paymentKey: "pk_1" }) });
      gateway.cancel.mockRejectedValueOnce(new PaymentGatewayError("ALREADY_CANCELED_PAYMENT", "이미 취소"));
      await expect(service.refund(1, "사유")).rejects.toMatchObject({ code: "PAYMENT_REFUND_REJECTED" });
    });
  });

  it("운영자 목록에는 결제 키를 넣지 않는다", async () => {
    const { service } = setup({ stored: order({ status: "PAID", paymentKey: "pk_secret" }) });
    const list = await service.listForAdmin({ limit: 10 });
    expect(JSON.stringify(list)).not.toContain("pk_secret");
    expect(list[0].userEmail).toBe("a@example.com");
  });
});
