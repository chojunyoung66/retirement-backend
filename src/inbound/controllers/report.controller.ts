import { Router, Request, Response, NextFunction } from "express";
import type { ReportServiceType } from "../../application/services/report.service.js";
import type { ScenarioType } from "../../application/services/withdrawal/types.js";
import { createReportSchema, renameReportSchema } from "../schemas/report.schemas.js";
import { parseBody, requireUserId } from "../utils/parse-body.js";
import { parseIdParam } from "../utils/parse-id.js";

const INVALID_ID_MESSAGE = "유효한 리포트 ID가 아닙니다";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const sendFile = (res: Response, file: Buffer, contentType: string, disposition: string) => {
  res
    .status(200)
    .set({
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      "Content-Length": String(file.length),
      "Cache-Control": "no-store",
    })
    .end(file);
};

export const createReportController = (reportService: ReportServiceType) => {
  const router = Router();

  // POST /api/reports — 유료 모드에서는 결제 완료 주문(orderId)이 필요하다
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const body = parseBody(req, createReportSchema);
      const report = await reportService.create(userId, {
        scenarioSetId: body.scenarioSetId,
        scenarioType: body.scenarioType as ScenarioType,
        ...(body.orderId ? { orderId: body.orderId } : {}),
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

  // PATCH /api/reports/:id — 이름 변경 (null이면 기본 이름)
  router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const id = parseIdParam(req, INVALID_ID_MESSAGE);
      const body = parseBody(req, renameReportSchema);
      const report = await reportService.rename(id, userId, body.title);
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
      sendFile(res, pdf, "application/pdf", `attachment; filename="retirement-plan-${id}.pdf"`);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/reports/:id/xlsx
  router.get("/:id/xlsx", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const id = parseIdParam(req, INVALID_ID_MESSAGE);
      const xlsx = await reportService.renderXlsx(id, userId);
      const koreanName = encodeURIComponent(`은퇴현금_실행계획_${id}.xlsx`);
      sendFile(
        res,
        xlsx,
        XLSX_MIME,
        `attachment; filename="retirement-plan-${id}.xlsx"; filename*=UTF-8''${koreanName}`,
      );
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
