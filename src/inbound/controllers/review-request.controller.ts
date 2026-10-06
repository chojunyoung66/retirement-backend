import { Router, Request, Response, NextFunction } from "express";
import type { ReviewRequestServiceType } from "../../application/services/review-request.service.js";
import { createReviewRequestSchema } from "../schemas/concierge.schemas.js";
import { parseBody, requireUserId } from "../utils/parse-body.js";
import { parseIdParam } from "../utils/parse-id.js";

const INVALID_ID_MESSAGE = "유효한 검토 요청 ID가 아닙니다";

export const createReviewRequestController = (reviewService: ReviewRequestServiceType) => {
  const router = Router();

  // POST /api/review-requests — 리포트 열람 동의 필수
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const body = parseBody(req, createReviewRequestSchema);
      const created = await reviewService.create(userId, body);
      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/review-requests — 내 요청 최신순
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      res.status(200).json({ success: true, data: await reviewService.listMine(userId) });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/review-requests/:id — 처리 전 요청 취소
  router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const id = parseIdParam(req, INVALID_ID_MESSAGE);
      res.status(200).json({ success: true, data: await reviewService.cancel(id, userId) });
    } catch (error) {
      next(error);
    }
  });

  return { router };
};

export type ReviewRequestControllerType = ReturnType<typeof createReviewRequestController>;
