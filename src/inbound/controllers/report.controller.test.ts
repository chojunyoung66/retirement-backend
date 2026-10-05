import request from "supertest";
import express from "express";
import { createReportController } from "./report.controller.js";
import type { ReportServiceType } from "../../application/services/report.service.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { errorMiddleware } from "../middlewares/error.middleware.js";
import type { IJwtUtil } from "../../shared/contracts/jwt-util.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

describe("ReportController", () => {
  let app: express.Application;
  let service: { [K in keyof ReportServiceType]: jest.Mock };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    service = {
      create: jest.fn(),
      list: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      renderPdf: jest.fn(),
    };
    const jwtUtil: Partial<IJwtUtil> = {
      sign: jest.fn(),
      verify: jest.fn().mockReturnValue({ userId: 1, email: "test@example.com" }),
      decode: jest.fn(),
    };
    const authMiddleware = createAuthMiddleware(jwtUtil as IJwtUtil);
    const controller = createReportController(service as unknown as ReportServiceType);
    app.use("/reports", authMiddleware, controller.router);
    app.use(errorMiddleware);
  });

  const auth = { Authorization: "Bearer valid_token" };

  it("인증 없이 요청하면 401", async () => {
    const created = await request(app).post("/reports").send({ scenarioSetId: 7, scenarioType: "D" });
    const pdf = await request(app).get("/reports/1/pdf");
    expect(created.status).toBe(401);
    expect(pdf.status).toBe(401);
    expect(service.create).not.toHaveBeenCalled();
    expect(service.renderPdf).not.toHaveBeenCalled();
  });

  it("리포트를 만든다", async () => {
    service.create.mockResolvedValueOnce({ id: 3 });
    const response = await request(app)
      .post("/reports")
      .set(auth)
      .send({ scenarioSetId: 7, scenarioType: "D" });
    expect(response.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith(1, { scenarioSetId: 7, scenarioType: "D" });
  });

  it.each([
    [{}],
    [{ scenarioSetId: 7 }],
    [{ scenarioSetId: 7, scenarioType: "E" }],
    [{ scenarioSetId: 0, scenarioType: "D" }],
    [{ scenarioSetId: 99_999_999_999, scenarioType: "D" }],
  ])("잘못된 생성 요청은 400 (%j)", async (body) => {
    const response = await request(app).post("/reports").set(auth).send(body);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUEST");
    expect(service.create).not.toHaveBeenCalled();
  });

  it("목록과 상세를 조회한다", async () => {
    service.list.mockResolvedValueOnce([{ id: 3 }]);
    service.get.mockResolvedValueOnce({ id: 3 });
    const list = await request(app).get("/reports").set(auth);
    const detail = await request(app).get("/reports/3").set(auth);
    expect(list.body.data).toEqual([{ id: 3 }]);
    expect(detail.status).toBe(200);
    expect(service.get).toHaveBeenCalledWith(3, 1);
  });

  it("잘못된 ID는 400", async () => {
    const response = await request(app).get("/reports/abc/pdf").set(auth);
    expect(response.status).toBe(400);
    expect(service.renderPdf).not.toHaveBeenCalled();
  });

  it("다른 사용자의 리포트는 403, 없으면 404", async () => {
    service.get
      .mockRejectedValueOnce(new BusinessException("REPORT_FORBIDDEN", "접근 권한이 없습니다", 403))
      .mockRejectedValueOnce(new BusinessException("REPORT_NOT_FOUND", "리포트를 찾을 수 없습니다", 404));
    const forbidden = await request(app).get("/reports/8").set(auth);
    const missing = await request(app).get("/reports/9").set(auth);
    expect(forbidden.status).toBe(403);
    expect(missing.status).toBe(404);
  });

  it("PDF를 첨부 파일로 내려주고 캐시하지 않는다", async () => {
    service.renderPdf.mockResolvedValueOnce(Buffer.from("%PDF-1.3 test"));
    const response = await request(app)
      .get("/reports/3/pdf")
      .set(auth)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("application/pdf");
    expect(response.headers["content-disposition"]).toBe(
      'attachment; filename="retirement-plan-3.pdf"',
    );
    expect(response.headers["cache-control"]).toBe("no-store");
    expect((response.body as Buffer).subarray(0, 4).toString()).toBe("%PDF");
    expect(service.renderPdf).toHaveBeenCalledWith(3, 1);
  });

  it("리포트를 삭제한다", async () => {
    service.delete.mockResolvedValueOnce(undefined);
    const response = await request(app).delete("/reports/3").set(auth);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ id: 3 });
    expect(service.delete).toHaveBeenCalledWith(3, 1);
  });
});
