import type { Request } from "express";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

// PostgreSQL Int4 상한 — 초과 값은 Prisma P2020(500)로 이어짐
const MAX_INT4 = 2_147_483_647;

/** 경로 파라미터 id를 양의 정수로 엄격히 변환 ("12abc"·"1.5"·"-1"·범위 초과는 400) */
export const parseIdParam = (req: Request, message: string): number => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) {
    throw new BusinessException("INVALID_REQUEST", message, 400);
  }
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id > MAX_INT4) {
    throw new BusinessException("INVALID_REQUEST", message, 400);
  }
  return id;
};
