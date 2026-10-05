import request from "supertest";
import express from "express";
import { createWithdrawalScenarioController } from "./withdrawal-scenario.controller.js";
import type { WithdrawalScenarioServiceType } from "../../application/services/withdrawal-scenario.service.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { errorMiddleware } from "../middlewares/error.middleware.js";
import type { IJwtUtil } from "../../shared/contracts/jwt-util.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

describe("WithdrawalScenarioController", () => {
  let app: express.Application;
  let service: { [K in keyof WithdrawalScenarioServiceType]: jest.Mock };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    service = {
      generate: jest.fn(),
      getLatest: jest.fn(),
      getPlan: jest.fn(),
      select: jest.fn(),
      deleteAll: jest.fn(),
    };
    const jwtUtil: Partial<IJwtUtil> = {
      sign: jest.fn(),
      verify: jest.fn().mockReturnValue({ userId: 1, email: "test@example.com" }),
      decode: jest.fn(),
    };
    const authMiddleware = createAuthMiddleware(jwtUtil as IJwtUtil);
    const controller = createWithdrawalScenarioController(
      service as unknown as WithdrawalScenarioServiceType,
    );
    app.use("/withdrawal-scenarios", authMiddleware, controller.router);
    app.use(errorMiddleware);
  });

  const auth = { Authorization: "Bearer valid_token" };

  it("인증 없이 생성하면 401", async () => {
    const response = await request(app).post("/withdrawal-scenarios/generate").send({});
    expect(response.status).toBe(401);
    expect(service.generate).not.toHaveBeenCalled();
  });

  it("가정값을 검증해 생성한다", async () => {
    service.generate.mockResolvedValueOnce({ id: 1 });
    const body = {
      nationalPension: { monthlyAmount: 1_200_000, startAge: 65 },
      unemployment: null,
      yearsOfService: 25,
      propertyValue: 300_000_000,
      assumptions: { inflationRate: 0.025 },
    };
    const response = await request(app)
      .post("/withdrawal-scenarios/generate")
      .set(auth)
      .send(body);
    expect(response.status).toBe(201);
    expect(service.generate).toHaveBeenCalledWith(1, body);
  });

  it("빈 본문도 허용한다", async () => {
    service.generate.mockResolvedValueOnce({ id: 1 });
    const response = await request(app).post("/withdrawal-scenarios/generate").set(auth);
    expect(response.status).toBe(201);
    expect(service.generate).toHaveBeenCalledWith(1, {});
  });

  it.each([
    [{ nationalPension: { monthlyAmount: 1, startAge: 80 } }],
    [{ unemployment: { monthlyAmount: 1, months: 12 } }],
    [{ yearsOfService: 0 }],
    [{ assumptions: { returnRate: 0.5 } }],
  ])("범위를 벗어난 가정값은 400 (%j)", async (body) => {
    const response = await request(app)
      .post("/withdrawal-scenarios/generate")
      .set(auth)
      .send(body);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUEST");
    expect(service.generate).not.toHaveBeenCalled();
  });

  it("진단·계좌가 없으면 서비스의 400 코드를 전달한다", async () => {
    service.generate.mockRejectedValueOnce(
      new BusinessException("ACCOUNT_ASSETS_REQUIRED", "계좌 자산을 1개 이상 입력해주세요", 400),
    );
    const response = await request(app).post("/withdrawal-scenarios/generate").set(auth).send({});
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("ACCOUNT_ASSETS_REQUIRED");
  });

  it("최신 세트가 없으면 null", async () => {
    service.getLatest.mockResolvedValueOnce(null);
    const response = await request(app).get("/withdrawal-scenarios/latest").set(auth);
    expect(response.status).toBe(200);
    expect(response.body.data).toBeNull();
  });

  it("시나리오 실행안을 조회한다", async () => {
    service.getPlan.mockResolvedValueOnce({ setId: 7 });
    const response = await request(app).get("/withdrawal-scenarios/7/plans/D").set(auth);
    expect(response.status).toBe(200);
    expect(service.getPlan).toHaveBeenCalledWith(7, 1, "D");
  });

  it("잘못된 시나리오 유형은 400", async () => {
    const response = await request(app).get("/withdrawal-scenarios/7/plans/E").set(auth);
    expect(response.status).toBe(400);
    expect(service.getPlan).not.toHaveBeenCalled();
  });

  it("다른 사용자의 세트는 403, 없으면 404", async () => {
    service.getPlan
      .mockRejectedValueOnce(new BusinessException("SCENARIO_SET_FORBIDDEN", "접근 권한이 없습니다", 403))
      .mockRejectedValueOnce(
        new BusinessException("SCENARIO_SET_NOT_FOUND", "인출 시나리오를 찾을 수 없습니다", 404),
      );
    const forbidden = await request(app).get("/withdrawal-scenarios/8/plans/A").set(auth);
    const missing = await request(app).get("/withdrawal-scenarios/9/plans/A").set(auth);
    expect(forbidden.status).toBe(403);
    expect(missing.status).toBe(404);
  });

  it("선택한 시나리오를 저장한다", async () => {
    service.select.mockResolvedValueOnce({ id: 7, selectedType: "B" });
    const response = await request(app)
      .patch("/withdrawal-scenarios/7/selection")
      .set(auth)
      .send({ selectedType: "B" });
    expect(response.status).toBe(200);
    expect(service.select).toHaveBeenCalledWith(7, 1, "B");
  });

  it("본인 세트 전체를 삭제한다", async () => {
    service.deleteAll.mockResolvedValueOnce(2);
    const response = await request(app).delete("/withdrawal-scenarios").set(auth);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ deletedCount: 2 });
    expect(service.deleteAll).toHaveBeenCalledWith(1);
  });

  it("선택 유형이 없으면 400", async () => {
    const response = await request(app)
      .patch("/withdrawal-scenarios/7/selection")
      .set(auth)
      .send({ selectedType: "Z" });
    expect(response.status).toBe(400);
    expect(service.select).not.toHaveBeenCalled();
  });
});
