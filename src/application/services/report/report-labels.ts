import { DEPENDENT_REASON_LABEL } from "../withdrawal/dependent.js";
import type { DependentReason, YearRow } from "../withdrawal/types.js";
import { VALUE_SOURCE_LABEL, type ReportContent } from "./report-content.js";

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

/** 연속 연도를 "2027~2030년"으로 묶는다 */
const yearRanges = (years: number[]): string => {
  const ranges: string[] = [];
  let start = years[0]!;
  let prev = start;
  for (const year of [...years.slice(1), Number.NaN]) {
    if (year === prev + 1) {
      prev = year;
      continue;
    }
    ranges.push(start === prev ? `${start}년` : `${start}~${prev}년`);
    start = year;
    prev = year;
  }
  return ranges.join(", ");
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
