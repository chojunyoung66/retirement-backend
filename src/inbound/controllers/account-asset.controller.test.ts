import request from "supertest";
import express from "express";
import { createAccountAssetController } from "./account-asset.controller.js";
import type { AccountAssetServiceType } from "../../application/services/account-asset.service.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { errorMiddleware } from "../middlewares/error.middleware.js";
import type { IJwtUtil } from "../../shared/contracts/jwt-util.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

describe("AccountAssetController", () => {
  let app: express.Application;
  let service: { [K in keyof AccountAssetServiceType]: jest.Mock };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    service = {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteAll: jest.fn(),
    };
    const jwtUtil: Partial<IJwtUtil> = {
      sign: jest.fn(),
      verify: jest.fn().mockReturnValue({ userId: 1, email: "test@example.com" }),
      decode: jest.fn(),
    };
    const authMiddleware = createAuthMiddleware(jwtUtil as IJwtUtil);
    const controller = createAccountAssetController(
      service as unknown as AccountAssetServiceType,
    );
    app.use("/account-assets", authMiddleware, controller.router);
    app.use(errorMiddleware);
  });

  const auth = { Authorization: "Bearer valid_token" };

  it("인증 없이 접근하면 401", async () => {
    const response = await request(app).get("/account-assets");
    expect(response.status).toBe(401);
    expect(service.list).not.toHaveBeenCalled();
  });

  it("목록을 조회한다", async () => {
    service.list.mockResolvedValueOnce([]);
    const response = await request(app).get("/account-assets").set(auth);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(service.list).toHaveBeenCalledWith(1);
  });

  it("생성 시 기본값을 채워 서비스에 전달한다", async () => {
    service.create.mockImplementationOnce(async (_userId, data) => ({ id: 3, userId: 1, ...data }));
    const response = await request(app)
      .post("/account-assets")
      .set(auth)
      .send({ accountType: "CASH", balance: 1_000_000, accountName: "  " });

    expect(response.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith(1, {
      accountType: "CASH",
      accountName: null,
      institution: null,
      balance: 1_000_000,
      principalTaxCredited: 0,
      principalNonDeductible: 0,
      investmentGain: 0,
      deferredRetirementIncome: 0,
      irpSource: null,
      pensionSavingsLegacy: null,
      isaMaturityYm: null,
    });
  });

  it.each([
    [{ accountType: "SAVINGS", balance: 1 }],
    [{ accountType: "CASH", balance: -1 }],
    [{ accountType: "CASH", balance: 1.5 }],
    [{ accountType: "CASH", balance: 3_000_000_000 }],
    [{ accountType: "ISA", balance: 1, isaMaturityYm: "2027-13" }],
    [{ accountType: "CASH" }],
  ])("형식이 맞지 않으면 400 (%j)", async (body) => {
    const response = await request(app).post("/account-assets").set(auth).send(body);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUEST");
    expect(service.create).not.toHaveBeenCalled();
  });

  it("에러 메시지에 금액 원문을 넣지 않는다", async () => {
    const response = await request(app)
      .post("/account-assets")
      .set(auth)
      .send({ accountType: "CASH", balance: 3_123_456_789 });
    expect(response.status).toBe(400);
    expect(response.body.error.message).not.toContain("3123456789");
  });

  it("20개 제한 등 서비스 오류를 그대로 전달한다", async () => {
    service.create.mockRejectedValueOnce(
      new BusinessException("ACCOUNT_ASSET_LIMIT", "계좌는 최대 20개까지 등록할 수 있습니다", 400),
    );
    const response = await request(app)
      .post("/account-assets")
      .set(auth)
      .send({ accountType: "CASH", balance: 1 });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("ACCOUNT_ASSET_LIMIT");
  });

  it("부분 수정은 보낸 항목만 서비스에 전달한다", async () => {
    service.update.mockResolvedValueOnce({ id: 2 });
    const response = await request(app)
      .patch("/account-assets/2")
      .set(auth)
      .send({ balance: 5_000_000 });
    expect(response.status).toBe(200);
    expect(service.update).toHaveBeenCalledWith(2, 1, { balance: 5_000_000 });
  });

  it("빈 수정은 400", async () => {
    const response = await request(app).patch("/account-assets/2").set(auth).send({});
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_UPDATE");
  });

  it("다른 사용자의 계좌는 403", async () => {
    service.update.mockRejectedValueOnce(
      new BusinessException("ACCOUNT_ASSET_FORBIDDEN", "접근 권한이 없습니다", 403),
    );
    const response = await request(app)
      .patch("/account-assets/9")
      .set(auth)
      .send({ balance: 1 });
    expect(response.status).toBe(403);
  });

  it("없는 계좌 삭제는 404", async () => {
    service.delete.mockRejectedValueOnce(
      new BusinessException("ACCOUNT_ASSET_NOT_FOUND", "계좌를 찾을 수 없습니다", 404),
    );
    const response = await request(app).delete("/account-assets/99").set(auth);
    expect(response.status).toBe(404);
  });

  it("잘못된 ID는 400", async () => {
    const response = await request(app).delete("/account-assets/abc").set(auth);
    expect(response.status).toBe(400);
    expect(service.delete).not.toHaveBeenCalled();
  });

  it("전체 삭제는 삭제 건수를 반환한다", async () => {
    service.deleteAll.mockResolvedValueOnce(4);
    const response = await request(app).delete("/account-assets").set(auth);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ deletedCount: 4 });
    expect(service.deleteAll).toHaveBeenCalledWith(1);
  });
});
