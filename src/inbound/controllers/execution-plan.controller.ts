import { Router, Request, Response, NextFunction } from "express";
import type { ExecutionPlanServiceType } from "../../application/services/execution-plan.service.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import { executionItemKeySchema, setExecutionItemSchema } from "../schemas/concierge.schemas.js";
import { parseBody, requireUserId } from "../utils/parse-body.js";
import { parseIdParam } from "../utils/parse-id.js";

export const createExecutionPlanController = (planService: ExecutionPlanServiceType) => {
  // /api/reports/:id/execution-plan
  const reportRouter = Router();

  reportRouter.post("/:id/execution-plan", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const reportId = parseIdParam(req, "유효한 리포트 ID가 아닙니다");
      const { plan, created } = await planService.start(userId, reportId);
      res.status(created ? 201 : 200).json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  });

  reportRouter.get("/:id/execution-plan", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const reportId = parseIdParam(req, "유효한 리포트 ID가 아닙니다");
      res.status(200).json({ success: true, data: await planService.getByReport(userId, reportId) });
    } catch (error) {
      next(error);
    }
  });

  // /api/execution-plans/:id/items/:key
  const router = Router();

  router.patch("/:id/items/:key", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const planId = parseIdParam(req, "유효한 실행 계획 ID가 아닙니다");
      const key = executionItemKeySchema.safeParse(req.params.key);
      if (!key.success) {
        throw new BusinessException("INVALID_REQUEST", "유효한 체크리스트 항목이 아닙니다", 400);
      }
      const { done } = parseBody(req, setExecutionItemSchema);
      res
        .status(200)
        .json({ success: true, data: await planService.setItemDone(userId, planId, key.data, done) });
    } catch (error) {
      next(error);
    }
  });

  return { reportRouter, router };
};

export type ExecutionPlanControllerType = ReturnType<typeof createExecutionPlanController>;
