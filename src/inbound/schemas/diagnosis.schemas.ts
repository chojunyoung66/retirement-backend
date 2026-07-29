import { z } from "zod";

export const diagnosisDataSchema = z.object({
  householdType: z.string().min(1, "가구 유형은 필수입니다"),
  birthYear: z
    .number()
    .int("태어난 해는 정수여야 합니다")
    .min(1900, "태어난 해는 1900 이상이어야 합니다"),
  retirementYear: z
    .number()
    .int("은퇴 예정 연도는 정수여야 합니다")
    .min(1900, "은퇴 예정 연도는 1900 이상이어야 합니다"),
  monthlyIncome: z.number().nonnegative("월 소득은 0 이상이어야 합니다"),
  monthlyExpense: z.number().nonnegative("월 지출은 0 이상이어야 합니다"),
});

export type DiagnosisDataInput = z.infer<typeof diagnosisDataSchema>;
