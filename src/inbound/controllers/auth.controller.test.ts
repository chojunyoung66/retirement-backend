import request from "supertest";
import express from "express";
import { createAuthController } from "./auth.controller.js";
import type { AuthServiceType } from "../../application/services/auth.service.js";
import { errorMiddleware } from "../middlewares/error.middleware.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

describe("AuthController", () => {
  let app: express.Application;
  let mockAuthService: Partial<AuthServiceType>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockAuthService = {
      signup: jest.fn(),
      signin: jest.fn(),
    };

    const authController = createAuthController(mockAuthService as AuthServiceType);
    app.use("/auth", authController.router);
    app.use(errorMiddleware);
  });

  describe("POST /auth/signup", () => {
    it("유효한 데이터로 회원가입 성공", async () => {
      // given
      const signupData = {
        email: "test@example.com",
        password: "password123",
        name: "테스트유저",
      };
      const mockResult = {
        id: 1,
        email: "test@example.com",
        name: "테스트유저",
        token: "jwt_token_abc",
      };

      (mockAuthService.signup as jest.Mock).mockResolvedValueOnce(mockResult);

      // when
      const response = await request(app).post("/auth/signup").send(signupData);

      // then
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockAuthService.signup).toHaveBeenCalledWith(
        signupData.email,
        signupData.password,
        signupData.name
      );
    });

    it("잘못된 이메일 형식은 검증 실패", async () => {
      const response = await request(app).post("/auth/signup").send({
        email: "invalid-email",
        password: "password123",
        name: "테스트유저",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("INVALID_REQUEST");
      expect(response.body.error.message).toContain("이메일");
    });

    it("비밀번호 8자 미만은 검증 실패", async () => {
      const response = await request(app).post("/auth/signup").send({
        email: "test@example.com",
        password: "short",
        name: "테스트유저",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain("8자");
    });

    it("이름이 없으면 검증 실패", async () => {
      const response = await request(app).post("/auth/signup").send({
        email: "test@example.com",
        password: "password123",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("중복된 이메일로 회원가입 시 409 반환", async () => {
      // given
      const signupData = {
        email: "existing@example.com",
        password: "password123",
        name: "새로운유저",
      };

      const duplicateError = new BusinessException(
        "DUPLICATE_EMAIL",
        "이미 존재하는 이메일입니다",
        409
      );

      (mockAuthService.signup as jest.Mock).mockRejectedValueOnce(duplicateError);

      // when
      const response = await request(app).post("/auth/signup").send(signupData);

      // then
      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("DUPLICATE_EMAIL");
    });
  });

  describe("POST /auth/signin", () => {
    it("유효한 이메일과 비밀번호로 로그인 성공", async () => {
      // given
      const signinData = {
        email: "test@example.com",
        password: "password123",
      };
      const mockResult = {
        id: 1,
        email: "test@example.com",
        name: "테스트유저",
        token: "jwt_token_abc",
      };

      (mockAuthService.signin as jest.Mock).mockResolvedValueOnce(mockResult);

      // when
      const response = await request(app).post("/auth/signin").send(signinData);

      // then
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockAuthService.signin).toHaveBeenCalledWith(
        signinData.email,
        signinData.password
      );
    });

    it("잘못된 이메일 형식은 검증 실패", async () => {
      const response = await request(app).post("/auth/signin").send({
        email: "invalid-email",
        password: "password123",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("이메일이 없으면 검증 실패", async () => {
      const response = await request(app).post("/auth/signin").send({
        password: "password123",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("잘못된 이메일/비밀번호는 401 반환", async () => {
      // given
      const signinData = {
        email: "test@example.com",
        password: "wrongpassword",
      };

      const authError = new BusinessException(
        "INVALID_CREDENTIALS",
        "이메일 또는 비밀번호가 올바르지 않습니다",
        401
      );

      (mockAuthService.signin as jest.Mock).mockRejectedValueOnce(authError);

      // when
      const response = await request(app).post("/auth/signin").send(signinData);

      // then
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    });
  });
});
