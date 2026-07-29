import request from "supertest";
import express from "express";
import { createDiagnosisController } from "./diagnosis.controller.js";
import type { DiagnosisServiceType } from "../../application/services/diagnosis.service.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { errorMiddleware } from "../middlewares/error.middleware.js";
import type { IJwtUtil } from "../../shared/contracts/jwt-util.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

describe("DiagnosisController", () => {
  let app: express.Application;
  let mockDiagnosisService: Partial<DiagnosisServiceType>;
  let mockJwtUtil: Partial<IJwtUtil>;

  const diagnosisBody = {
    householdType: "single",
    birthYear: 1980,
    retirementYear: 2045,
    monthlyIncome: 4000000,
    monthlyExpense: 2500000,
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockDiagnosisService = {
      getLatest: jest.fn(),
      saveLatest: jest.fn(),
      deleteLatest: jest.fn(),
    };

    mockJwtUtil = {
      sign: jest.fn().mockReturnValue("jwt_token"),
      verify: jest.fn().mockReturnValue({ userId: 1, email: "test@example.com" }),
      decode: jest.fn(),
    };

    const authMiddleware = createAuthMiddleware(mockJwtUtil as IJwtUtil);
    const diagnosisController = createDiagnosisController(
      mockDiagnosisService as DiagnosisServiceType,
    );

    app.use("/diagnoses", authMiddleware, diagnosisController.router);
    app.use(errorMiddleware);
  });

  describe("GET /diagnoses/me/latest", () => {
    it("저장된 진단 결과 조회 성공", async () => {
      const mockDiagnosis = {
        id: 1,
        userId: 1,
        ...diagnosisBody,
        updatedAt: "2026-07-29T00:00:00.000Z",
      };
      (mockDiagnosisService.getLatest as jest.Mock).mockResolvedValueOnce(
        mockDiagnosis,
      );

      const response = await request(app)
        .get("/diagnoses/me/latest")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockDiagnosis);
      expect(mockDiagnosisService.getLatest).toHaveBeenCalledWith(1);
    });

    it("진단 결과가 없으면 data: null 반환", async () => {
      (mockDiagnosisService.getLatest as jest.Mock).mockResolvedValueOnce(null);

      const response = await request(app)
        .get("/diagnoses/me/latest")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
    });

    it("인증 없이 접근하면 401 반환", async () => {
      const response = await request(app).get("/diagnoses/me/latest");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("PUT /diagnoses/me/latest", () => {
    it("진단 결과 저장 성공", async () => {
      const mockSaved = {
        id: 1,
        userId: 1,
        ...diagnosisBody,
        updatedAt: "2026-07-29T00:00:00.000Z",
      };
      (mockDiagnosisService.saveLatest as jest.Mock).mockResolvedValueOnce(
        mockSaved,
      );

      const response = await request(app)
        .put("/diagnoses/me/latest")
        .set("Authorization", "Bearer valid_token")
        .send(diagnosisBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSaved);
      expect(mockDiagnosisService.saveLatest).toHaveBeenCalledWith(
        1,
        diagnosisBody,
      );
    });

    it("필수 필드가 없으면 INVALID_REQUEST", async () => {
      const response = await request(app)
        .put("/diagnoses/me/latest")
        .set("Authorization", "Bearer valid_token")
        .send({ birthYear: 1980 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("INVALID_REQUEST");
      expect(mockDiagnosisService.saveLatest).not.toHaveBeenCalled();
    });

    it("인증 없이 접근하면 401 반환", async () => {
      const response = await request(app)
        .put("/diagnoses/me/latest")
        .send(diagnosisBody);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("DELETE /diagnoses/me/latest", () => {
    it("진단 결과 삭제 성공", async () => {
      (mockDiagnosisService.deleteLatest as jest.Mock).mockResolvedValueOnce(
        undefined,
      );

      const response = await request(app)
        .delete("/diagnoses/me/latest")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(204);
      expect(mockDiagnosisService.deleteLatest).toHaveBeenCalledWith(1);
    });

    it("없으면 DIAGNOSIS_NOT_FOUND 404", async () => {
      (mockDiagnosisService.deleteLatest as jest.Mock).mockRejectedValueOnce(
        new BusinessException(
          "DIAGNOSIS_NOT_FOUND",
          "진단 결과를 찾을 수 없습니다",
          404,
        ),
      );

      const response = await request(app)
        .delete("/diagnoses/me/latest")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("DIAGNOSIS_NOT_FOUND");
    });
  });
});
