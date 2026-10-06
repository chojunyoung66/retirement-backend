import request from "supertest";
import express from "express";
import { createAdminController } from "./admin.controller.js";
import { createPaymentController } from "./payment.controller.js";
import { createReviewRequestController } from "./review-request.controller.js";
import { createExecutionPlanController } from "./execution-plan.controller.js";
import type { PaymentServiceType } from "../../application/services/payment.service.js";
import type { ReviewRequestServiceType } from "../../application/services/review-request.service.js";
import type { ExecutionPlanServiceType } from "../../application/services/execution-plan.service.js";
import type { UserRole } from "../../application/contracts/user-repo.contract.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { createRequireOperator } from "../middlewares/require-operator.js";
import { errorMiddleware } from "../middlewares/error.middleware.js";
import type { IJwtUtil } from "../../shared/contracts/jwt-util.contract.js";

type Mocked<T> = { [K in keyof T]: jest.Mock };

describe("결제·검토·100일·운영자 API", () => {
  let app: express.Application;
  let role: UserRole;
  let paymentService: Mocked<PaymentServiceType>;
  let reviewService: Mocked<ReviewRequestServiceType>;
  let planService: Mocked<ExecutionPlanServiceType>;

  beforeEach(() => {
    role = "USER";
    app = express();
    app.use(express.json());
    paymentService = {
      getConfig: jest.fn().mockReturnValue({ enabled: true, price: 9900 }),
      createReportOrder: jest.fn(),
      confirm: jest.fn(),
      fail: jest.fn(),
      listForAdmin: jest.fn().mockResolvedValue([]),
      refund: jest.fn(),
    };
    reviewService = {
      create: jest.fn(),
      listMine: jest.fn().mockResolvedValue([]),
      cancel: jest.fn(),
      listForAdmin: jest.fn().mockResolvedValue([]),
      getForAdmin: jest.fn(),
      updateForAdmin: jest.fn(),
    };
    planService = {
      start: jest.fn(),
      getByReport: jest.fn(),
      setItemDone: jest.fn(),
    };
    const jwtUtil: Partial<IJwtUtil> = {
      sign: jest.fn(),
      verify: jest.fn().mockReturnValue({ userId: 1, email: "test@example.com" }),
      decode: jest.fn(),
    };
    const auth = createAuthMiddleware(jwtUtil as IJwtUtil);
    const requireOperator = createRequireOperator(async () => role);
    const plans = createExecutionPlanController(planService as unknown as ExecutionPlanServiceType);
    app.use("/payments", auth, createPaymentController(paymentService as unknown as PaymentServiceType).router);
    app.use(
      "/review-requests",
      auth,
      createReviewRequestController(reviewService as unknown as ReviewRequestServiceType).router,
    );
    app.use("/reports", auth, plans.reportRouter);
    app.use("/execution-plans", auth, plans.router);
    app.use(
      "/admin",
      auth,
      requireOperator,
      createAdminController({
        reviewService: reviewService as unknown as ReviewRequestServiceType,
        paymentService: paymentService as unknown as PaymentServiceType,
      }).router,
    );
    app.use(errorMiddleware);
  });

  const authHeader = { Authorization: "Bearer valid" };

  describe("결제", () => {
    it("인증 없이는 401", async () => {
      const response = await request(app).post("/payments/confirm").send({});
      expect(response.status).toBe(401);
    });

    it("가격 설정을 돌려준다", async () => {
      const response = await request(app).get("/payments/config").set(authHeader);
      expect(response.body.data).toEqual({ enabled: true, price: 9900 });
    });

    it("주문 생성은 시나리오만 받고 금액은 받지 않는다", async () => {
      paymentService.createReportOrder.mockResolvedValueOnce({ orderId: "rpt_1", amount: 9900 });
      const response = await request(app)
        .post("/payments/report-orders")
        .set(authHeader)
        .send({ scenarioSetId: 7, scenarioType: "D", amount: 1 });
      expect(response.status).toBe(201);
      expect(paymentService.createReportOrder).toHaveBeenCalledWith(1, { scenarioSetId: 7, scenarioType: "D" });
    });

    it.each([
      [{ orderId: "rpt_order1", amount: 9900 }],
      [{ paymentKey: "pk", orderId: "bad id!", amount: 9900 }],
      [{ paymentKey: "pk", orderId: "rpt_order1", amount: "9900" }],
      [{ paymentKey: "pk", orderId: "rpt_order1", amount: 0 }],
    ])("잘못된 승인 요청은 400 (%j)", async (body) => {
      const response = await request(app).post("/payments/confirm").set(authHeader).send(body);
      expect(response.status).toBe(400);
      expect(paymentService.confirm).not.toHaveBeenCalled();
    });

    it("승인 결과로 리포트 ID를 돌려준다", async () => {
      paymentService.confirm.mockResolvedValueOnce({ orderId: "rpt_order1", status: "PAID", reportId: 3 });
      const response = await request(app)
        .post("/payments/confirm")
        .set(authHeader)
        .send({ paymentKey: "pk", orderId: "rpt_order1", amount: 9900 });
      expect(response.status).toBe(200);
      expect(response.body.data.reportId).toBe(3);
    });
  });

  describe("검토 요청·100일 실행", () => {
    it("동의 없이 요청하면 400", async () => {
      const response = await request(app)
        .post("/review-requests")
        .set(authHeader)
        .send({ reportId: 5, question: "검토 부탁드립니다", consent: false });
      expect(response.status).toBe(400);
      expect(reviewService.create).not.toHaveBeenCalled();
    });

    it("동의하면 요청을 만든다", async () => {
      reviewService.create.mockResolvedValueOnce({ id: 1 });
      const response = await request(app)
        .post("/review-requests")
        .set(authHeader)
        .send({ reportId: 5, question: "검토 부탁드립니다", consent: true });
      expect(response.status).toBe(201);
    });

    it("100일 실행을 처음 시작하면 201, 이미 있으면 200", async () => {
      planService.start.mockResolvedValueOnce({ plan: { id: 1 }, created: true });
      planService.start.mockResolvedValueOnce({ plan: { id: 1 }, created: false });
      expect((await request(app).post("/reports/5/execution-plan").set(authHeader)).status).toBe(201);
      expect((await request(app).post("/reports/5/execution-plan").set(authHeader)).status).toBe(200);
    });

    it("체크 항목 키 형식이 틀리면 400", async () => {
      const bad = await request(app)
        .patch("/execution-plans/1/items/BAD KEY")
        .set(authHeader)
        .send({ done: true });
      expect(bad.status).toBe(400);
      planService.setItemDone.mockResolvedValueOnce({ id: 1 });
      const ok = await request(app).patch("/execution-plans/1/items/review-30").set(authHeader).send({ done: true });
      expect(ok.status).toBe(200);
      expect(planService.setItemDone).toHaveBeenCalledWith(1, 1, "review-30", true);
    });
  });

  describe("운영자", () => {
    it("일반 사용자는 운영자 API에 403", async () => {
      const reviews = await request(app).get("/admin/review-requests").set(authHeader);
      const refund = await request(app).post("/admin/payments/1/refund").set(authHeader).send({ reason: "요청" });
      expect(reviews.status).toBe(403);
      expect(reviews.body.error.code).toBe("OPERATOR_ONLY");
      expect(refund.status).toBe(403);
      expect(paymentService.refund).not.toHaveBeenCalled();
    });

    it("운영자는 상태로 목록을 거르고 답변을 저장한다", async () => {
      role = "OPERATOR";
      const list = await request(app).get("/admin/review-requests?status=REQUESTED&limit=20").set(authHeader);
      expect(list.status).toBe(200);
      expect(reviewService.listForAdmin).toHaveBeenCalledWith({ status: "REQUESTED", limit: 20 });
      reviewService.updateForAdmin.mockResolvedValueOnce({ id: 9 });
      const updated = await request(app)
        .patch("/admin/review-requests/9")
        .set(authHeader)
        .send({ answer: "연금 수령을 권합니다" });
      expect(updated.status).toBe(200);
    });

    it("잘못된 상태 필터·빈 수정 요청은 400", async () => {
      role = "OPERATOR";
      expect((await request(app).get("/admin/payments?status=NOPE").set(authHeader)).status).toBe(400);
      expect((await request(app).patch("/admin/review-requests/9").set(authHeader).send({})).status).toBe(400);
    });

    it("환불은 사유가 필요하다", async () => {
      role = "OPERATOR";
      expect(
        (await request(app).post("/admin/payments/1/refund").set(authHeader).send({})).status,
      ).toBe(400);
      paymentService.refund.mockResolvedValueOnce({ id: 1, status: "REFUNDED" });
      const ok = await request(app).post("/admin/payments/1/refund").set(authHeader).send({ reason: "고객 요청" });
      expect(ok.status).toBe(200);
      expect(paymentService.refund).toHaveBeenCalledWith(1, "고객 요청");
    });
  });
});
