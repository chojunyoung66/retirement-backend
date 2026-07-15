import type { IPortfolioRepo, PortfolioData, PortfolioItemData } from "../contracts/portfolio-repo.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

export interface PortfolioResult extends PortfolioData {
  id: number;
}

export const createPortfolioService = (portfolioRepo: IPortfolioRepo) => ({
  async create(
    userId: number,
    accountType: string,
    name: string,
    items: PortfolioItemData[]
  ): Promise<PortfolioResult> {
    // 포트폴리오 생성: 계정타입, 이름, 구성 자산 저장
    const created = await portfolioRepo.create(userId, accountType, name, items);

    return created;
  },

  async getByUserId(userId: number): Promise<PortfolioResult[]> {
    // 사용자의 모든 포트폴리오 조회
    const portfolios = await portfolioRepo.findByUserId(userId);

    return portfolios;
  },

  async getById(id: number): Promise<PortfolioResult> {
    // 포트폴리오 단건 조회
    const portfolio = await portfolioRepo.findById(id);
    if (!portfolio) {
      throw new BusinessException("PORTFOLIO_NOT_FOUND", "포트폴리오를 찾을 수 없습니다", 404);
    }

    return portfolio;
  },

  async update(id: number, data: Partial<PortfolioData>): Promise<PortfolioResult> {
    // 부분 업데이트: 최소 1개 필드 필수 (Repo에 빈 update 전파 방지)
    if (Object.keys(data).length === 0) {
      throw new BusinessException("INVALID_UPDATE", "업데이트할 필드가 없습니다", 400);
    }

    // 포트폴리오 존재 검증: 삭제된/없는 포트폴리오 접근 방지
    const existingPortfolio = await portfolioRepo.findById(id);
    if (!existingPortfolio) {
      throw new BusinessException("PORTFOLIO_NOT_FOUND", "포트폴리오를 찾을 수 없습니다", 404);
    }

    // 포트폴리오 업데이트
    const updated = await portfolioRepo.update(id, data);

    return updated;
  },

  async delete(id: number): Promise<boolean> {
    // 포트폴리오 삭제
    const deleted = await portfolioRepo.delete(id);

    return deleted;
  },
});

export type PortfolioServiceType = ReturnType<typeof createPortfolioService>;
