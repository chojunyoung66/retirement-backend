import request from "supertest";
import express from "express";
import { createSimulationController } from "./simulation.controller.js";
import type { SimulationServiceType } from "../../application/services/simulation.service.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { errorMiddleware } from "../middlewares/error.middleware.js";
import type { IJwtUtil } from "../../shared/contracts/jwt-util.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

describe("SimulationController", () => {
  let app: express.Application;
  let mockSimulationService: Partial<SimulationServiceType>;
  let mockJwtUtil: Partial<IJwtUtil>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockSimulationService = {
      createHealthInsurance: jest.fn(),
      getLatestHealthInsurance: jest.fn(),
      createIsa: jest.fn(),
      getLatestIsa: jest.fn(),
      createNationalPension: jest.fn(),
      getLatestNationalPension: jest.fn(),
      createIrp: jest.fn(),
      getLatestIrp: jest.fn(),
      createSeverancePay: jest.fn(),
      getLatestSeverancePay: jest.fn(),
      createUnemploymentBenefit: jest.fn(),
      getLatestUnemploymentBenefit: jest.fn(),
      getSimulationById: jest.fn(),
      deleteSimulation: jest.fn(),
      updateSimulation: jest.fn(),
    };

    mockJwtUtil = {
      sign: jest.fn().mockReturnValue("jwt_token"),
      verify: jest.fn().mockReturnValue({ userId: 1, email: "test@example.com" }),
      decode: jest.fn(),
    };

    const authMiddleware = createAuthMiddleware(mockJwtUtil as IJwtUtil);
    const simulationController = createSimulationController(
      mockSimulationService as SimulationServiceType,
    );

    app.use("/simulations", authMiddleware, simulationController.router);
    app.use(errorMiddleware);
  });

  describe("POST /simulations/health-insurance", () => {
    it("유효한 데이터로 건강보험 시뮬레이션 생성 성공", async () => {
      // given
      const inputBody = {
        pensionIncome: 24000000,
        laborIncome: 0,
        businessIncome: 0,
        interestDividendIncome: 5000000,
        otherIncome: 0,
        propertyValue: 300000000,
        carValue: 20000000,
      };
      const mockResult = {
        id: 1,
        userId: 1,
        type: "HEALTH_INSURANCE",
        version: 1,
        status: "draft",
        inputData: inputBody,
        outputData: { estimatedMonthlyPremium: 200000 },
      };

      (mockSimulationService.createHealthInsurance as jest.Mock).mockResolvedValueOnce(mockResult);

      // when
      const response = await request(app)
        .post("/simulations/health-insurance")
        .set("Authorization", "Bearer valid_token")
        .send(inputBody);

      // then
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockSimulationService.createHealthInsurance).toHaveBeenCalledWith(
        1,
        expect.objectContaining(inputBody),
        expect.any(Object),
      );
    });

    it("음수 소득 값은 검증 실패", async () => {
      const response = await request(app)
        .post("/simulations/health-insurance")
        .set("Authorization", "Bearer valid_token")
        .send({
          pensionIncome: -1000,
          laborIncome: 0,
          businessIncome: 0,
          interestDividendIncome: 0,
          otherIncome: 0,
          propertyValue: 0,
          carValue: 0,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_REQUEST");
    });

    it("인증 없이 접근하면 401 반환", async () => {
      const response = await request(app).post("/simulations/health-insurance").send({});

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /simulations/health-insurance/latest", () => {
    it("최신 건강보험 시뮬레이션 조회 성공", async () => {
      // given
      const mockResult = {
        id: 1,
        userId: 1,
        type: "HEALTH_INSURANCE",
        version: 1,
        status: "draft",
        inputData: {},
        outputData: {},
      };

      (mockSimulationService.getLatestHealthInsurance as jest.Mock).mockResolvedValueOnce(
        mockResult,
      );

      // when
      const response = await request(app)
        .get("/simulations/health-insurance/latest")
        .set("Authorization", "Bearer valid_token");

      // then
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockSimulationService.getLatestHealthInsurance).toHaveBeenCalledWith(1);
    });

    it("건강보험 시뮬레이션이 없으면 404 반환", async () => {
      const notFoundError = new BusinessException(
        "HEALTH_INSURANCE_SIMULATION_NOT_FOUND",
        "건강보험 시뮬레이션을 찾을 수 없습니다",
        404,
      );

      (mockSimulationService.getLatestHealthInsurance as jest.Mock).mockRejectedValueOnce(
        notFoundError,
      );

      const response = await request(app)
        .get("/simulations/health-insurance/latest")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("HEALTH_INSURANCE_SIMULATION_NOT_FOUND");
    });
  });

  describe("POST /simulations/isa", () => {
    it("유효한 데이터로 ISA 시뮬레이션 생성 성공", async () => {
      // given
      const inputBody = {
        annualContribution: 10000000,
        expectedReturnRate: 5.5,
        investmentYears: 10,
      };
      const mockResult = {
        id: 2,
        userId: 1,
        type: "ISA",
        version: 1,
        status: "draft",
        inputData: inputBody,
        outputData: { expectedProfit: 100000 },
      };

      (mockSimulationService.createIsa as jest.Mock).mockResolvedValueOnce(mockResult);

      // when
      const response = await request(app)
        .post("/simulations/isa")
        .set("Authorization", "Bearer valid_token")
        .send(inputBody);

      // then
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockSimulationService.createIsa).toHaveBeenCalledWith(
        1,
        inputBody,
        expect.any(Object),
      );
    });

    it("기대수익률 30% 초과는 검증 실패", async () => {
      const response = await request(app)
        .post("/simulations/isa")
        .set("Authorization", "Bearer valid_token")
        .send({
          annualContribution: 10000000,
          expectedReturnRate: 40,
          investmentYears: 10,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_REQUEST");
      expect(response.body.error.message).toContain("30");
    });

    it("투자기간 0년은 검증 실패", async () => {
      const response = await request(app)
        .post("/simulations/isa")
        .set("Authorization", "Bearer valid_token")
        .send({
          annualContribution: 10000000,
          expectedReturnRate: 5,
          investmentYears: 0,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_REQUEST");
    });
  });

  describe("GET /simulations/isa/latest", () => {
    it("최신 ISA 시뮬레이션 조회 성공", async () => {
      const mockResult = {
        id: 2,
        userId: 1,
        type: "ISA",
        version: 1,
        status: "draft",
        inputData: {},
        outputData: {},
      };

      (mockSimulationService.getLatestIsa as jest.Mock).mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .get("/simulations/isa/latest")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockResult);
      expect(mockSimulationService.getLatestIsa).toHaveBeenCalledWith(1);
    });
  });

  describe("POST /simulations/national-pension", () => {
    it("유효한 데이터로 국민연금 시뮬레이션 생성 성공", async () => {
      const inputBody = {
        monthlyIncome: 4000000,
        contributionYears: 25,
        birthYear: 1970,
      };
      const mockResult = {
        id: 3,
        userId: 1,
        type: "NATIONAL_PENSION",
        version: 1,
        status: "draft",
        inputData: inputBody,
        outputData: {},
      };

      (mockSimulationService.createNationalPension as jest.Mock).mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post("/simulations/national-pension")
        .set("Authorization", "Bearer valid_token")
        .send(inputBody);

      expect(response.status).toBe(201);
      expect(response.body.data).toEqual(mockResult);
      expect(mockSimulationService.createNationalPension).toHaveBeenCalledWith(
        1,
        inputBody,
        expect.any(Object),
      );
    });

    it("출생연도 1950 이전은 검증 실패", async () => {
      const response = await request(app)
        .post("/simulations/national-pension")
        .set("Authorization", "Bearer valid_token")
        .send({
          monthlyIncome: 4000000,
          contributionYears: 25,
          birthYear: 1900,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_REQUEST");
    });
  });

  describe("GET /simulations/national-pension/latest", () => {
    it("최신 국민연금 시뮬레이션 조회 성공", async () => {
      const mockResult = {
        id: 3,
        userId: 1,
        type: "NATIONAL_PENSION",
        version: 1,
        status: "draft",
        inputData: {},
        outputData: {},
      };

      (mockSimulationService.getLatestNationalPension as jest.Mock).mockResolvedValueOnce(
        mockResult,
      );

      const response = await request(app)
        .get("/simulations/national-pension/latest")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockResult);
      expect(mockSimulationService.getLatestNationalPension).toHaveBeenCalledWith(1);
    });
  });

  describe("POST /simulations/irp", () => {
    it("유효한 데이터로 IRP 시뮬레이션 생성 성공", async () => {
      const inputBody = {
        annualContribution: 7000000,
        expectedReturnRate: 5,
        investmentYears: 20,
        annualIncome: 60000000,
      };
      const mockResult = {
        id: 4,
        userId: 1,
        type: "IRP",
        version: 1,
        status: "draft",
        inputData: inputBody,
        outputData: {},
      };

      (mockSimulationService.createIrp as jest.Mock).mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post("/simulations/irp")
        .set("Authorization", "Bearer valid_token")
        .send(inputBody);

      expect(response.status).toBe(201);
      expect(response.body.data).toEqual(mockResult);
      expect(mockSimulationService.createIrp).toHaveBeenCalledWith(
        1,
        inputBody,
        expect.any(Object),
      );
    });

    it("연 소득 없이 요청하면 검증 실패", async () => {
      const response = await request(app)
        .post("/simulations/irp")
        .set("Authorization", "Bearer valid_token")
        .send({
          annualContribution: 7000000,
          expectedReturnRate: 5,
          investmentYears: 20,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_REQUEST");
    });
  });

  describe("GET /simulations/irp/latest", () => {
    it("최신 IRP 시뮬레이션 조회 성공", async () => {
      const mockResult = {
        id: 4,
        userId: 1,
        type: "IRP",
        version: 1,
        status: "draft",
        inputData: {},
        outputData: {},
      };

      (mockSimulationService.getLatestIrp as jest.Mock).mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .get("/simulations/irp/latest")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockResult);
      expect(mockSimulationService.getLatestIrp).toHaveBeenCalledWith(1);
    });
  });

  describe("POST /simulations/severance-pay", () => {
    it("유효한 데이터로 퇴직금 시뮬레이션 생성 성공", async () => {
      const inputBody = {
        averageMonthlyWage: 4500000,
        yearsOfService: 20,
      };
      const mockResult = {
        id: 5,
        userId: 1,
        type: "SEVERANCE_PAY",
        version: 1,
        status: "draft",
        inputData: inputBody,
        outputData: {},
      };

      (mockSimulationService.createSeverancePay as jest.Mock).mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post("/simulations/severance-pay")
        .set("Authorization", "Bearer valid_token")
        .send(inputBody);

      expect(response.status).toBe(201);
      expect(response.body.data).toEqual(mockResult);
      expect(mockSimulationService.createSeverancePay).toHaveBeenCalledWith(
        1,
        inputBody,
        expect.any(Object),
      );
    });

    it("평균 월 임금이 음수면 검증 실패", async () => {
      const response = await request(app)
        .post("/simulations/severance-pay")
        .set("Authorization", "Bearer valid_token")
        .send({
          averageMonthlyWage: -1000,
          yearsOfService: 20,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_REQUEST");
    });
  });

  describe("GET /simulations/severance-pay/latest", () => {
    it("최신 퇴직금 시뮬레이션 조회 성공", async () => {
      const mockResult = {
        id: 5,
        userId: 1,
        type: "SEVERANCE_PAY",
        version: 1,
        status: "draft",
        inputData: {},
        outputData: {},
      };

      (mockSimulationService.getLatestSeverancePay as jest.Mock).mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .get("/simulations/severance-pay/latest")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockResult);
      expect(mockSimulationService.getLatestSeverancePay).toHaveBeenCalledWith(1);
    });
  });

  describe("POST /simulations/unemployment-benefit", () => {
    it("유효한 데이터로 실업급여 시뮬레이션 생성 성공", async () => {
      const inputBody = {
        averageMonthlyWage: 4000000,
        insuranceYears: 15,
        age: 60,
      };
      const mockResult = {
        id: 6,
        userId: 1,
        type: "UNEMPLOYMENT_BENEFIT",
        version: 1,
        status: "draft",
        inputData: inputBody,
        outputData: {},
      };

      (mockSimulationService.createUnemploymentBenefit as jest.Mock).mockResolvedValueOnce(
        mockResult,
      );

      const response = await request(app)
        .post("/simulations/unemployment-benefit")
        .set("Authorization", "Bearer valid_token")
        .send(inputBody);

      expect(response.status).toBe(201);
      expect(response.body.data).toEqual(mockResult);
      expect(mockSimulationService.createUnemploymentBenefit).toHaveBeenCalledWith(
        1,
        inputBody,
        expect.any(Object),
      );
    });

    it("나이가 18 미만이면 검증 실패", async () => {
      const response = await request(app)
        .post("/simulations/unemployment-benefit")
        .set("Authorization", "Bearer valid_token")
        .send({
          averageMonthlyWage: 4000000,
          insuranceYears: 15,
          age: 10,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_REQUEST");
    });
  });

  describe("GET /simulations/unemployment-benefit/latest", () => {
    it("최신 실업급여 시뮬레이션 조회 성공", async () => {
      const mockResult = {
        id: 6,
        userId: 1,
        type: "UNEMPLOYMENT_BENEFIT",
        version: 1,
        status: "draft",
        inputData: {},
        outputData: {},
      };

      (mockSimulationService.getLatestUnemploymentBenefit as jest.Mock).mockResolvedValueOnce(
        mockResult,
      );

      const response = await request(app)
        .get("/simulations/unemployment-benefit/latest")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockResult);
      expect(mockSimulationService.getLatestUnemploymentBenefit).toHaveBeenCalledWith(1);
    });
  });

  describe("GET /simulations/:id", () => {
    it("시뮬레이션 단건 조회 성공", async () => {
      const mockResult = {
        id: 1,
        userId: 1,
        type: "ISA",
        version: 1,
        status: "draft",
        inputData: {},
        outputData: {},
      };

      (mockSimulationService.getSimulationById as jest.Mock).mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .get("/simulations/1")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockResult);
      expect(mockSimulationService.getSimulationById).toHaveBeenCalledWith(1, 1);
    });

    it("유효하지 않은 ID는 400 반환", async () => {
      const response = await request(app)
        .get("/simulations/invalid")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_REQUEST");
    });

    it("존재하지 않는 시뮬레이션은 404 반환", async () => {
      const notFoundError = new BusinessException(
        "SIMULATION_NOT_FOUND",
        "시뮬레이션을 찾을 수 없습니다",
        404,
      );

      (mockSimulationService.getSimulationById as jest.Mock).mockRejectedValueOnce(notFoundError);

      const response = await request(app)
        .get("/simulations/999")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("SIMULATION_NOT_FOUND");
    });

    it("다른 유저의 시뮬레이션 조회 시 403 반환", async () => {
      const forbiddenError = new BusinessException(
        "SIMULATION_FORBIDDEN",
        "접근 권한이 없습니다",
        403,
      );

      (mockSimulationService.getSimulationById as jest.Mock).mockRejectedValueOnce(forbiddenError);

      const response = await request(app)
        .get("/simulations/1")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("SIMULATION_FORBIDDEN");
    });
  });

  describe("DELETE /simulations/:id", () => {
    it("시뮬레이션 삭제 성공", async () => {
      (mockSimulationService.deleteSimulation as jest.Mock).mockResolvedValueOnce(undefined);

      const response = await request(app)
        .delete("/simulations/1")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockSimulationService.deleteSimulation).toHaveBeenCalledWith(1, 1);
    });

    it("유효하지 않은 ID는 400 반환", async () => {
      const response = await request(app)
        .delete("/simulations/invalid")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_REQUEST");
    });

    it("다른 유저의 시뮬레이션 삭제 시 403 반환", async () => {
      const forbiddenError = new BusinessException(
        "SIMULATION_FORBIDDEN",
        "접근 권한이 없습니다",
        403,
      );

      (mockSimulationService.deleteSimulation as jest.Mock).mockRejectedValueOnce(forbiddenError);

      const response = await request(app)
        .delete("/simulations/1")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("SIMULATION_FORBIDDEN");
    });
  });

  describe("PATCH /simulations/:id", () => {
    it("시뮬레이션 status 업데이트 성공", async () => {
      const mockResult = {
        id: 1,
        userId: 1,
        type: "ISA",
        version: 1,
        status: "confirmed",
        inputData: {},
        outputData: {},
      };

      (mockSimulationService.updateSimulation as jest.Mock).mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .patch("/simulations/1")
        .set("Authorization", "Bearer valid_token")
        .send({ status: "confirmed" });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockResult);
      expect(mockSimulationService.updateSimulation).toHaveBeenCalledWith(1, {
        status: "confirmed",
      });
    });

    it("유효하지 않은 status는 400 반환", async () => {
      const response = await request(app)
        .patch("/simulations/1")
        .set("Authorization", "Bearer valid_token")
        .send({ status: "invalid_status" });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_REQUEST");
    });

    it("유효하지 않은 ID는 400 반환", async () => {
      const response = await request(app)
        .patch("/simulations/invalid")
        .set("Authorization", "Bearer valid_token")
        .send({ status: "confirmed" });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_REQUEST");
    });

    it("존재하지 않는 시뮬레이션 업데이트 시 404 반환", async () => {
      const notFoundError = new BusinessException(
        "SIMULATION_NOT_FOUND",
        "시뮬레이션을 찾을 수 없습니다",
        404,
      );

      (mockSimulationService.updateSimulation as jest.Mock).mockRejectedValueOnce(notFoundError);

      const response = await request(app)
        .patch("/simulations/999")
        .set("Authorization", "Bearer valid_token")
        .send({ status: "confirmed" });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("SIMULATION_NOT_FOUND");
    });

    it("인증 없이 접근하면 401 반환", async () => {
      const response = await request(app)
        .patch("/simulations/1")
        .send({ status: "confirmed" });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });
});
