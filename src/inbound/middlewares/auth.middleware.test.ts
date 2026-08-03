import request from "supertest";
import cookieParser from "cookie-parser";
import express from "express";
import { createAuthMiddleware } from "./auth.middleware.js";
import { errorMiddleware } from "./error.middleware.js";
import type { IJwtUtil } from "../../shared/contracts/jwt-util.contract.js";
import { AUTH_COOKIE_NAME } from "../utils/auth-cookie.js";

describe("AuthMiddleware", () => {
  let app: express.Application;
  let mockJwtUtil: Partial<IJwtUtil>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());

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

  it("해피패스: 유효한 Bearer 토큰이면 다음 핸들러로 진행하고 세션을 슬라이딩 갱신", async () => {
    const sessionStartedAt = Date.now();
    (mockJwtUtil.verify as jest.Mock).mockReturnValueOnce({
      userId: 42,
      email: "test@example.com",
      sessionStartedAt,
    });
    (mockJwtUtil.sign as jest.Mock).mockReturnValueOnce("refreshed.jwt.token");

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer valid.jwt.token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.userId).toBe(42);
    expect(mockJwtUtil.verify).toHaveBeenCalledWith("valid.jwt.token");
    expect(mockJwtUtil.sign).toHaveBeenCalled();
    const setCookie = response.headers["set-cookie"];
    const cookieText = Array.isArray(setCookie)
      ? setCookie.join(" ")
      : (setCookie ?? "");
    expect(cookieText).toContain("retirement_token=");
  });

  it("해피패스: HttpOnly 쿠키 토큰이면 다음 핸들러로 진행", async () => {
    (mockJwtUtil.verify as jest.Mock).mockReturnValueOnce({
      userId: 7,
      email: "cookie@example.com",
      sessionStartedAt: Date.now(),
    });
    (mockJwtUtil.sign as jest.Mock).mockReturnValueOnce("refreshed.cookie.jwt");

    const response = await request(app)
      .get("/protected")
      .set("Cookie", `${AUTH_COOKIE_NAME}=cookie.jwt.token`);

    expect(response.status).toBe(200);
    expect(response.body.data.userId).toBe(7);
    expect(mockJwtUtil.verify).toHaveBeenCalledWith("cookie.jwt.token");
  });

  it("절대 세션(12시간) 만료면 SESSION_EXPIRED", async () => {
    (mockJwtUtil.verify as jest.Mock).mockReturnValueOnce({
      userId: 1,
      email: "old@example.com",
      sessionStartedAt: Date.now() - 13 * 60 * 60 * 1000,
    });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer old.jwt.token");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("SESSION_EXPIRED");
    expect(mockJwtUtil.sign).not.toHaveBeenCalled();
  });

  it("Authorization 헤더가 없으면 401 UNAUTHORIZED", async () => {
    const response = await request(app).get("/protected");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(mockJwtUtil.verify).not.toHaveBeenCalled();
  });

  it("Authorization 헤더에 'Bearer ' 접두사가 없으면 401 UNAUTHORIZED", async () => {
    const response = await request(app)
      .get("/protected")
      .set("Authorization", "raw.jwt.token.without.bearer");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(mockJwtUtil.verify).not.toHaveBeenCalled();
  });

  it("잘못된 형식(garbage)의 JWT면 401 UNAUTHORIZED", async () => {
    (mockJwtUtil.verify as jest.Mock).mockImplementationOnce(() => {
      throw new Error("jwt malformed");
    });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer this-is-not-a-jwt");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(mockJwtUtil.verify).toHaveBeenCalledWith("this-is-not-a-jwt");
  });

  it("만료된 JWT면 401 UNAUTHORIZED", async () => {
    (mockJwtUtil.verify as jest.Mock).mockImplementationOnce(() => {
      throw new Error("jwt expired");
    });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer expired.jwt.token");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(mockJwtUtil.verify).toHaveBeenCalledWith("expired.jwt.token");
  });
});
