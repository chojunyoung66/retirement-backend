import type { IPortfolioRepo, PortfolioItemData } from "../contracts/portfolio-repo.contract.js";
import { createPortfolioService } from "./portfolio.service.js";

describe("PortfolioService", () => {
  let portfolioService: ReturnType<typeof createPortfolioService>;
  let mockPortfolioRepo: Partial<IPortfolioRepo>;

  beforeEach(() => {
    // 의존성 Mock 설정
    mockPortfolioRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    portfolioService = createPortfolioService(mockPortfolioRepo as IPortfolioRepo);
  });

  describe("create", () => {
    it("해피패스: 포트폴리오를 생성", async () => {
      // given
      const userId = 1;
      const accountType = "IRP";
      const name = "안정형 포트폴리오";
      const items: PortfolioItemData[] = [
        { symbol: "BOND", name: "채권 ETF", allocation: 60 },
        { symbol: "STOCK", name: "주식 ETF", allocation: 40 },
      ];

      (mockPortfolioRepo.create as jest.Mock).mockResolvedValueOnce({
        id: 1,
        userId,
        accountType,
        name,
        items,
      });

      // when
      const result = await portfolioService.create(userId, accountType, name, items);

      // then
      expect(mockPortfolioRepo.create).toHaveBeenCalledWith(userId, accountType, name, items);
      expect(result).toEqual({
        id: 1,
        userId,
        accountType,
        name,
        items,
      });
    });
  });

  describe("getByUserId", () => {
    it("해피패스: 사용자의 포트폴리오 목록을 조회", async () => {
      // given
      const userId = 1;
      const portfolios = [
        {
          id: 1,
          userId,
          accountType: "IRP",
          name: "안정형",
          items: [{ symbol: "BOND", name: "채권 ETF", allocation: 100 }],
        },
        {
          id: 2,
          userId,
          accountType: "ISA",
          name: "성장형",
          items: [{ symbol: "STOCK", name: "주식 ETF", allocation: 100 }],
        },
      ];

      (mockPortfolioRepo.findByUserId as jest.Mock).mockResolvedValueOnce(portfolios);

      // when
      const result = await portfolioService.getByUserId(userId);

      // then
      expect(mockPortfolioRepo.findByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual(portfolios);
    });

    it("에지케이스: 포트폴리오가 없으면 빈 배열 반환", async () => {
      // given
      const userId = 999;
      (mockPortfolioRepo.findByUserId as jest.Mock).mockResolvedValueOnce([]);

      // when
      const result = await portfolioService.getByUserId(userId);

      // then
      expect(mockPortfolioRepo.findByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual([]);
    });
  });

  describe("getById", () => {
    it("해피패스: 포트폴리오를 조회", async () => {
      // given
      const portfolioId = 1;
      const expectedPortfolio = {
        id: portfolioId,
        userId: 1,
        accountType: "IRP",
        name: "안정형 포트폴리오",
        items: [
          { symbol: "BOND", name: "채권 ETF", allocation: 60 },
          { symbol: "STOCK", name: "주식 ETF", allocation: 40 },
        ],
      };

      (mockPortfolioRepo.findById as jest.Mock).mockResolvedValueOnce(expectedPortfolio);

      // when
      const result = await portfolioService.getById(portfolioId);

      // then
      expect(mockPortfolioRepo.findById).toHaveBeenCalledWith(portfolioId);
      expect(result).toEqual(expectedPortfolio);
    });

    it("에지케이스: 포트폴리오가 없으면 PORTFOLIO_NOT_FOUND 예외 발생", async () => {
      // given
      const portfolioId = 999;
      (mockPortfolioRepo.findById as jest.Mock).mockResolvedValueOnce(null);

      // when & then
      await expect(portfolioService.getById(portfolioId)).rejects.toThrow(
        expect.objectContaining({
          code: "PORTFOLIO_NOT_FOUND",
        })
      );
    });
  });

  describe("update", () => {
    it("해피패스: 포트폴리오 이름을 업데이트", async () => {
      // given
      const portfolioId = 1;
      const existingPortfolio = {
        id: portfolioId,
        userId: 1,
        accountType: "IRP",
        name: "기존 포트폴리오",
        items: [{ symbol: "BOND", name: "채권 ETF", allocation: 100 }],
      };
      const updateData = { name: "변경된 포트폴리오" };
      const updatedPortfolio = {
        id: portfolioId,
        userId: 1,
        accountType: "IRP",
        name: "변경된 포트폴리오",
        items: [{ symbol: "BOND", name: "채권 ETF", allocation: 100 }],
      };

      (mockPortfolioRepo.findById as jest.Mock).mockResolvedValueOnce(existingPortfolio);
      (mockPortfolioRepo.update as jest.Mock).mockResolvedValueOnce(updatedPortfolio);

      // when
      const result = await portfolioService.update(portfolioId, updateData);

      // then
      expect(mockPortfolioRepo.findById).toHaveBeenCalledWith(portfolioId);
      expect(mockPortfolioRepo.update).toHaveBeenCalledWith(portfolioId, updateData);
      expect(result).toEqual(updatedPortfolio);
    });

    it("해피패스: 포트폴리오 항목을 업데이트", async () => {
      // given
      const portfolioId = 1;
      const existingPortfolio = {
        id: portfolioId,
        userId: 1,
        accountType: "IRP",
        name: "포트폴리오",
        items: [{ symbol: "BOND", name: "채권 ETF", allocation: 100 }],
      };
      const newItems: PortfolioItemData[] = [
        { symbol: "BOND", name: "채권 ETF", allocation: 70 },
        { symbol: "STOCK", name: "주식 ETF", allocation: 30 },
      ];
      const updateData = { items: newItems };
      const updatedPortfolio = {
        id: portfolioId,
        userId: 1,
        accountType: "IRP",
        name: "포트폴리오",
        items: newItems,
      };

      (mockPortfolioRepo.findById as jest.Mock).mockResolvedValueOnce(existingPortfolio);
      (mockPortfolioRepo.update as jest.Mock).mockResolvedValueOnce(updatedPortfolio);

      // when
      const result = await portfolioService.update(portfolioId, updateData);

      // then
      expect(mockPortfolioRepo.findById).toHaveBeenCalledWith(portfolioId);
      expect(mockPortfolioRepo.update).toHaveBeenCalledWith(portfolioId, updateData);
      expect(result).toEqual(updatedPortfolio);
    });

    it("에지케이스: 빈 데이터로 업데이트하면 INVALID_UPDATE 예외 발생", async () => {
      // given
      const portfolioId = 1;
      const updateData = {};

      // when & then
      await expect(portfolioService.update(portfolioId, updateData)).rejects.toThrow(
        expect.objectContaining({
          code: "INVALID_UPDATE",
        })
      );
      expect(mockPortfolioRepo.findById).not.toHaveBeenCalled();
    });

    it("에지케이스: 존재하지 않는 포트폴리오를 업데이트하면 PORTFOLIO_NOT_FOUND 예외 발생", async () => {
      // given
      const portfolioId = 999;
      const updateData = { name: "변경된 이름" };
      (mockPortfolioRepo.findById as jest.Mock).mockResolvedValueOnce(null);

      // when & then
      await expect(portfolioService.update(portfolioId, updateData)).rejects.toThrow(
        expect.objectContaining({
          code: "PORTFOLIO_NOT_FOUND",
        })
      );
      expect(mockPortfolioRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("해피패스: 포트폴리오를 삭제", async () => {
      // given
      const portfolioId = 1;

      (mockPortfolioRepo.delete as jest.Mock).mockResolvedValueOnce(true);

      // when
      const result = await portfolioService.delete(portfolioId);

      // then
      expect(mockPortfolioRepo.delete).toHaveBeenCalledWith(portfolioId);
      expect(result).toBe(true);
    });
  });
});
