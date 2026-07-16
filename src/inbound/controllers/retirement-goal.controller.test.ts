import request from "supertest";
import express from "express";
import { createRetirementGoalController } from "./retirement-goal.controller.js";
import type { RetirementGoalServiceType } from "../../application/services/retirement-goal.service.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { errorMiddleware } from "../middlewares/error.middleware.js";
import type { IJwtUtil } from "../../shared/contracts/jwt-util.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

describe("RetirementGoalController", () => {
  let app: express.Application;
  let mockRetirementGoalService: Partial<RetirementGoalServiceType>;
  let mockJwtUtil: Partial<IJwtUtil>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockRetirementGoalService = {
      create: jest.fn(),
      getByUserId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockJwtUtil = {
      sign: jest.fn().mockReturnValue("jwt_token"),
      verify: jest.fn().mockReturnValue({ userId: 1, email: "test@example.com" }),
      decode: jest.fn(),
    };

    const authMiddleware = createAuthMiddleware(mockJwtUtil as IJwtUtil);
    const retirementGoalController = createRetirementGoalController(
      mockRetirementGoalService as RetirementGoalServiceType,
    );

    app.use("/retirement-goals", authMiddleware, retirementGoalController.router);
    app.use(errorMiddleware);
  });

  describe("POST /retirement-goals", () => {
    it("유효한 데이터로 정년 목표 생성 성공", async () => {
      // given
      const createData = {
        birthYear: 1980,
        retirementYear: 2045,
        monthlyLivingExpense: 3000000,
        nationalPension: 1500000,
        retirementAsset: 500000000,
      };
      const mockResult = { id: 1, ...createData };

      (mockRetirementGoalService.create as jest.Mock).mockResolvedValueOnce(mockResult);

      // when
      const response = await request(app)
        .post("/retirement-goals")
        .set("Authorization", "Bearer valid_token")
        .send(createData);

      // then
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockRetirementGoalService.create).toHaveBeenCalledWith(1, createData);
    });

    it("필수 필드가 없으면 검증 실패", async () => {
      const response = await request(app)
        .post("/retirement-goals")
        .set("Authorization", "Bearer valid_token")
        .send({
          birthYear: 1980,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("INVALID_REQUEST");
    });

    it("월 생활비가 음수면 검증 실패", async () => {
      const response = await request(app)
        .post("/retirement-goals")
        .set("Authorization", "Bearer valid_token")
        .send({
          birthYear: 1980,
          retirementYear: 2045,
          monthlyLivingExpense: -1000,
          nationalPension: 1500000,
          retirementAsset: 500000000,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain("월 생활비");
    });

    it("인증 없이 접근하면 401 반환", async () => {
      const response = await request(app).post("/retirement-goals").send({
        birthYear: 1980,
        retirementYear: 2045,
        monthlyLivingExpense: 3000000,
        nationalPension: 1500000,
        retirementAsset: 500000000,
      });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /retirement-goals/me", () => {
    it("사용자의 정년 목표 조회 성공", async () => {
      // given
      const mockGoal = {
        id: 1,
        birthYear: 1980,
        retirementYear: 2045,
        monthlyLivingExpense: 3000000,
        nationalPension: 1500000,
        retirementAsset: 500000000,
      };

      (mockRetirementGoalService.getByUserId as jest.Mock).mockResolvedValueOnce(mockGoal);

      // when
      const response = await request(app)
        .get("/retirement-goals/me")
        .set("Authorization", "Bearer valid_token");

      // then
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockGoal);
      expect(mockRetirementGoalService.getByUserId).toHaveBeenCalledWith(1);
    });

    it("존재하지 않는 정년 목표는 404 반환", async () => {
      // given
      const notFoundError = new BusinessException(
        "RETIREMENT_GOAL_NOT_FOUND",
        "정년 목표를 찾을 수 없습니다",
        404,
      );

      (mockRetirementGoalService.getByUserId as jest.Mock).mockRejectedValueOnce(notFoundError);

      // when
      const response = await request(app)
        .get("/retirement-goals/me")
        .set("Authorization", "Bearer valid_token");

      // then
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("RETIREMENT_GOAL_NOT_FOUND");
    });

    it("인증 없이 접근하면 401 반환", async () => {
      const response = await request(app).get("/retirement-goals/me");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("PATCH /retirement-goals/me", () => {
    it("정년 목표 업데이트 성공", async () => {
      // given
      const updateData = { monthlyLivingExpense: 4000000 };
      const mockResult = {
        id: 1,
        birthYear: 1980,
        retirementYear: 2045,
        monthlyLivingExpense: 4000000,
        nationalPension: 1500000,
        retirementAsset: 500000000,
      };

      (mockRetirementGoalService.update as jest.Mock).mockResolvedValueOnce(mockResult);

      // when
      const response = await request(app)
        .patch("/retirement-goals/me")
        .set("Authorization", "Bearer valid_token")
        .send(updateData);

      // then
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.monthlyLivingExpense).toBe(4000000);
      expect(mockRetirementGoalService.update).toHaveBeenCalledWith(1, updateData);
    });

    it("월 생활비가 음수인 업데이트는 검증 실패", async () => {
      const response = await request(app)
        .patch("/retirement-goals/me")
        .set("Authorization", "Bearer valid_token")
        .send({ monthlyLivingExpense: -1000 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_REQUEST");
    });

    it("존재하지 않는 정년 목표를 업데이트하면 404 반환", async () => {
      // given
      const notFoundError = new BusinessException(
        "RETIREMENT_GOAL_NOT_FOUND",
        "정년 목표를 찾을 수 없습니다",
        404,
      );

      (mockRetirementGoalService.update as jest.Mock).mockRejectedValueOnce(notFoundError);

      // when
      const response = await request(app)
        .patch("/retirement-goals/me")
        .set("Authorization", "Bearer valid_token")
        .send({ monthlyLivingExpense: 4000000 });

      // then
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("RETIREMENT_GOAL_NOT_FOUND");
    });
  });

  describe("DELETE /retirement-goals/me", () => {
    it("정년 목표 삭제 성공", async () => {
      (mockRetirementGoalService.delete as jest.Mock).mockResolvedValueOnce(undefined);

      const response = await request(app)
        .delete("/retirement-goals/me")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(204);
      expect(mockRetirementGoalService.delete).toHaveBeenCalledWith(1);
    });

    it("존재하지 않는 정년 목표를 삭제하면 404 반환", async () => {
      // given
      const notFoundError = new BusinessException(
        "RETIREMENT_GOAL_NOT_FOUND",
        "정년 목표를 찾을 수 없습니다",
        404,
      );

      (mockRetirementGoalService.delete as jest.Mock).mockRejectedValueOnce(notFoundError);

      // when
      const response = await request(app)
        .delete("/retirement-goals/me")
        .set("Authorization", "Bearer valid_token");

      // then
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("RETIREMENT_GOAL_NOT_FOUND");
    });

    it("인증 없이 접근하면 401 반환", async () => {
      const response = await request(app).delete("/retirement-goals/me");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });
});
