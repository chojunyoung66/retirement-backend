import { z } from "zod";

const wonAmount = (label: string, max: number) =>
  z
    .number({ error: `${label}은(는) 숫자여야 합니다` })
    .int(`${label}은(는) 원 단위 정수여야 합니다`)
    .nonnegative(`${label}은(는) 0 이상이어야 합니다`)
    .max(max, `${label}이(가) 너무 큽니다`);

const ANNUAL_MAX = 10_000_000_000;

export const taxHealthCheckSchema = z.object({
  publicPensionAnnual: wonAmount("공적연금 연액", ANNUAL_MAX).default(0),
  laborIncome: wonAmount("근로소득", ANNUAL_MAX).default(0),
  businessIncome: wonAmount("사업소득", ANNUAL_MAX).default(0),
  financialIncome: wonAmount("이자·배당소득", ANNUAL_MAX).default(0),
  otherIncome: wonAmount("기타소득", ANNUAL_MAX).default(0),
  propertyValue: wonAmount("재산 과세표준", 100_000_000_000).nullable().default(null),
  carValue: wonAmount("차량가액", 1_000_000_000).default(0),
  actualMonthlyPremium: wonAmount("실제 고지 보험료", 10_000_000).nullable().default(null),
  spouseAnnualIncome: wonAmount("배우자 연 소득", ANNUAL_MAX).nullable().default(null),
});

export type TaxHealthCheckInput = z.infer<typeof taxHealthCheckSchema>;
