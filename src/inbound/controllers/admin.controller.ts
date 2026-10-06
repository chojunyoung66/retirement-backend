import { Router, Request, Response, NextFunction } from "express";
import type { z } from "zod";
import type { PaymentStatus } from "../../application/contracts/payment-repo.contract.js";
import type { ReviewStatus } from "../../application/contracts/review-request-repo.contract.js";
import type { PaymentServiceType } from "../../application/services/payment.service.js";
import type { ReviewRequestServiceType } from "../../application/services/review-request.service.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import {
  adminPaymentListQuerySchema,
  adminRefundSchema,
  adminReviewListQuerySchema,
  adminUpdateReviewSchema,
} from "../schemas/concierge.schemas.js";
import { parseBody } from "../utils/parse-body.js";
import { parseIdParam } from "../utils/parse-id.js";

const parseQuery = <T extends z.ZodType>(schema: T, query: unknown): z.infer<T> => {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new BusinessException("INVALID_REQUEST", "조회 조건이 올바르지 않습니다", 400);
  }
  return result.data;
};

/** 인증·운영자 확인 미들웨어 뒤에 마운트한다 */
export const createAdminController = (deps: {
  reviewService: ReviewRequestServiceType;
  paymentService: PaymentServiceType;
}) => {
  const { reviewService, paymentService } = deps;
  const router = Router();

  router.get("/review-requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = parseQuery(adminReviewListQuerySchema, req.query);
      const list = await reviewService.listForAdmin({
        status: query.status as ReviewStatus | undefined,
        limit: query.limit,
      });
      res.status(200).json({ success: true, data: list });
    } catch (error) {
      next(error);
    }
  });

  router.get("/review-requests/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseIdParam(req, "유효한 검토 요청 ID가 아닙니다");
      res.status(200).json({ success: true, data: await reviewService.getForAdmin(id) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/review-requests/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseIdParam(req, "유효한 검토 요청 ID가 아닙니다");
      const body = parseBody(req, adminUpdateReviewSchema);
      const updated = await reviewService.updateForAdmin(id, {
        ...body,
        status: body.status as ReviewStatus | undefined,
      });
      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  });

  router.get("/payments", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = parseQuery(adminPaymentListQuerySchema, req.query);
      const list = await paymentService.listForAdmin({
        status: query.status as PaymentStatus | undefined,
        limit: query.limit,
      });
      res.status(200).json({ success: true, data: list });
    } catch (error) {
      next(error);
    }
  });

  router.post("/payments/:id/refund", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseIdParam(req, "유효한 결제 ID가 아닙니다");
      const { reason } = parseBody(req, adminRefundSchema);
      res.status(200).json({ success: true, data: await paymentService.refund(id, reason) });
    } catch (error) {
      next(error);
    }
  });

  return { router };
};

export type AdminControllerType = ReturnType<typeof createAdminController>;
