import type { IPortfolioRepo, PortfolioData, PortfolioItemData } from "../contracts/portfolio-repo.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

export interface PortfolioResult extends PortfolioData {
  id: number;
}

export const createPortfolioService = (portfolioRepo: IPortfolioRepo) => {
  // 소유자만 단건 조회·변경·삭제할 수 있게 검증
  const assertOwned = (
    portfolio: (PortfolioData & { id: number }) | null,
    userId: number,
  ): PortfolioData & { id: number } => {
    if (!portfolio) {
      throw new BusinessException("PORTFOLIO_NOT_FOUND", "포트폴리오를 찾을 수 없습니다", 404);
    }
    if (portfolio.userId !== userId) {
      throw new BusinessException("PORTFOLIO_FORBIDDEN", "접근 권한이 없습니다", 403);
    }
    return portfolio;
  };

  return {
    async create(
      userId: number,
      accountType: string,
      name: string,
      items: PortfolioItemData[],
    ): Promise<PortfolioResult> {
      // 포트폴리오 생성: 계정타입, 이름, 구성 항목 저장
      const created = await portfolioRepo.create(userId, accountType, name, items);

      return created;
    },

    async getByUserId(userId: number): Promise<PortfolioResult[]> {
      // 사용자의 모든 포트폴리오 조회
      const portfolios = await portfolioRepo.findByUserId(userId);

      return portfolios;
    },

    async getById(id: number, userId: number): Promise<PortfolioResult> {
      // 포트폴리오 단건 조회 (소유권 검증)
      const portfolio = await portfolioRepo.findById(id);
      return assertOwned(portfolio, userId);
    },

    async update(
      id: number,
      userId: number,
      data: Partial<PortfolioData>,
    ): Promise<PortfolioResult> {
      // 부분 업데이트: 최소 1개 필드 필수 (Repo에 빈 update 전파 방지)
      if (Object.keys(data).length === 0) {
        throw new BusinessException("INVALID_UPDATE", "업데이트할 필드가 없습니다", 400);
      }

      // 존재·소유권 검증 후 업데이트
      const existingPortfolio = await portfolioRepo.findById(id);
      assertOwned(existingPortfolio, userId);

      const updated = await portfolioRepo.update(id, data);

      return updated;
    },

    async delete(id: number, userId: number): Promise<boolean> {
      // 존재·소유권 검증 후 삭제
      const existingPortfolio = await portfolioRepo.findById(id);
      assertOwned(existingPortfolio, userId);

      const deleted = await portfolioRepo.delete(id);

      return deleted;
    },
  };
};

export type PortfolioServiceType = ReturnType<typeof createPortfolioService>;
