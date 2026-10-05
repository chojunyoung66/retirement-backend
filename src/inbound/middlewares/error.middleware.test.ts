import { jest } from "@jest/globals";
import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import { errorMiddleware, summarizeError } from "./error.middleware.js";

const buildApp = (thrown?: unknown) => {
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.post("/echo", (req: Request, res: Response) => {
    res.json({ ok: true, body: req.body });
  });
  app.get("/throw", (_req: Request, _res: Response, next: NextFunction) => {
    next(thrown);
  });
  app.use(errorMiddleware);
  return app;
};

const prismaError = (code: string) =>
  Object.assign(new Error("Invalid `prisma.user.update()` amount=4500000"), {
    name: "PrismaClientKnownRequestError",
    code,
    clientVersion: "7.0.0",
  });

describe("errorMiddleware", () => {
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("잘못된 JSON은 400 INVALID_JSON", async () => {
    const res = await request(buildApp())
      .post("/echo")
      .set("Content-Type", "application/json")
      .send("{bad json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("본문 초과는 413 PAYLOAD_TOO_LARGE", async () => {
    const res = await request(buildApp())
      .post("/echo")
      .send({ data: "x".repeat(4096) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("Prisma P2025는 404 NOT_FOUND", async () => {
    const res = await request(buildApp(prismaError("P2025"))).get("/throw");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("Prisma P2020(값 범위 초과)은 400 INVALID_REQUEST", async () => {
    const res = await request(buildApp(prismaError("P2020"))).get("/throw");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_REQUEST");
    expect(JSON.stringify(res.body)).not.toContain("4500000");
  });

  it("그 외 Prisma 에러는 500이며 원문 메시지를 로그에 남기지 않음", async () => {
    const res = await request(buildApp(prismaError("P2002"))).get("/throw");
    expect(res.status).toBe(500);
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain("4500000");
    expect(logged).toContain("P2002");
  });

  it("summarizeError는 일반 에러의 메시지를 유지", () => {
    expect(summarizeError(new Error("boom"))).toMatchObject({ name: "Error", message: "boom" });
  });
});
