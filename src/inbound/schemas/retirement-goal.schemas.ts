import { z } from "zod";

export const retirementGoalDataSchema = z.object({
  birthYear: z.number().int("태어난 해는 정수여야 합니다").min(1900, "태어난 해는 1900 이상이어야 합니다"),
  retirementYear: z.number().int("정년 해는 정수여야 합니다").min(1900, "정년 해는 1900 이상이어야 합니다"),
  monthlyLivingExpense: z.number().positive("월 생활비는 양수여야 합니다"),
  nationalPension: z.number().nonnegative("국민연금은 0 이상이어야 합니다"),
  retirementAsset: z.number().nonnegative("정년 자산은 0 이상이어야 합니다"),
});

export type RetirementGoalData = z.infer<typeof retirementGoalDataSchema>;

export const retirementGoalUpdateSchema = retirementGoalDataSchema.partial();

export type RetirementGoalUpdate = z.infer<typeof retirementGoalUpdateSchema>;
