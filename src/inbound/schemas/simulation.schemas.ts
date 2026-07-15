import { z } from "zod";

export const healthInsuranceSimulationSchema = z.object({
  pensionIncome: z.number().nonnegative("공적연금소득은 0 이상이어야 합니다"),
  laborIncome: z.number().nonnegative("근로소득은 0 이상이어야 합니다"),
  businessIncome: z.number().nonnegative("사업소득은 0 이상이어야 합니다"),
  interestDividendIncome: z.number().nonnegative("이자·배당소득은 0 이상이어야 합니다"),
  otherIncome: z.number().nonnegative("기타소득은 0 이상이어야 합니다"),
  propertyValue: z.number().nonnegative("재산 과표액은 0 이상이어야 합니다"),
  carValue: z.number().nonnegative("차량가액은 0 이상이어야 합니다"),
});

export type HealthInsuranceSimulationData = z.infer<typeof healthInsuranceSimulationSchema>;

export const isaSimulationSchema = z.object({
  annualContribution: z.number().positive("연 납입금은 양수여야 합니다"),
  expectedReturnRate: z
    .number()
    .positive("기대수익률은 양수여야 합니다")
    .max(30, "기대수익률은 30% 이하여야 합니다"),
  investmentYears: z
    .number()
    .int("투자기간은 정수여야 합니다")
    .min(1, "투자기간은 1년 이상이어야 합니다")
    .max(50, "투자기간은 50년 이하여야 합니다"),
});

export type IsaSimulationData = z.infer<typeof isaSimulationSchema>;

// 국민연금 시뮬레이션 입력 스키마
export const nationalPensionSimulationSchema = z.object({
  monthlyIncome: z.number().positive("월 소득은 양수여야 합니다"),
  contributionYears: z
    .number()
    .int("가입 기간은 정수여야 합니다")
    .min(1, "가입 기간은 1년 이상이어야 합니다")
    .max(45, "가입 기간은 45년 이하여야 합니다"),
  birthYear: z
    .number()
    .int("출생연도는 정수여야 합니다")
    .min(1950, "출생연도는 1950년 이후여야 합니다")
    .max(2000, "출생연도는 2000년 이전이어야 합니다"),
});

export type NationalPensionSimulationData = z.infer<typeof nationalPensionSimulationSchema>;

// IRP 시뮬레이션 입력 스키마
export const irpSimulationSchema = z.object({
  annualContribution: z.number().positive("연간 납입액은 양수여야 합니다"),
  expectedReturnRate: z
    .number()
    .positive("기대 수익률은 양수여야 합니다")
    .max(30, "기대 수익률은 30% 이하여야 합니다"),
  investmentYears: z
    .number()
    .int("투자 기간은 정수여야 합니다")
    .min(1, "투자 기간은 1년 이상이어야 합니다")
    .max(50, "투자 기간은 50년 이하여야 합니다"),
  annualIncome: z.number().positive("연 소득은 양수여야 합니다"),
});

export type IrpSimulationData = z.infer<typeof irpSimulationSchema>;

// 퇴직금 시뮬레이션 입력 스키마
export const severancePaySimulationSchema = z.object({
  averageMonthlyWage: z.number().positive("평균 월 임금은 양수여야 합니다"),
  yearsOfService: z.number().positive("근속연수는 양수여야 합니다"),
});

export type SeverancePaySimulationData = z.infer<typeof severancePaySimulationSchema>;

// 실업급여 시뮬레이션 입력 스키마
export const unemploymentBenefitSimulationSchema = z.object({
  averageMonthlyWage: z.number().positive("직전 월 평균 임금은 양수여야 합니다"),
  insuranceYears: z.number().positive("고용보험 가입 기간은 양수여야 합니다"),
  age: z.number().int("나이는 정수여야 합니다").min(18).max(100),
});

export type UnemploymentBenefitSimulationData = z.infer<typeof unemploymentBenefitSimulationSchema>;
