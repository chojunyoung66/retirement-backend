import type { IRetirementGoalRepo, RetirementGoalData } from "../../application/contracts/retirement-goal-repo.contract.js";
import { prisma } from "./prisma-client.js";

export const createRetirementGoalRepo = (): IRetirementGoalRepo => ({
  async findByUserId(userId: number) {
    // 사용자의 정년 목표 조회
    const goal = await prisma.retirementGoal.findUnique({
      where: { userId },
    });

    return goal
      ? {
          id: goal.id,
          birthYear: goal.birthYear,
          retirementYear: goal.retirementYear,
          monthlyLivingExpense: goal.monthlyLivingExpense,
          nationalPension: goal.nationalPension,
          retirementAsset: goal.retirementAsset,
        }
      : null;
  },

  async create(userId: number, data: RetirementGoalData) {
    // 정년 목표 생성
    const goal = await prisma.retirementGoal.create({
      data: {
        userId,
        ...data,
      },
    });

    return {
      id: goal.id,
      birthYear: goal.birthYear,
      retirementYear: goal.retirementYear,
      monthlyLivingExpense: goal.monthlyLivingExpense,
      nationalPension: goal.nationalPension,
      retirementAsset: goal.retirementAsset,
    };
  },

  async update(userId: number, data: Partial<RetirementGoalData>) {
    // 정년 목표 업데이트
    const goal = await prisma.retirementGoal.update({
      where: { userId },
      data,
    });

    return {
      id: goal.id,
      birthYear: goal.birthYear,
      retirementYear: goal.retirementYear,
      monthlyLivingExpense: goal.monthlyLivingExpense,
      nationalPension: goal.nationalPension,
      retirementAsset: goal.retirementAsset,
    };
  },

  async deleteByUserId(userId: number): Promise<void> {
    // 정년 목표 삭제
    await prisma.retirementGoal.delete({ where: { userId } });
  },
});

export type RetirementGoalRepoType = ReturnType<typeof createRetirementGoalRepo>;
