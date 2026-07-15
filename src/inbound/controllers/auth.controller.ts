import { Router, Request, Response, NextFunction } from "express";
import type { AuthServiceType } from "../../application/services/auth.service.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import { signupDataSchema, signinDataSchema } from "../schemas/auth.schemas.js";

export const createAuthController = (authService: AuthServiceType) => {
  const router = Router();

  // POST /api/auth/signup
  router.post("/signup", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 요청 검증
      const validation = signupDataSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.issues.map((issue) => issue.message).join(", ");
        throw new BusinessException("INVALID_REQUEST", message || "요청 데이터가 유효하지 않습니다", 400);
      }

      const { email, password, name } = validation.data;

      const result = await authService.signup(email, password, name);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/auth/signin
  router.post("/signin", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 요청 검증
      const validation = signinDataSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.issues.map((issue) => issue.message).join(", ");
        throw new BusinessException("INVALID_REQUEST", message || "요청 데이터가 유효하지 않습니다", 400);
      }

      const { email, password } = validation.data;

      const result = await authService.signin(email, password);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });

  return { router };
};

export type AuthControllerType = ReturnType<typeof createAuthController>;
