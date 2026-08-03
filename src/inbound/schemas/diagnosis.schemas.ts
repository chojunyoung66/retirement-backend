import { z } from "zod";

export const diagnosisDataSchema = z
  .object({
    householdType: z.enum(["individual", "couple"], {
      error: "가구 유형은 individual 또는 couple 이어야 합니다",
    }),
    birthYear: z
      .number()
      .int("태어난 해는 정수여야 합니다")
      .min(1900, "태어난 해는 1900 이상이어야 합니다")
      .max(2010, "태어난 해는 2010 이하여야 합니다"),
    retirementYear: z
      .number()
      .int("은퇴 예정 연도는 정수여야 합니다")
      .min(1900, "은퇴 예정 연도는 1900 이상이어야 합니다")
      .max(2100, "은퇴 예정 연도는 2100 이하여야 합니다"),
    nationalPension: z
      .number()
      .nonnegative("국민연금은 0 이상이어야 합니다")
      .max(100_000_000, "국민연금이 너무 큽니다"),
    retirementPension: z
      .number()
      .nonnegative("퇴직연금은 0 이상이어야 합니다")
      .max(100_000_000, "퇴직연금이 너무 큽니다"),
    personalPension: z
      .number()
      .nonnegative("개인연금은 0 이상이어야 합니다")
      .max(100_000_000, "개인연금이 너무 큽니다"),
    housingPension: z
      .number()
      .nonnegative("주택연금은 0 이상이어야 합니다")
      .max(100_000_000, "주택연금이 너무 큽니다")
      .default(0),
    monthlyExpense: z
      .number()
      .nonnegative("월 지출은 0 이상이어야 합니다")
      .max(100_000_000, "월 지출이 너무 큽니다"),
    healthInsurance: z
      .number()
      .nonnegative("건강보험료는 0 이상이어야 합니다")
      .max(10_000_000, "건강보험료가 너무 큽니다")
      .default(0),
    privateInsurance: z
      .number()
      .nonnegative("민영보험료는 0 이상이어야 합니다")
      .max(10_000_000, "민영보험료가 너무 큽니다")
      .default(0),
  })
  .refine((data) => data.retirementYear > data.birthYear, {
    message: "은퇴 예정 연도는 출생 연도보다 커야 합니다",
    path: ["retirementYear"],
  });

export type DiagnosisDataInput = z.infer<typeof diagnosisDataSchema>;
