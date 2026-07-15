import { BusinessException } from "../../shared/exceptions/business.exception.js";

export interface RetirementGoalData {
  birthYear: number;
  retirementYear: number;
  monthlyLivingExpense: number;
  nationalPension: number;
  retirementAsset: number;
}

export interface RetirementGoalProfile extends RetirementGoalData {
  id: number;
}

export const createRetirementGoalEntity = (
  id: number,
  data: RetirementGoalData,
) => {
  // 데이터 유효성 검증
  validateRetirementGoal(data);

  return {
    // 정년 목표 ID 반환
    getId: () => id,

    // 정년 목표 데이터 반환
    getData: (): RetirementGoalData => ({ ...data }),

    // 프로필 반환
    getProfile: (): RetirementGoalProfile => ({
      id,
      ...data,
    }),

    // 출생연도 반환
    getBirthYear: () => data.birthYear,

    // 정년연도 반환
    getRetirementYear: () => data.retirementYear,

    // 월 생활비 반환
    getMonthlyLivingExpense: () => data.monthlyLivingExpense,

    // 국민연금 반환
    getNationalPension: () => data.nationalPension,

    // 정년 자산 반환
    getRetirementAsset: () => data.retirementAsset,

    // 정년까지 근무 연수 계산
    getYearsToRetirement: (): number => {
      const currentYear = new Date().getFullYear();
      return Math.max(0, data.retirementYear - currentYear);
    },

    // 정년 후 필요한 총 자산 계산
    getTotalNeededAsset: (): number => {
      const yearsInRetirement = 100 - (data.retirementYear - data.birthYear);
      return (
        data.monthlyLivingExpense * 12 * yearsInRetirement -
        data.nationalPension * 12 * yearsInRetirement
      );
    },
  };
};

// 정년 목표 유효성 검증
const validateRetirementGoal = (data: RetirementGoalData) => {
  // 출생연도 검증
  if (data.birthYear < 1920 || data.birthYear > new Date().getFullYear()) {
    throw new BusinessException(
      "INVALID_BIRTH_YEAR",
      "유효하지 않은 출생연도입니다",
      400,
    );
  }

  // 정년연도 검증: 현재연도 이후, 출생연도 이후
  const currentYear = new Date().getFullYear();
  if (
    data.retirementYear <= data.birthYear ||
    data.retirementYear <= currentYear
  ) {
    throw new BusinessException(
      "INVALID_RETIREMENT_YEAR",
      "정년연도는 출생연도보다 이후여야 합니다",
      400,
    );
  }

  // 월 생활비 검증: 양수
  if (data.monthlyLivingExpense <= 0) {
    throw new BusinessException(
      "INVALID_MONTHLY_EXPENSE",
      "월 생활비는 0보다 커야 합니다",
      400,
    );
  }

  // 국민연금 검증: 0 이상
  if (data.nationalPension < 0) {
    throw new BusinessException(
      "INVALID_NATIONAL_PENSION",
      "국민연금은 0 이상이어야 합니다",
      400,
    );
  }

  // 정년 자산 검증: 0 이상
  if (data.retirementAsset < 0) {
    throw new BusinessException(
      "INVALID_RETIREMENT_ASSET",
      "정년 자산은 0 이상이어야 합니다",
      400,
    );
  }
};

export type RetirementGoalEntityType = ReturnType<
  typeof createRetirementGoalEntity
>;
