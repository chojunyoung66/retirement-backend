import { Router, Request, Response, NextFunction } from "express";
import type { UserServiceType } from "../../application/services/user.service.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

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

  return { router };
};

export type UserControllerType = ReturnType<typeof createUserController>;
