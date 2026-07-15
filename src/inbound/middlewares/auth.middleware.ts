import { Request, Response, NextFunction } from "express";
import type { IJwtUtil } from "../../shared/contracts/jwt-util.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

export const createAuthMiddleware = (jwtUtil: IJwtUtil) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const endpoint = `${req.method} ${req.path}`;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.warn(`[AUTH] Missing/Invalid token - ${endpoint}`);
        throw new BusinessException("UNAUTHORIZED", "유효한 토큰이 없습니다", 401);
      }

      const token = authHeader.substring(7);

      // 토큰 검증
      const payload = jwtUtil.verify(token);

      // userId를 req에 설정 (컨트롤러에서 접근 가능)
      req.userId = payload.userId as number;

      next();
    } catch (error) {
      const endpoint = `${req.method} ${req.path}`;

      if (error instanceof BusinessException) {
        console.error(`[AUTH] BusinessException - ${endpoint}: ${error.message}`);
        return res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }

      // JWT 검증 실패
      console.error(`[AUTH] Token verification failed - ${endpoint}:`, (error as Error).message);
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "유효하지 않은 토큰입니다",
        },
      });
    }
  };
};
