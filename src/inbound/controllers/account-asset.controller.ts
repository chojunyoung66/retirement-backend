import { Router, Request, Response, NextFunction } from "express";
import type { AccountAssetServiceType } from "../../application/services/account-asset.service.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import {
  accountAssetCreateSchema,
  accountAssetUpdateSchema,
  detailDataConsentSchema,
} from "../schemas/account-asset.schemas.js";
import { parseIdParam } from "../utils/parse-id.js";

const requireUserId = (req: Request): number => {
  if (!req.userId) {
    throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
  }
  return req.userId;
};

const INVALID_ID_MESSAGE = "유효한 계좌 ID가 아닙니다";

export const createAccountAssetController = (accountAssetService: AccountAssetServiceType) => {
  const router = Router();

  // GET /api/account-assets
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const assets = await accountAssetService.list(userId);
      res.status(200).json({ success: true, data: assets });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/account-assets
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const validation = accountAssetCreateSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.issues.map((issue) => issue.message).join(", ");
        throw new BusinessException(
          "INVALID_REQUEST",
          message || "요청 데이터가 유효하지 않습니다",
          400,
        );
      }
      const consent = detailDataConsentSchema.safeParse(req.body);
      const created = await accountAssetService.create(userId, validation.data, {
        detailDataConsent: consent.success && consent.data.detailDataConsent === true,
      });
      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/account-assets (전체 삭제)
  router.delete("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const deletedCount = await accountAssetService.deleteAll(userId);
      res.status(200).json({ success: true, data: { deletedCount } });
    } catch (error) {
      next(error);
    }
  });

  // PATCH /api/account-assets/:id
  router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const id = parseIdParam(req, INVALID_ID_MESSAGE);
      const validation = accountAssetUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.issues.map((issue) => issue.message).join(", ");
        throw new BusinessException(
          "INVALID_UPDATE",
          message || "업데이트할 필드가 없습니다",
          400,
        );
      }
      const updated = await accountAssetService.update(id, userId, validation.data);
      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/account-assets/:id
  router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const id = parseIdParam(req, INVALID_ID_MESSAGE);
      await accountAssetService.delete(id, userId);
      res.status(200).json({ success: true, data: { deleted: true } });
    } catch (error) {
      next(error);
    }
  });

  return { router };
};

export type AccountAssetControllerType = ReturnType<typeof createAccountAssetController>;
