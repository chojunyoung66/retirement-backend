import request from "supertest";
import express from "express";
import { createPortfolioController } from "./portfolio.controller.js";
import type { PortfolioServiceType } from "../../application/services/portfolio.service.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { errorMiddleware } from "../middlewares/error.middleware.js";
import type { IJwtUtil } from "../../shared/contracts/jwt-util.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

describe("PortfolioController", () => {
  let app: express.Application;
  let mockPortfolioService: Partial<PortfolioServiceType>;
  let mockJwtUtil: Partial<IJwtUtil>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockPortfolioService = {
      create: jest.fn(),
      getByUserId: jest.fn(),
      getById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockJwtUtil = {
      sign: jest.fn().mockReturnValue("jwt_token"),
      verify: jest.fn().mockReturnValue({ userId: 1, email: "test@example.com" }),
      decode: jest.fn(),
    };

    const authMiddleware = createAuthMiddleware(mockJwtUtil as IJwtUtil);
    const portfolioController = createPortfolioController(mockPortfolioService as PortfolioServiceType);

    app.use("/portfolios", authMiddleware, portfolioController.router);
    app.use(errorMiddleware);
  });

  describe("POST /portfolios", () => {
    it("유효한 데이터로 포트폴리오 생성 성공", async () => {
      // given
      const createData = {
        accountType: "IRP",
        name: "안정형 포트폴리오",
        items: [
          { symbol: "BOND", name: "채권 ETF", allocation: 60 },
          { symbol: "STOCK", name: "주식 ETF", allocation: 40 },
        ],
      };

      const mockResult = {
        id: 1,
        userId: 1,
        accountType: "IRP",
        name: "안정형 포트폴리오",
        items: [
          { symbol: "BOND", name: "채권 ETF", allocation: 60 },
          { symbol: "STOCK", name: "주식 ETF", allocation: 40 },
        ],
      };

      (mockPortfolioService.create as jest.Mock).mockResolvedValueOnce(mockResult);

      // when
      const response = await request(app)
        .post("/portfolios")
        .set("Authorization", "Bearer valid_token")
        .send(createData);

      // then
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockPortfolioService.create).toHaveBeenCalledWith(1, "IRP", "안정형 포트폴리오", createData.items);
    });

    it("포트폴리오 항목이 없으면 검증 실패", async () => {
      const response = await request(app)
        .post("/portfolios")
        .set("Authorization", "Bearer valid_token")
        .send({
          accountType: "IRP",
          name: "포트폴리오",
          items: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain("최소");
    });

    it("배분율 100% 초과는 검증 실패", async () => {
      const response = await request(app)
        .post("/portfolios")
        .set("Authorization", "Bearer valid_token")
        .send({
          accountType: "IRP",
          name: "포트폴리오",
          items: [
            { symbol: "BOND", name: "채권", allocation: 150 },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain("100");
    });

    it("인증 없이 접근하면 401 반환", async () => {
      const response = await request(app).post("/portfolios").send({
        accountType: "IRP",
        name: "포트폴리오",
        items: [{ symbol: "BOND", name: "채권", allocation: 100 }],
      });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /portfolios", () => {
    it("사용자의 포트폴리오 목록 조회 성공", async () => {
      // given
      const mockPortfolios = [
        {
          id: 1,
          userId: 1,
          accountType: "IRP",
          name: "안정형",
          items: [{ symbol: "BOND", name: "채권 ETF", allocation: 100 }],
        },
      ];

      (mockPortfolioService.getByUserId as jest.Mock).mockResolvedValueOnce(mockPortfolios);

      // when
      const response = await request(app)
        .get("/portfolios")
        .set("Authorization", "Bearer valid_token");

      // then
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPortfolios);
      expect(mockPortfolioService.getByUserId).toHaveBeenCalledWith(1);
    });
  });

  describe("GET /portfolios/:id", () => {
    it("포트폴리오 단건 조회 성공", async () => {
      // given
      const mockPortfolio = {
        id: 1,
        userId: 1,
        accountType: "IRP",
        name: "안정형",
        items: [{ symbol: "BOND", name: "채권 ETF", allocation: 100 }],
      };

      (mockPortfolioService.getById as jest.Mock).mockResolvedValueOnce(mockPortfolio);

      // when
      const response = await request(app)
        .get("/portfolios/1")
        .set("Authorization", "Bearer valid_token");

      // then
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPortfolio);
      expect(mockPortfolioService.getById).toHaveBeenCalledWith(1);
    });

    it("유효하지 않은 ID는 검증 실패", async () => {
      const response = await request(app)
        .get("/portfolios/invalid")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_REQUEST");
    });

    it("존재하지 않는 포트폴리오는 404 반환", async () => {
      // given
      const notFoundError = new BusinessException(
        "PORTFOLIO_NOT_FOUND",
        "포트폴리오를 찾을 수 없습니다",
        404
      );

      (mockPortfolioService.getById as jest.Mock).mockRejectedValueOnce(notFoundError);

      // when
      const response = await request(app)
        .get("/portfolios/999")
        .set("Authorization", "Bearer valid_token");

      // then
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("PORTFOLIO_NOT_FOUND");
    });
  });

  describe("PATCH /portfolios/:id", () => {
    it("포트폴리오 업데이트 성공", async () => {
      // given
      const updateData = {
        name: "변경된 포트폴리오",
      };

      const mockResult = {
        id: 1,
        userId: 1,
        accountType: "IRP",
        name: "변경된 포트폴리오",
        items: [{ symbol: "BOND", name: "채권 ETF", allocation: 100 }],
      };

      (mockPortfolioService.update as jest.Mock).mockResolvedValueOnce(mockResult);

      // when
      const response = await request(app)
        .patch("/portfolios/1")
        .set("Authorization", "Bearer valid_token")
        .send(updateData);

      // then
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe("변경된 포트폴리오");
      expect(mockPortfolioService.update).toHaveBeenCalledWith(1, updateData);
    });

    it("빈 업데이트는 검증 실패", async () => {
      const response = await request(app)
        .patch("/portfolios/1")
        .set("Authorization", "Bearer valid_token")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_UPDATE");
    });
  });

  describe("DELETE /portfolios/:id", () => {
    it("포트폴리오 삭제 성공", async () => {
      (mockPortfolioService.delete as jest.Mock).mockResolvedValueOnce(true);

      const response = await request(app)
        .delete("/portfolios/1")
        .set("Authorization", "Bearer valid_token");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(true);
      expect(mockPortfolioService.delete).toHaveBeenCalledWith(1);
    });
  });
});
