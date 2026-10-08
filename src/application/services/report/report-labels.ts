import { DEPENDENT_REASON_LABEL } from "../withdrawal/dependent.js";
import { splitLocalTax } from "../withdrawal/tax.js";
import { yearRanges } from "../withdrawal/timeline.js";
import type {
  AnnuityLimit,
  AnnuityLimitYear,
  DependentReason,
  YearRow,
} from "../withdrawal/types.js";
import { VALUE_SOURCE_LABEL, type ReportContent } from "./report-content.js";

/** 세금 중 지방소득세 — 고도화 이전 리포트에는 값이 없어 합계에서 나눈다 */
export const localTaxOf = (totalTax: number, localIncomeTax: number | undefined): number =>
  localIncomeTax ?? splitLocalTax(totalTax).localIncomeTax;

/** 카드·리포트에 대표로 보여 줄 연차: 첫 인출 연도, 인출이 없으면 첫해 */
export const annuityLimitFocus = (limit: AnnuityLimit): AnnuityLimitYear | null =>
  limit.years.find((y) => y.planned > 0) ?? limit.years[0] ?? null;

/** 10년차까지 계획 인출이 없으면 한도가 없는 11년차가 시작되는 해, 아니면 null */
export const limitFreeStartYear = (limit: AnnuityLimit): number | null => {
  const last = limit.years[limit.years.length - 1];
  return last?.receiptYear === 10 && limit.years.every((y) => y.planned === 0) ? last.year + 1 : null;
};

export const exceededYearsText = (limit: AnnuityLimit): string =>
  limit.exceededYears.length > 0 ? yearRanges(limit.exceededYears) : "";

/** 0.025 → "2.5%" */
export const formatRate = (rate: number): string =>
  `${Number((rate * 100).toFixed(2))}%`;

/** 입력 요약 — 금액은 총 잔액만, 나머지는 값의 출처만 담는다 */
export const inputSummaryRows = (
  content: ReportContent,
  formatAmount: (amount: number) => string,
): [string, string][] => {
  const input = content.inputSummary;
  return [
    ["등록 계좌 수", `${input.accountsCount}개`],
    ["계좌 총 잔액", formatAmount(input.totalBalance)],
    ["국민연금", VALUE_SOURCE_LABEL[input.nationalPensionSource]],
    ["배우자 국민연금", VALUE_SOURCE_LABEL[input.spouseNationalPensionSource]],
    ["실업급여", VALUE_SOURCE_LABEL[input.unemploymentSource]],
    ["근속연수", VALUE_SOURCE_LABEL[input.yearsOfServiceSource]],
    ["재산(피부양자 판단)", input.propertyProvided ? "입력함" : "입력 안 함"],
  ];
};

export const assumptionRows = (content: ReportContent): [string, string][] => {
  const a = content.assumptions;
  return [
    ["물가 상승률", formatRate(a.inflationRate)],
    ["연금 상승률", formatRate(a.pensionGrowthRate)],
    ["운용 수익률", formatRate(a.returnRate)],
    ["현금·주식 금융소득 수익률", formatRate(a.financialYieldRate)],
    ["계산 종료 나이", `${a.endAge}세`],
  ];
};

/** 피부양자 판단 사유별 해당 연도 — 고도화 이전 리포트에는 사유가 없다 */
export const dependentReasonGroups = (
  yearly: YearRow[],
): { reason: DependentReason; label: string; years: string }[] => {
  const byReason = new Map<DependentReason, number[]>();
  for (const row of yearly) {
    for (const reason of row.dependentReasons ?? []) {
      byReason.set(reason, [...(byReason.get(reason) ?? []), row.year]);
    }
  }
  return [...byReason.entries()].map(([reason, years]) => ({
    reason,
    label: DEPENDENT_REASON_LABEL[reason],
    years: yearRanges(years),
  }));
};
