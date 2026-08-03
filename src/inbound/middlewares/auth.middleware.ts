import { Request, Response, NextFunction } from "express";
import type { IJwtUtil } from "../../shared/contracts/jwt-util.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import {
  createAuthTokenPayload,
  nextIdleTtlMs,
  remainingAbsoluteMs,
  resolveSessionStartedAtMs,
} from "../../shared/session-policy.js";
import { AUTH_COOKIE_NAME, setAuthCookie } from "../utils/auth-cookie.js";

function extractToken(req: Request): string | null {
  // HttpOnly 쿠키 우선 — 브라우저 세션의 단일 출처
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return cookieToken;
  }

  // production에서는 Bearer 무시 (XSS로 Authorization 주입 경로 차단)
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  // 테스트·로컬 도구 호환용 Bearer
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
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
      const userId = payload.userId as number;
      const email = String(payload.email ?? "");
      const sessionStartedAt = resolveSessionStartedAtMs(payload);

      // 절대 12시간 만료
      if (remainingAbsoluteMs(sessionStartedAt) <= 0) {
        throw new BusinessException(
          "SESSION_EXPIRED",
          "세션이 만료되었습니다. 다시 로그인해 주세요",
          401,
        );
      }

      // 유휴 슬라이딩 — 요청마다 TTL 갱신 (절대 잔여로 상한)
      const ttlMs = nextIdleTtlMs(sessionStartedAt);
      const expiresInSec = Math.max(1, Math.ceil(ttlMs / 1000));
      const refreshed = jwtUtil.sign(
        createAuthTokenPayload(userId, email, sessionStartedAt),
        `${expiresInSec}s`,
      );
      setAuthCookie(res, refreshed, ttlMs);

      // userId를 req에 설정 (컨트롤러에서 접근 가능)
      req.userId = userId;

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
