import { z } from "zod";

// 원 단위 금액: 0 이상 정수, 상한 지정
const wonAmount = (label: string, max: number) =>
  z
    .number()
    .int(`${label}은(는) 원 단위 정수여야 합니다`)
    .nonnegative(`${label}은(는) 0 이상이어야 합니다`)
    .max(max, `${label}이(가) 너무 큽니다`);

const diagnosisObjectSchema = z
  .object({
    householdType: z.enum(["individual", "couple"], {
      error: "가구 유형은 individual 또는 couple 이어야 합니다",
    }),
    householdSize: z
      .number()
      .int("가구원 수는 정수여야 합니다")
      .min(1, "가구원 수는 1 이상이어야 합니다")
      .max(5, "가구원 수는 5 이하여야 합니다")
      .default(1),
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
    spouseBirthYear: z
      .number()
      .int("배우자 출생연도는 정수여야 합니다")
      .min(1900, "배우자 출생연도는 1900 이상이어야 합니다")
      .max(2010, "배우자 출생연도는 2010 이하여야 합니다")
      .nullable()
      .optional()
      .default(null),
    spouseRetirementYear: z
      .number()
      .int("배우자 은퇴 예정 연도는 정수여야 합니다")
      .min(1900, "배우자 은퇴 예정 연도는 1900 이상이어야 합니다")
      .max(2100, "배우자 은퇴 예정 연도는 2100 이하여야 합니다")
      .nullable()
      .optional()
      .default(null),
    nationalPension: wonAmount("국민연금", 100_000_000),
    retirementPension: wonAmount("퇴직연금", 100_000_000),
    personalPension: wonAmount("개인연금", 100_000_000),
    housingPension: wonAmount("주택연금", 100_000_000).default(0),
    monthlyExpense: wonAmount("월 지출", 100_000_000),
    healthInsurance: wonAmount("건강보험료", 10_000_000).default(0),
    privateInsurance: wonAmount("민영보험료", 10_000_000).default(0),
  })
  .refine((data) => data.retirementYear > data.birthYear, {
    message: "은퇴 예정 연도는 출생 연도보다 커야 합니다",
    path: ["retirementYear"],
  })
  .refine(
    (data) => {
      if (data.spouseBirthYear == null || data.spouseRetirementYear == null) {
        return true;
      }
      return data.spouseRetirementYear > data.spouseBirthYear;
    },
    {
      message: "배우자 은퇴 예정 연도는 배우자 출생 연도보다 커야 합니다",
      path: ["spouseRetirementYear"],
    },
  );

// 개인 가구는 남아 있는 배우자 값을 검증·저장하지 않도록 먼저 비움
const dropSpouseForIndividual = (raw: unknown): unknown => {
  if (!raw || typeof raw !== "object") return raw;
  const body = raw as Record<string, unknown>;
  if (body.householdType !== "individual") return raw;
  return { ...body, spouseBirthYear: null, spouseRetirementYear: null };
};

export const diagnosisDataSchema = z.preprocess(
  dropSpouseForIndividual,
  diagnosisObjectSchema,
);

export type DiagnosisDataInput = z.infer<typeof diagnosisDataSchema>;
