import ExcelJS from "exceljs";
import { DEPENDENT_REASON_LABEL, DEPENDENT_STATUS_LABEL } from "../withdrawal/dependent.js";
import { ACTION_LABEL, type ReportContent } from "./report-content.js";
import {
  assumptionRows,
  exceededYearsText,
  inputSummaryRows,
  localTaxOf,
} from "./report-labels.js";

/** 원본 샘플 엑셀의 시트 이름을 따른다 */
export const SHEET = {
  summary: "요약",
  input: "입력값_가정",
  comparison: "시나리오_요약",
  plan: "계좌별_실행안",
  annuityLimit: "연금수령한도",
  yearly: "연도별현금흐름",
  monthly: "월별현금흐름",
  basis: "출처_기준일",
} as const;

const WON = "#,##0";
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF2F4F7" },
};

const formatWon = (amount: number): string =>
  `${String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}원`;

interface Column {
  header: string;
  width: number;
  /** 금액 열은 숫자로 넣고 천 단위 서식을 건다 */
  won?: boolean;
}

/** 머리행 고정·서식을 갖춘 표 시트 */
const addTableSheet = (
  workbook: ExcelJS.Workbook,
  name: string,
  columns: Column[],
  rows: (string | number | null)[][],
): ExcelJS.Worksheet => {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map((column) => ({
    header: column.header,
    width: column.width,
    style: column.won ? { numFmt: WON } : {},
  }));
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = HEADER_FILL;
  header.alignment = { vertical: "middle" };
  sheet.addRows(rows);
  return sheet;
};

const addKeyValueSheet = (
  workbook: ExcelJS.Workbook,
  name: string,
  sections: { title: string; rows: [string, string | number][] }[],
): ExcelJS.Worksheet => {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = [{ width: 30 }, { width: 60 }];
  sections.forEach((section, index) => {
    if (index > 0) sheet.addRow([]);
    const title = sheet.addRow([section.title]);
    title.font = { bold: true, size: 12 };
    for (const [key, value] of section.rows) {
      const row = sheet.addRow([key, value]);
      row.getCell(1).fill = HEADER_FILL;
      if (typeof value === "number") row.getCell(2).numFmt = WON;
      row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    }
  });
  return sheet;
};

