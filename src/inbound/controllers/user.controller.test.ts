import request from "supertest";
import express from "express";
import { createUserController } from "./user.controller.js";
import type { UserServiceType } from "../../application/services/user.service.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { errorMiddleware } from "../middlewares/error.middleware.js";
import type { IJwtUtil } from "../../shared/contracts/jwt-util.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

describe("UserController", () => {
  let app: express.Application;
  let mockUserService: Partial<UserServiceType>;
  let mockJwtUtil: Partial<IJwtUtil>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockUserService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
    };

    mockJwtUtil = {
      sign: jest.fn().mockReturnValue("jwt_token"),
      verify: jest.fn().mockReturnValue({ userId: 1, email: "test@example.com" }),
      decode: jest.fn(),
    };

    const authMiddleware = createAuthMiddleware(mockJwtUtil as IJwtUtil);
    const userController = createUserController(mockUserService as UserServiceType);

    app.use("/users", authMiddleware, userController.router);
    app.use(errorMiddleware);
  });

  describe("GET /users/me", () => {
    it("사용자 프로필 조회 성공", async () => {
      // given
      const mockProfile = {
        id: 1,
        email: "test@example.com",
        name: "테스트유저",
      };

      (mockUserService.getProfile as jest.Mock).mockResolvedValueOnce(mockProfile);

      // when
      const response = await request(app)
        .get("/users/me")
        .set("Authorization", "Bearer valid_token");

      // then
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockProfile);
      expect(mockUserService.getProfile).toHaveBeenCalledWith(1);
    });

    it("존재하지 않는 사용자는 404 반환", async () => {
      // given
      const notFoundError = new BusinessException(
        "USER_NOT_FOUND",
        "사용자를 찾을 수 없습니다",
        404,
      );

      (mockUserService.getProfile as jest.Mock).mockRejectedValueOnce(notFoundError);

      // when
      const response = await request(app)
        .get("/users/me")
        .set("Authorization", "Bearer valid_token");

      // then
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("USER_NOT_FOUND");
    });

    it("인증 없이 접근하면 401 반환", async () => {
      const response = await request(app).get("/users/me");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("PATCH /users/me", () => {
    it("이름 업데이트 성공", async () => {
      // given
      const updateData = { name: "변경된이름" };
      const mockResult = {
        id: 1,
        email: "test@example.com",
        name: "변경된이름",
      };

      (mockUserService.updateProfile as jest.Mock).mockResolvedValueOnce(mockResult);

      // when
      const response = await request(app)
        .patch("/users/me")
        .set("Authorization", "Bearer valid_token")
        .send(updateData);

      // then
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockUserService.updateProfile).toHaveBeenCalledWith(1, { name: "변경된이름" });
    });

    it("비밀번호 업데이트 성공", async () => {
      // given
      const updateData = { password: "newpassword123" };
      const mockResult = {
        id: 1,
        email: "test@example.com",
        name: "테스트유저",
      };

      (mockUserService.updateProfile as jest.Mock).mockResolvedValueOnce(mockResult);

      // when
      const response = await request(app)
        .patch("/users/me")
        .set("Authorization", "Bearer valid_token")
        .send(updateData);

      // then
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockUserService.updateProfile).toHaveBeenCalledWith(1, { password: "newpassword123" });
    });

    it("이름과 비밀번호 동시 업데이트 성공", async () => {
      // given
      const updateData = { name: "새이름", password: "newpassword123" };
      const mockResult = {
        id: 1,
        email: "test@example.com",
        name: "새이름",
      };

      (mockUserService.updateProfile as jest.Mock).mockResolvedValueOnce(mockResult);

      // when
      const response = await request(app)
        .patch("/users/me")
        .set("Authorization", "Bearer valid_token")
        .send(updateData);

      // then
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockUserService.updateProfile).toHaveBeenCalledWith(1, {
        name: "새이름",
        password: "newpassword123",
      });
    });

    it("변경할 필드가 없으면 400 반환", async () => {
      const response = await request(app)
        .patch("/users/me")
        .set("Authorization", "Bearer valid_token")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("INVALID_REQUEST");
      expect(response.body.error.message).toContain("변경할 필드");
    });

    it("서비스 레벨에서 INVALID_UPDATE 예외가 전파되면 400 반환", async () => {
      // given
      const invalidUpdateError = new BusinessException(
        "INVALID_UPDATE",
        "업데이트할 필드가 없습니다",
        400,
      );

      (mockUserService.updateProfile as jest.Mock).mockRejectedValueOnce(invalidUpdateError);

      // when
      const response = await request(app)
        .patch("/users/me")
        .set("Authorization", "Bearer valid_token")
        .send({ name: "새이름" });

      // then
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_UPDATE");
    });

    it("인증 없이 접근하면 401 반환", async () => {
      const response = await request(app).patch("/users/me").send({ name: "새이름" });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });
});
