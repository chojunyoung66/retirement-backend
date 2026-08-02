import type { CookieOptions, Response } from "express";

/** 브라우저 세션 JWT — HttpOnly 쿠키 전용 */
export const AUTH_COOKIE_NAME = "retirement_token";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Vercel↔Render 크로스오리진: SameSite=None + Secure 필수
export function authCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
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
