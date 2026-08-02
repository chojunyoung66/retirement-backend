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
  nationalPension: z.number().nonnegative("국민연금은 0 이상이어야 합니다"),
  retirementPension: z.number().nonnegative("퇴직연금은 0 이상이어야 합니다"),
  personalPension: z.number().nonnegative("개인연금은 0 이상이어야 합니다"),
  housingPension: z
    .number()
    .nonnegative("주택연금은 0 이상이어야 합니다")
    .default(0),
  monthlyExpense: z.number().nonnegative("월 지출은 0 이상이어야 합니다"),
  healthInsurance: z.number().nonnegative("건강보험료는 0 이상이어야 합니다").default(0),
  privateInsurance: z.number().nonnegative("민영보험료는 0 이상이어야 합니다").default(0),
});

export type DiagnosisDataInput = z.infer<typeof diagnosisDataSchema>;
