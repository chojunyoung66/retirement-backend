import { Router, Request, Response, NextFunction } from "express";
import type {
  AuthResult,
  AuthServiceType,
} from "../../application/services/auth.service.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import {
  signupDataSchema,
  signinDataSchema,
  googleSignInDataSchema,
} from "../schemas/auth.schemas.js";
import { clearAuthCookie, setAuthCookie } from "../utils/auth-cookie.js";

type AuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void;

/** JWT는 HttpOnly 쿠키로만 전달 — JSON body에는 프로필만 */
function toPublicAuthData(result: AuthResult) {
  return {
    id: result.id,
    email: result.email,
    name: result.name,
  };
}

export const createAuthController = (
  authService: AuthServiceType,
  authMiddleware?: AuthMiddleware,
) => {
  const router = Router();

  // POST /api/auth/signup
  router.post("/signup", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = signupDataSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.issues
          .map((issue) => issue.message)
          .join(", ");
        throw new BusinessException(
          "INVALID_REQUEST",
          message || "요청 데이터가 유효하지 않습니다",
          400,
        );
      }

      const { email, password, name } = validation.data;
      const result = await authService.signup(email, password, name);

      setAuthCookie(res, result.token);
      res.status(201).json({ success: true, data: toPublicAuthData(result) });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/auth/signin
  router.post("/signin", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = signinDataSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.issues
          .map((issue) => issue.message)
          .join(", ");
        throw new BusinessException(
          "INVALID_REQUEST",
          message || "요청 데이터가 유효하지 않습니다",
          400,
        );
      }

      const { email, password } = validation.data;
      const result = await authService.signin(email, password);

      setAuthCookie(res, result.token);
      res.status(200).json({ success: true, data: toPublicAuthData(result) });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/auth/google
  router.post("/google", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = googleSignInDataSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.issues
          .map((issue) => issue.message)
          .join(", ");
        throw new BusinessException(
          "INVALID_REQUEST",
          message || "요청 데이터가 유효하지 않습니다",
          400,
        );
      }

      const result = await authService.googleSignIn(validation.data.idToken);

      setAuthCookie(res, result.token);
      res.status(200).json({ success: true, data: toPublicAuthData(result) });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/auth/logout — 인증 없이 쿠키 삭제 (만료 토큰으로도 로그아웃 가능)
  router.post("/logout", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      clearAuthCookie(res);
      res.status(200).json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/auth/me (인증 필요)
  if (authMiddleware) {
    router.get(
      "/me",
      authMiddleware,
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          const userId = req.userId;
          if (!userId) {
            throw new BusinessException(
              "UNAUTHORIZED",
              "인증이 필요합니다",
              401,
            );
          }

          const profile = await authService.getMe(userId);
          res.set("Cache-Control", "no-cache");
          res.status(200).json({ success: true, data: profile });
        } catch (error) {
          next(error);
        }
      },
    );
  }

  return { router };
};

export type AuthControllerType = ReturnType<typeof createAuthController>;
