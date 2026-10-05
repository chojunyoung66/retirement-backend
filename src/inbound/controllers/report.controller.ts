import { Router, Request, Response, NextFunction } from "express";
import type { ReportServiceType } from "../../application/services/report.service.js";
import type { ScenarioType } from "../../application/services/withdrawal/types.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import { createReportSchema } from "../schemas/report.schemas.js";
import { parseIdParam } from "../utils/parse-id.js";

const requireUserId = (req: Request): number => {
  if (!req.userId) {
    throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
  }
  return req.userId;
};

const INVALID_ID_MESSAGE = "유효한 리포트 ID가 아닙니다";

export const createReportController = (reportService: ReportServiceType) => {
  const router = Router();

  // POST /api/reports
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const validation = createReportSchema.safeParse(req.body ?? {});
      if (!validation.success) {
        const message = validation.error.issues.map((issue) => issue.message).join(", ");
        throw new BusinessException(
          "INVALID_REQUEST",
          message || "요청 데이터가 유효하지 않습니다",
          400,
        );
      }
      const report = await reportService.create(userId, {
        scenarioSetId: validation.data.scenarioSetId,
        scenarioType: validation.data.scenarioType as ScenarioType,
      });
      res.status(201).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/reports — 본문 없이 최신순 목록
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const reports = await reportService.list(userId);
      res.status(200).json({ success: true, data: reports });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/reports/:id
  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const id = parseIdParam(req, INVALID_ID_MESSAGE);
      const report = await reportService.get(id, userId);
      res.status(200).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/reports/:id/pdf — 파일명에는 개인정보를 넣지 않는다
  router.get("/:id/pdf", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const id = parseIdParam(req, INVALID_ID_MESSAGE);
      const pdf = await reportService.renderPdf(id, userId);
      res
        .status(200)
        .set({
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="retirement-plan-${id}.pdf"`,
          "Content-Length": String(pdf.length),
          "Cache-Control": "no-store",
        })
        .end(pdf);
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/reports/:id
  router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const id = parseIdParam(req, INVALID_ID_MESSAGE);
      await reportService.delete(id, userId);
      res.status(200).json({ success: true, data: { id } });
    } catch (error) {
      next(error);
    }
  });

  return { router };
};

export type ReportControllerType = ReturnType<typeof createReportController>;
