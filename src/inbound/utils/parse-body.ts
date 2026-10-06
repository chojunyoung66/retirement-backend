import type { Request } from "express";
import type { z } from "zod";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

/** zod 스키마로 본문을 검사하고, 실패하면 이슈 메시지를 모아 400으로 던진다 */
export const parseBody = <T extends z.ZodType>(req: Request, schema: T): z.infer<T> => {
  const validation = schema.safeParse(req.body ?? {});
  if (!validation.success) {
    const message = validation.error.issues.map((issue) => issue.message).join(", ");
    throw new BusinessException("INVALID_REQUEST", message || "요청 데이터가 유효하지 않습니다", 400);
  }
  return validation.data;
};

export const requireUserId = (req: Request): number => {
  if (!req.userId) {
    throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
  }
  return req.userId;
};
