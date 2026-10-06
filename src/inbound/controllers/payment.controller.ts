import { Router, Request, Response, NextFunction } from "express";
import type { PaymentServiceType } from "../../application/services/payment.service.js";
import type { ScenarioType } from "../../application/services/withdrawal/types.js";
import {
  confirmPaymentSchema,
  createReportOrderSchema,
  failPaymentSchema,
} from "../schemas/payment.schemas.js";
import { parseBody, requireUserId } from "../utils/parse-body.js";

export const createPaymentController = (paymentService: PaymentServiceType) => {
  const router = Router();

  // GET /api/payments/config — 가격·유료 여부 (버튼 문구용)
  router.get("/config", (_req: Request, res: Response) => {
    res.status(200).json({ success: true, data: paymentService.getConfig() });
  });

  // POST /api/payments/report-orders — 금액은 서버 설정값으로 정한다
  router.post("/report-orders", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const body = parseBody(req, createReportOrderSchema);
      const order = await paymentService.createReportOrder(userId, {
        scenarioSetId: body.scenarioSetId,
        scenarioType: body.scenarioType as ScenarioType,
      });
      res.status(201).json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/payments/confirm — 승인 후 리포트까지 만든다 (멱등)
  router.post("/confirm", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const body = parseBody(req, confirmPaymentSchema);
      const result = await paymentService.confirm(userId, body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/payments/fail — 결제창 실패·취소
  router.post("/fail", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const body = parseBody(req, failPaymentSchema);
      await paymentService.fail(userId, body);
      res.status(200).json({ success: true, data: { orderId: body.orderId } });
    } catch (error) {
      next(error);
    }
  });

  return { router };
};

export type PaymentControllerType = ReturnType<typeof createPaymentController>;
