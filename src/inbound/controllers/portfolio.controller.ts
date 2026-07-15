import { Router, Request, Response, NextFunction } from "express";
import type { PortfolioServiceType } from "../../application/services/portfolio.service.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import { portfolioDataSchema, portfolioUpdateSchema } from "../schemas/portfolio.schemas.js";

export const createPortfolioController = (portfolioService: PortfolioServiceType) => {
  const router = Router();

  // POST /api/pension-portfolios
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      // 요청 검증
      const validation = portfolioDataSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.issues.map((issue) => issue.message).join(", ");
        throw new BusinessException("INVALID_REQUEST", message || "요청 데이터가 유효하지 않습니다", 400);
      }

      const { accountType, name, items } = validation.data;
      const result = await portfolioService.create(userId, accountType, name, items);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/pension-portfolios
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      const portfolios = await portfolioService.getByUserId(userId);

      res.status(200).json({
        success: true,
        data: portfolios,
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/pension-portfolios/:id
  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const portfolioId = parseInt(id, 10);

      if (isNaN(portfolioId)) {
        throw new BusinessException("INVALID_REQUEST", "유효한 포트폴리오 ID가 아닙니다", 400);
      }

      const portfolio = await portfolioService.getById(portfolioId);

      res.status(200).json({
        success: true,
        data: portfolio,
      });
    } catch (error) {
      next(error);
    }
  });

  // PATCH /api/pension-portfolios/:id
  router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const portfolioId = parseInt(id, 10);

      if (isNaN(portfolioId)) {
        throw new BusinessException("INVALID_REQUEST", "유효한 포트폴리오 ID가 아닙니다", 400);
      }

      // 요청 검증
      const validation = portfolioUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.issues.map((issue) => issue.message).join(", ");
        throw new BusinessException("INVALID_UPDATE", message || "업데이트할 필드가 없습니다", 400);
      }

      const updated = await portfolioService.update(portfolioId, validation.data);

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/pension-portfolios/:id
  router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const portfolioId = parseInt(id, 10);

      if (isNaN(portfolioId)) {
        throw new BusinessException("INVALID_REQUEST", "유효한 포트폴리오 ID가 아닙니다", 400);
      }

      const deleted = await portfolioService.delete(portfolioId);

      res.status(200).json({
        success: true,
        data: { deleted },
      });
    } catch (error) {
      next(error);
    }
  });

  return { router };
};

export type PortfolioControllerType = ReturnType<typeof createPortfolioController>;
