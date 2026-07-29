import { Router, Request, Response, NextFunction } from "express";
import type { DiagnosisServiceType } from "../../application/services/diagnosis.service.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import { diagnosisDataSchema } from "../schemas/diagnosis.schemas.js";

export const createDiagnosisController = (
  diagnosisService: DiagnosisServiceType,
) => {
  const router = Router();

  // GET /api/diagnoses/me/latest
  router.get("/me/latest", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      const diagnosis = await diagnosisService.getLatest(userId);

      // 개인 데이터 — 캐시 금지
      res.set("Cache-Control", "no-cache");
      res.status(200).json({
        success: true,
        data: diagnosis,
      });
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/diagnoses/me/latest
  router.put("/me/latest", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      const validation = diagnosisDataSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.issues
          .map((issue) => issue.message)
          .join(", ");
        throw new BusinessException(
          "INVALID_REQUEST",
          message || "요청 데이터가 유효하지 않습니다",
          400,
        );
      }

      const saved = await diagnosisService.saveLatest(userId, validation.data);

      res.status(200).json({
        success: true,
        data: saved,
      });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/diagnoses/me/latest
  router.delete(
    "/me/latest",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.userId;
        if (!userId) {
          throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
        }

        await diagnosisService.deleteLatest(userId);

        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  return { router };
};

export type DiagnosisControllerType = ReturnType<
  typeof createDiagnosisController
>;
