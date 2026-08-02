import { Router, Request, Response, NextFunction } from "express";
import type { UserServiceType } from "../../application/services/user.service.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import { deleteAccountDataSchema } from "../schemas/user.schemas.js";
import { clearAuthCookie } from "../utils/auth-cookie.js";

export const createUserController = (userService: UserServiceType) => {
  const router = Router();

  // GET /api/users/me
  router.get("/me", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      const profile = await userService.getProfile(userId);

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  });

  // PATCH /api/users/me
  router.patch("/me", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      const { name, password } = req.body;

      if (!name && !password) {
        throw new BusinessException("INVALID_REQUEST", "변경할 필드가 없습니다", 400);
      }

      const updateData: Record<string, string> = {};
      if (name) updateData.name = name;
      if (password) updateData.password = password;

      const updated = await userService.updateProfile(userId, updateData);

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/users/me — 계정 탈퇴 (재인증 후 hard delete)
  router.delete("/me", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      const validation = deleteAccountDataSchema.safeParse(req.body ?? {});
      if (!validation.success) {
        const message = validation.error.issues
          .map((issue) => issue.message)
          .join(", ");
        throw new BusinessException(
          "INVALID_REQUEST",
          message || "탈퇴 확인 정보가 올바르지 않습니다",
          400,
        );
      }

      await userService.deleteAccount(userId, validation.data);

      // 세션 쿠키 제거
      clearAuthCookie(res);
      res.status(200).json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  });

  return { router };
};

export type UserControllerType = ReturnType<typeof createUserController>;
