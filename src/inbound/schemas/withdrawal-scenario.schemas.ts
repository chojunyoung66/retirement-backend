import { z } from "zod";
import type { ScenarioType } from "../../application/services/withdrawal/types.js";

const wonAmount = (label: string, max: number) =>
  z
    .number({ error: `${label}은(는) 숫자여야 합니다` })
    .int(`${label}은(는) 원 단위 정수여야 합니다`)
    .nonnegative(`${label}은(는) 0 이상이어야 합니다`)
    .max(max, `${label}이(가) 너무 큽니다`);

const rate = (label: string, max: number) =>
  z
    .number({ error: `${label}은(는) 숫자여야 합니다` })
    .min(0, `${label}은(는) 0 이상이어야 합니다`)
    .max(max, `${label}은(는) ${max * 100}% 이하여야 합니다`);

export const scenarioTypeSchema = z.enum(["A", "B", "C", "D"] satisfies ScenarioType[], {
  error: "시나리오 유형은 A, B, C, D 중 하나여야 합니다",
});

export const generateScenarioSchema = z.object({
  nationalPension: z
    .object({
      monthlyAmount: wonAmount("국민연금 월액", 10_000_000),
      startAge: z
        .number()
        .int("국민연금 개시 연령은 정수여야 합니다")
        .min(55, "국민연금 개시 연령은 55세 이상이어야 합니다")
        .max(70, "국민연금 개시 연령은 70세 이하여야 합니다"),
    })
    .optional(),
  unemployment: z
    .object({
      monthlyAmount: wonAmount("실업급여 월액", 10_000_000),
      months: z
        .number()
        .int("실업급여 수급 개월은 정수여야 합니다")
        .min(0, "실업급여 수급 개월은 0 이상이어야 합니다")
        .max(9, "실업급여 수급 개월은 9개월 이하여야 합니다"),
    })
    .nullable()
    .optional(),
  yearsOfService: z
    .number()
    .positive("근속연수는 0보다 커야 합니다")
    .max(50, "근속연수는 50년 이하여야 합니다")
    .optional(),
  propertyValue: wonAmount("재산 과세표준", 100_000_000_000).nullable().optional(),
  assumptions: z
    .object({
      inflationRate: rate("물가상승률", 0.1),
      pensionGrowthRate: rate("연금 상승률", 0.1),
      returnRate: rate("운용수익률", 0.15),
      financialYieldRate: rate("금융소득 수익률", 0.15),
    })
    .partial()
    .optional(),
});

export type GenerateScenarioInput = z.infer<typeof generateScenarioSchema>;

export const scenarioSelectionSchema = z.object({
  selectedType: scenarioTypeSchema,
});
