import request from "supertest";
import express from "express";
import { createAuthMiddleware } from "./auth.middleware.js";
import { errorMiddleware } from "./error.middleware.js";
import type { IJwtUtil } from "../../shared/contracts/jwt-util.contract.js";

describe("AuthMiddleware", () => {
  let app: express.Application;
  let mockJwtUtil: Partial<IJwtUtil>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockJwtUtil = {
      sign: jest.fn(),
      verify: jest.fn(),
      decode: jest.fn(),
    };

    const authMiddleware = createAuthMiddleware(mockJwtUtil as IJwtUtil);

    // 인증이 성공했을 때 도달할 임의의 보호 라우트
    app.get("/protected", authMiddleware, (req, res) => {
      res.status(200).json({
        success: true,
        data: { userId: req.userId },
      });
    });

    app.use(errorMiddleware);
  });

  it("해피패스: 유효한 Bearer 토큰이면 다음 핸들러로 진행", async () => {
    // given
    (mockJwtUtil.verify as jest.Mock).mockReturnValueOnce({
      userId: 42,
      email: "test@example.com",
    });

    // when
    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer valid.jwt.token");

    // then
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.userId).toBe(42);
    expect(mockJwtUtil.verify).toHaveBeenCalledWith("valid.jwt.token");
  });

  it("Authorization 헤더가 없으면 401 UNAUTHORIZED", async () => {
    // when
    const response = await request(app).get("/protected");

    // then
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    // 토큰 검증 자체가 시도되지 않아야 함
    expect(mockJwtUtil.verify).not.toHaveBeenCalled();
  });

  it("Authorization 헤더에 'Bearer ' 접두사가 없으면 401 UNAUTHORIZED", async () => {
    // when
    const response = await request(app)
      .get("/protected")
      .set("Authorization", "raw.jwt.token.without.bearer");

    // then
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    // Bearer 접두사 없으면 jwtUtil.verify까지 도달하지 않아야 함
    expect(mockJwtUtil.verify).not.toHaveBeenCalled();
  });

  it("잘못된 형식(garbage)의 JWT면 401 UNAUTHORIZED", async () => {
    // given: jwt.verify가 malformed 에러 던지는 상황을 흉내
    (mockJwtUtil.verify as jest.Mock).mockImplementationOnce(() => {
      throw new Error("jwt malformed");
    });

    // when
    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer this-is-not-a-jwt");

    // then
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(mockJwtUtil.verify).toHaveBeenCalledWith("this-is-not-a-jwt");
  });

  it("만료된 JWT면 401 UNAUTHORIZED", async () => {
    // given: jwt.verify가 TokenExpiredError처럼 예외를 던지는 상황
    (mockJwtUtil.verify as jest.Mock).mockImplementationOnce(() => {
      throw new Error("jwt expired");
    });

    // when
    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer expired.jwt.token");

    // then
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(mockJwtUtil.verify).toHaveBeenCalledWith("expired.jwt.token");
  });
});
