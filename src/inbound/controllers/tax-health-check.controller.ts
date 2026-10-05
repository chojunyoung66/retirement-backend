import { Router, Request, Response, NextFunction } from "express";
import type { TaxHealthCheckServiceType } from "../../application/services/tax-health-check.service.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import { taxHealthCheckSchema } from "../schemas/tax-health-check.schemas.js";

export const createTaxHealthCheckController = (service: TaxHealthCheckServiceType) => {
  const router = Router();

  // POST /api/tax-health-check — 계산만 하고 저장하지 않는다
  router.post("/", (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }
      const validation = taxHealthCheckSchema.safeParse(req.body ?? {});
      if (!validation.success) {
        const message = validation.error.issues.map((issue) => issue.message).join(", ");
        throw new BusinessException(
          "INVALID_REQUEST",
          message || "요청 데이터가 유효하지 않습니다",
          400,
        );
      }
      res.status(200).json({ success: true, data: service.check(validation.data) });
    } catch (error) {
      next(error);
    }
  });

  return { router };
};

export type TaxHealthCheckControllerType = ReturnType<typeof createTaxHealthCheckController>;
