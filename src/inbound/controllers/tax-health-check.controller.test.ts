import request from "supertest";
import express from "express";
import { createTaxHealthCheckController } from "./tax-health-check.controller.js";
import { createTaxHealthCheckService } from "../../application/services/tax-health-check.service.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { errorMiddleware } from "../middlewares/error.middleware.js";
import type { IJwtUtil } from "../../shared/contracts/jwt-util.contract.js";

describe("TaxHealthCheckController", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    const jwtUtil: Partial<IJwtUtil> = {
      sign: jest.fn(),
      verify: jest.fn().mockReturnValue({ userId: 1, email: "test@example.com" }),
      decode: jest.fn(),
    };
    const controller = createTaxHealthCheckController(createTaxHealthCheckService());
    app.use("/tax-health-check", createAuthMiddleware(jwtUtil as IJwtUtil), controller.router);
    app.use(errorMiddleware);
  });

  const auth = { Authorization: "Bearer valid_token" };

  it("인증 없이 요청하면 401", async () => {
    const response = await request(app).post("/tax-health-check").send({});
    expect(response.status).toBe(401);
  });

  it("빈 본문은 0원·재산 미입력으로 계산한다", async () => {
    const response = await request(app).post("/tax-health-check").set(auth).send({});
    expect(response.status).toBe(200);
    expect(response.body.data.dependent.status).toBe("CHECK_NEEDED");
  });

  it("음수 금액은 400이고 오류 메시지에 금액을 담지 않는다", async () => {
    const response = await request(app)
      .post("/tax-health-check")
      .set(auth)
      .send({ financialIncome: -12_345_678 });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUEST");
    expect(response.body.error.message).not.toContain("12345678");
  });
});
