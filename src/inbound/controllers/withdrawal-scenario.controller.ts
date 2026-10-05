import { Router, Request, Response, NextFunction } from "express";
import type { WithdrawalScenarioServiceType } from "../../application/services/withdrawal-scenario.service.js";
import type { ScenarioType } from "../../application/services/withdrawal/types.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import {
  generateScenarioSchema,
  scenarioSelectionSchema,
  scenarioTypeSchema,
} from "../schemas/withdrawal-scenario.schemas.js";
import { parseIdParam } from "../utils/parse-id.js";

const requireUserId = (req: Request): number => {
  if (!req.userId) {
    throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
  }
  return req.userId;
};

const INVALID_ID_MESSAGE = "유효한 시나리오 ID가 아닙니다";

export const createWithdrawalScenarioController = (
  scenarioService: WithdrawalScenarioServiceType,
) => {
  const router = Router();

  // POST /api/withdrawal-scenarios/generate
  router.post("/generate", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const validation = generateScenarioSchema.safeParse(req.body ?? {});
      if (!validation.success) {
        const message = validation.error.issues.map((issue) => issue.message).join(", ");
        throw new BusinessException(
          "INVALID_REQUEST",
          message || "요청 데이터가 유효하지 않습니다",
          400,
        );
      }
      const set = await scenarioService.generate(userId, validation.data);
      res.status(201).json({ success: true, data: set });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/withdrawal-scenarios (본인 세트 전체 삭제)
  router.delete("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const deletedCount = await scenarioService.deleteAll(userId);
      res.status(200).json({ success: true, data: { deletedCount } });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/withdrawal-scenarios/latest — 없으면 null
  router.get("/latest", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const set = await scenarioService.getLatest(userId);
      res.status(200).json({ success: true, data: set });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/withdrawal-scenarios/:id/plans/:type
  router.get("/:id/plans/:type", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const id = parseIdParam(req, INVALID_ID_MESSAGE);
      const type = scenarioTypeSchema.safeParse(req.params.type);
      if (!type.success) {
        throw new BusinessException(
          "INVALID_REQUEST",
          "시나리오 유형은 A, B, C, D 중 하나여야 합니다",
          400,
        );
      }
      const plan = await scenarioService.getPlan(id, userId, type.data as ScenarioType);
      res.status(200).json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  });

  // PATCH /api/withdrawal-scenarios/:id/selection
  router.patch("/:id/selection", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const id = parseIdParam(req, INVALID_ID_MESSAGE);
      const validation = scenarioSelectionSchema.safeParse(req.body);
      if (!validation.success) {
        throw new BusinessException(
          "INVALID_REQUEST",
          "시나리오 유형은 A, B, C, D 중 하나여야 합니다",
          400,
        );
      }
      const selected = await scenarioService.select(
        id,
        userId,
        validation.data.selectedType as ScenarioType,
      );
      res.status(200).json({ success: true, data: selected });
    } catch (error) {
      next(error);
    }
  });

  return { router };
};

export type WithdrawalScenarioControllerType = ReturnType<
  typeof createWithdrawalScenarioController
>;
