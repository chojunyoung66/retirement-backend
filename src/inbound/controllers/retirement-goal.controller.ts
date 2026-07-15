import { Router, Request, Response, NextFunction } from "express";
import type { RetirementGoalServiceType } from "../../application/services/retirement-goal.service.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import { retirementGoalDataSchema, retirementGoalUpdateSchema } from "../schemas/retirement-goal.schemas.js";

export const createRetirementGoalController = (retirementGoalService: RetirementGoalServiceType) => {
  const router = Router();

  // POST /api/retirement-goals
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      // 요청 검증
      const validation = retirementGoalDataSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.issues.map((issue) => issue.message).join(", ");
        throw new BusinessException("INVALID_REQUEST", message || "요청 데이터가 유효하지 않습니다", 400);
      }

      const result = await retirementGoalService.create(userId, validation.data);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/retirement-goals/me
  router.get("/me", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      const goal = await retirementGoalService.getByUserId(userId);

      res.status(200).json({
        success: true,
        data: goal,
      });
    } catch (error) {
      next(error);
    }
  });

  // PATCH /api/retirement-goals/me
  router.patch("/me", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      // 요청 검증
      const validation = retirementGoalUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.issues.map((issue) => issue.message).join(", ");
        throw new BusinessException("INVALID_REQUEST", message || "요청 데이터가 유효하지 않습니다", 400);
      }

      const updated = await retirementGoalService.update(userId, validation.data);

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  });

  return { router };
};

export type RetirementGoalControllerType = ReturnType<typeof createRetirementGoalController>;
