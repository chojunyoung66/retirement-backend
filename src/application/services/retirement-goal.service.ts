import type { IRetirementGoalRepo, RetirementGoalData } from "../contracts/retirement-goal-repo.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

export interface RetirementGoalResult extends RetirementGoalData {
  id: number;
}

export const createRetirementGoalService = (retirementGoalRepo: IRetirementGoalRepo) => ({
  async create(userId: number, data: RetirementGoalData): Promise<RetirementGoalResult> {
    // 정년 목표 생성
    const createdGoal = await retirementGoalRepo.create(userId, data);

    return createdGoal;
  },

  async getByUserId(userId: number): Promise<RetirementGoalResult> {
    // 사용자의 정년 목표 조회
    const goal = await retirementGoalRepo.findByUserId(userId);
    if (!goal) {
      throw new BusinessException("RETIREMENT_GOAL_NOT_FOUND", "정년 목표를 찾을 수 없습니다", 404);
    }

    return goal;
  },

  async update(
    userId: number,
    data: Partial<RetirementGoalData>
  ): Promise<RetirementGoalResult> {
    // 부분 업데이트: 최소 1개 필드 필수 (Repo에 빈 update 전파 방지)
    if (Object.keys(data).length === 0) {
      throw new BusinessException("INVALID_UPDATE", "업데이트할 필드가 없습니다", 400);
    }

    // 정년 목표 존재 검증: 삭제된/없는 목표 접근 방지
    const existingGoal = await retirementGoalRepo.findByUserId(userId);
    if (!existingGoal) {
      throw new BusinessException("RETIREMENT_GOAL_NOT_FOUND", "정년 목표를 찾을 수 없습니다", 404);
    }

    // 정년 목표 업데이트
    const updatedGoal = await retirementGoalRepo.update(userId, data);

    return updatedGoal;
  },

  async delete(userId: number): Promise<void> {
    // 정년 목표 존재 검증
    const existingGoal = await retirementGoalRepo.findByUserId(userId);
    if (!existingGoal) {
      throw new BusinessException("RETIREMENT_GOAL_NOT_FOUND", "정년 목표를 찾을 수 없습니다", 404);
    }

    // 정년 목표 삭제
    await retirementGoalRepo.deleteByUserId(userId);
  },
});

export type RetirementGoalServiceType = ReturnType<typeof createRetirementGoalService>;
