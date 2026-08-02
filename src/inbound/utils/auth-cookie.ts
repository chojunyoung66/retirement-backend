import type { CookieOptions, Response } from "express";

/** 브라우저 세션 JWT — HttpOnly 쿠키 전용 */
export const AUTH_COOKIE_NAME = "retirement_token";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Path=/api: 동일 출처 프록시(/api/*)에만 쿠키 전송
 * SameSite=Lax: Vercel 1st-party 프록시 기준 (크로스사이트 None 불필요)
 */
export function authCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/api",
    maxAge: SEVEN_DAYS_MS,
  };
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    ...authCookieOptions(),
    maxAge: undefined,
  });
}
