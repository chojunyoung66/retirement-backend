import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "../../application/contracts/user-repo.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

export type FindUserRole = (userId: number) => Promise<UserRole | null>;

/** 인증 미들웨어 뒤에 둔다 — 역할은 토큰이 아니라 매 요청 DB에서 확인한다 */
export const createRequireOperator =
  (findRole: FindUserRole) => async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }
      if ((await findRole(req.userId)) !== "OPERATOR") {
        throw new BusinessException("OPERATOR_ONLY", "운영자만 접근할 수 있습니다", 403);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
