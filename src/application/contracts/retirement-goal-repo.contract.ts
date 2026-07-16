export interface RetirementGoalData {
  birthYear: number;
  retirementYear: number;
  monthlyLivingExpense: number;
  nationalPension: number;
  retirementAsset: number;
}

export interface IRetirementGoalRepo {
  findByUserId(userId: number): Promise<(RetirementGoalData & { id: number }) | null>;
  create(userId: number, data: RetirementGoalData): Promise<RetirementGoalData & { id: number }>;
  update(userId: number, data: Partial<RetirementGoalData>): Promise<RetirementGoalData & { id: number }>;
  deleteByUserId(userId: number): Promise<void>;
}
