import { Request, Response, NextFunction } from "express";
import type { IJwtUtil } from "../../shared/contracts/jwt-util.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import { AUTH_COOKIE_NAME } from "../utils/auth-cookie.js";

function extractToken(req: Request): string | null {
  // Bearer 우선 — 기존 클라이언트·테스트 호환
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  // HttpOnly 쿠키 (크로스오리진 withCredentials)
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return cookieToken;
  }
  return null;
}

export const createAuthMiddleware = (jwtUtil: IJwtUtil) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const endpoint = `${req.method} ${req.path}`;
      const token = extractToken(req);

      if (!token) {
        console.warn(`[AUTH] Missing/Invalid token - ${endpoint}`);
        throw new BusinessException(
          "UNAUTHORIZED",
          "유효한 토큰이 없습니다",
          401,
        );
      }

      // 토큰 검증
      const payload = jwtUtil.verify(token);

      // userId를 req에 설정 (컨트롤러에서 접근 가능)
      req.userId = payload.userId as number;

      next();
    } catch (error) {
      const endpoint = `${req.method} ${req.path}`;

      if (error instanceof BusinessException) {
        console.error(
          `[AUTH] BusinessException - ${endpoint}: ${error.message}`,
        );
        return res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }

      // JWT 검증 실패
      console.error(
        `[AUTH] Token verification failed - ${endpoint}:`,
        (error as Error).message,
      );
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
