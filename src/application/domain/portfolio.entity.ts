import { BusinessException } from "../../shared/exceptions/business.exception.js";

export interface PortfolioItemData {
  symbol: string;
  name: string;
  allocation: number;
}

export interface PortfolioData {
  userId: number;
  accountType: string;
  name: string;
  items: PortfolioItemData[];
}

export interface PortfolioProfile extends PortfolioData {
  id: number;
}

export const createPortfolioEntity = (id: number, data: PortfolioData) => {
  // 포트폴리오 유효성 검증
  validatePortfolio(data);

  return {
    // 포트폴리오 ID 반환
    getId: () => id,

    // 포트폴리오 데이터 반환
    getData: (): PortfolioData => ({ ...data }),

    // 프로필 반환
    getProfile: (): PortfolioProfile => ({
      id,
      ...data,
    }),

    // 사용자 ID 반환
    getUserId: () => data.userId,

    // 계정 타입 반환
    getAccountType: () => data.accountType,

    // 포트폴리오 이름 반환
    getName: () => data.name,

    // 포트폴리오 구성 자산 반환
    getItems: (): PortfolioItemData[] => [...data.items],

    // 할당 비중 합계 계산
    getTotalAllocation: (): number => {
      return data.items.reduce((sum, item) => sum + item.allocation, 0);
    },

    // 특정 자산의 할당 비중 조회
    getAllocationBySymbol: (symbol: string): number => {
      const item = data.items.find((item) => item.symbol === symbol);
      return item?.allocation ?? 0;
    },

    // 자산 추가 (할당 비중 합계 검증)
    addItem: (item: PortfolioItemData) => {
      const newAllocation =
        data.items.reduce((sum, i) => sum + i.allocation, 0) + item.allocation;
      if (newAllocation > 100) {
        throw new BusinessException(
          "INVALID_ALLOCATION",
          "할당 비중의 합이 100%를 초과할 수 없습니다",
          400,
        );
      }
      data.items.push(item);
    },

    // 자산 제거
    removeItem: (symbol: string) => {
      const index = data.items.findIndex((item) => item.symbol === symbol);
      if (index === -1) {
        throw new BusinessException(
          "ITEM_NOT_FOUND",
          "해당 자산을 찾을 수 없습니다",
          404,
        );
      }
      data.items.splice(index, 1);
    },
  };
};

// 포트폴리오 유효성 검증
const validatePortfolio = (data: PortfolioData) => {
  // 사용자 ID 검증
  if (data.userId <= 0) {
    throw new BusinessException(
      "INVALID_USER_ID",
      "유효하지 않은 사용자 ID입니다",
      400,
    );
  }

  // 계정 타입 검증
  const validAccountTypes = ["IRP", "ISA", "일반"];
  if (!validAccountTypes.includes(data.accountType)) {
    throw new BusinessException(
      "INVALID_ACCOUNT_TYPE",
      "유효하지 않은 계정 타입입니다",
      400,
    );
  }

  // 포트폴리오 이름 검증
  if (!data.name || data.name.trim().length === 0) {
    throw new BusinessException(
      "INVALID_PORTFOLIO_NAME",
      "포트폴리오 이름은 필수입니다",
      400,
    );
  }

  // 자산 항목 검증
  if (!data.items || data.items.length === 0) {
    throw new BusinessException(
      "EMPTY_ITEMS",
      "포트폴리오에는 최소 1개 이상의 자산이 필요합니다",
      400,
    );
  }

  // 각 자산 검증
  data.items.forEach((item) => {
    if (!item.symbol || item.symbol.trim().length === 0) {
      throw new BusinessException(
        "INVALID_SYMBOL",
        "자산 심볼은 필수입니다",
        400,
      );
    }

    if (!item.name || item.name.trim().length === 0) {
      throw new BusinessException(
        "INVALID_ITEM_NAME",
        "자산 이름은 필수입니다",
        400,
      );
    }

    if (item.allocation <= 0 || item.allocation > 100) {
      throw new BusinessException(
        "INVALID_ALLOCATION",
        "할당 비중은 0보다 크고 100 이하여야 합니다",
        400,
      );
    }
  });

  // 할당 비중 합계 검증: 정확히 100%
  const totalAllocation = data.items.reduce(
    (sum, item) => sum + item.allocation,
    0,
  );
  if (Math.abs(totalAllocation - 100) > 0.01) {
    throw new BusinessException(
      "INVALID_ALLOCATION_SUM",
      "할당 비중의 합계가 100%여야 합니다",
      400,
    );
  }
};

export type PortfolioEntityType = ReturnType<typeof createPortfolioEntity>;