/** 리포트 스냅샷을 엑셀 파일로 바꾼다 — 식별정보는 넣지 않는다 */
export const buildReportWorkbook = (content: ReportContent): ExcelJS.Workbook => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RCFD";
  workbook.title = content.title;
  workbook.created = new Date(content.generatedAt);

  const { scenario } = content;
  const summary = scenario.summary;
  const recommendedTitle =
    content.comparison.find((row) => row.type === content.recommendedType)?.title ??
    content.recommendedType;

  addKeyValueSheet(workbook, SHEET.summary, [
    {
      title: content.title,
      rows: [
        ["생성일", content.generatedAt.slice(0, 10)],
        ["규칙 버전", content.ruleVersion],
        ["계산 기간", `${content.startYm} ~ ${content.endYm}`],
        ["선택한 실행안", `${scenario.type}안 · ${scenario.title}${scenario.recommended ? " (추천)" : ""}`],
        ["목표", scenario.goal],
        ["기본 추천", `${recommendedTitle} — ${content.recommendationNote}`],
      ],
    },
    {
      title: "핵심 결과",
      rows: [
        ["세전 총 인출", summary.grossWithdrawal],
        ["추정 세금 합계", summary.totalTax],
        ["지방소득세(세금 합계에 포함)", localTaxOf(summary.totalTax, summary.localIncomeTax)],
        ["세후 총 인출", summary.netWithdrawal],
        ["자산 소진 나이", summary.depletionAge === null ? "계산 기간 내 소진 없음" : `${summary.depletionAge}세`],
        ["부족 시작", summary.firstShortfallYm ?? "없음"],
        ["부족 개월 수", `${summary.shortfallMonths}개월`],
        [
          "피부양자 추정 기간",
          content.inputSummary.propertyProvided ? `${summary.dependentLikelyYears}년` : "재산 입력 시 표시",
        ],
        ["계산 종료 시 잔액", summary.endingBalance],
      ],
    },
    {
      title: "지금 할 일",
      rows: content.nextActions.map((action, i) => [
        `${i + 1}. ${action.startYm ?? content.startYm}부터`,
        `${action.label} · ${ACTION_LABEL[action.actionType]} — ${action.method}`,
      ]),
    },
  ]);

  addKeyValueSheet(workbook, SHEET.input, [
    { title: "입력 요약", rows: inputSummaryRows(content, formatWon) },
    { title: "계산 가정", rows: assumptionRows(content) },
  ]);

  addTableSheet(
    workbook,
    SHEET.comparison,
    [
      { header: "유형", width: 6 },
      { header: "실행안", width: 28 },
      { header: "추천", width: 6 },
      { header: "세전 총 인출", width: 16, won: true },
      { header: "추정 세금", width: 14, won: true },
      { header: "지방소득세(포함)", width: 14, won: true },
      { header: "세후 총 인출", width: 16, won: true },
      { header: "자산 소진 나이", width: 14 },
      { header: "부족 개월", width: 10 },
      { header: "피부양자 추정(년)", width: 16 },
      { header: "종료 시 잔액", width: 16, won: true },
    ],
    content.comparison.map((row) => [
      row.type,
      row.title,
      row.recommended ? "추천" : "",
      row.summary.grossWithdrawal,
      row.summary.totalTax,
      localTaxOf(row.summary.totalTax, row.summary.localIncomeTax),
      row.summary.netWithdrawal,
      row.summary.depletionAge ?? "없음",
      row.summary.shortfallMonths,
      content.inputSummary.propertyProvided ? row.summary.dependentLikelyYears : "재산 입력 시 표시",
      row.summary.endingBalance,
    ]),
  );

  addTableSheet(
    workbook,
    SHEET.plan,
    [
      { header: "순서", width: 6 },
      { header: "계좌", width: 18 },
      { header: "방식", width: 14 },
      { header: "시작", width: 10 },
      { header: "종료", width: 10 },
      { header: "월 평균 세전(일시금은 1회)", width: 18, won: true },
      { header: "월 평균 세후", width: 14, won: true },
      { header: "총 세전", width: 16, won: true },
      { header: "총 세금", width: 14, won: true },
      { header: "지방소득세(포함)", width: 14, won: true },
      { header: "시작 총액", width: 16, won: true },
      { header: "첫해 수령한도", width: 16, won: true },
      { header: "한도 초과 연도", width: 18 },
      { header: "실행 방법", width: 40 },
      { header: "세금", width: 40 },
      { header: "건강보험", width: 40 },
      { header: "운영 메모", width: 40 },
    ],
    scenario.planItems.map((item) => [
      item.priority,
      item.label,
      ACTION_LABEL[item.actionType],
      item.startYm ?? "",
      item.endYm ?? "",
      item.monthlyGross,
      item.monthlyNet,
      item.totalGross,
      item.totalTax,
      localTaxOf(item.totalTax, item.localIncomeTax),
      // 고도화 이전 리포트에는 계좌 총액·수령한도가 없다
      item.startBalance ?? null,
      item.annuityLimit?.years[0]?.limit ?? null,
      item.annuityLimit ? exceededYearsText(item.annuityLimit) : "",
      item.method,
      item.taxNote,
      item.healthInsuranceNote,
      item.cautions.join(" / "),
    ]),
  );

  const limitRows = scenario.planItems.flatMap((item) =>
    (item.annuityLimit?.years ?? []).map((year) => [
      item.label,
      year.year,
      `${year.receiptYear}년차`,
      year.openingBalance,
      year.limit,
      year.planned,
      year.planned > year.limit ? "초과" : "",
    ]),
  );
  if (limitRows.length > 0) {
    addTableSheet(
      workbook,
      SHEET.annuityLimit,
      [
        { header: "계좌", width: 18 },
        { header: "연도", width: 8 },
        { header: "연차", width: 8 },
        { header: "연초 평가액", width: 16, won: true },
        { header: "수령한도", width: 16, won: true },
        { header: "계획 인출(세전)", width: 16, won: true },
        { header: "초과 여부", width: 10 },
      ],
      limitRows,
    );
  }

  addTableSheet(
    workbook,
    SHEET.yearly,
    [
      { header: "연도", width: 8 },
      { header: "나이", width: 6 },
      { header: "지출(건보료 포함)", width: 16, won: true },
      { header: "국민연금", width: 14, won: true },
      { header: "배우자 국민연금", width: 14, won: true },
      { header: "실업급여", width: 14, won: true },
      { header: "건강보험료", width: 14, won: true },
      { header: "세전 인출", width: 16, won: true },
      { header: "세금", width: 14, won: true },
      { header: "지방소득세(포함)", width: 14, won: true },
      { header: "세후 인출", width: 16, won: true },
      { header: "부족", width: 14, won: true },
      { header: "연말 잔액", width: 16, won: true },
      { header: "과세 금융소득", width: 14, won: true },
      { header: "피부양자", width: 10 },
      { header: "피부양자 판단 근거", width: 50 },
    ],
    scenario.yearly.map((row) => [
      row.year,
      row.age,
      row.expense,
      row.nationalPension,
      row.spouseNationalPension ?? 0,
      row.unemployment,
      row.healthPremium ?? 0,
      row.grossWithdrawal,
      row.tax,
      localTaxOf(row.tax, row.localIncomeTax),
      row.netWithdrawal,
      row.shortfall,
      row.endingBalance,
      row.financialIncome ?? 0,
      DEPENDENT_STATUS_LABEL[row.dependentStatus],
      (row.dependentReasons ?? []).map((reason) => DEPENDENT_REASON_LABEL[reason]).join(" / "),
    ]),
  );

  // 고도화 이전 리포트에는 월별 값이 없다
  const monthly = scenario.monthly;
  if (monthly && monthly.ym.length > 0) {
    addTableSheet(
      workbook,
      SHEET.monthly,
      [
        { header: "연월", width: 10 },
        { header: "세전 인출", width: 14, won: true },
        { header: "세금", width: 12, won: true },
        { header: "세후 인출", width: 14, won: true },
        { header: "부족", width: 12, won: true },
        { header: "잔액", width: 16, won: true },
      ],
      monthly.ym.map((ym, i) => [
        ym,
        monthly.gross[i] ?? 0,
        monthly.tax[i] ?? 0,
        monthly.net[i] ?? 0,
        monthly.shortfall[i] ?? 0,
        monthly.balance[i] ?? 0,
      ]),
    );
  }

  addKeyValueSheet(workbook, SHEET.basis, [
    {
      title: `규칙 버전 ${content.ruleVersion}`,
      rows: content.basisDates.map((basis) => [
        `${basis.domain} (${basis.effectiveDate})`,
        basis.source,
      ]),
    },
    {
      title: "유의사항",
      rows: content.disclaimers.map((text, i) => [`${i + 1}`, text]),
    },
  ]);

  return workbook;
};

export const createXlsxRenderer =
  () =>
  async (content: ReportContent): Promise<Buffer> =>
    Buffer.from(await buildReportWorkbook(content).xlsx.writeBuffer());
