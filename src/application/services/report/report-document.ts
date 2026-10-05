import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces.js";
import { DEPENDENT_STATUS_LABEL } from "../withdrawal/dependent.js";
import type { PlanItem, ScenarioSummary } from "../withdrawal/types.js";
import { ACTION_LABEL, type ReportContent } from "./report-content.js";

export const REPORT_FONT = "NotoSansKR";

const COLOR = {
  primary: "#1f3a5f",
  muted: "#666666",
  caution: "#c0620f",
  danger: "#c0392b",
  border: "#d9d9d9",
  headerFill: "#f2f4f7",
};

/** 화면과 같은 규칙: 만원 단위 반올림, 천 단위 쉼표 */
export const formatWan = (amount: number): string => {
  if (amount === 0) return "0만원";
  const wan = Math.round(amount / 10_000);
  return `${String(wan).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}만원`;
};

export const formatYm = (ym: string | null): string => {
  if (!ym) return "-";
  const [year, month] = ym.split("-");
  return `${year}년 ${Number(month)}월`;
};

const formatPeriod = (startYm: string | null, endYm: string | null): string => {
  if (!startYm) return "-";
  if (!endYm || startYm === endYm) return formatYm(startYm);
  return `${formatYm(startYm)} ~ ${formatYm(endYm)}`;
};

const formatDate = (iso: string): string => iso.slice(0, 10);

const depletionText = (summary: ScenarioSummary): string =>
  summary.depletionAge === null ? "계산 기간 내 소진 없음" : `${summary.depletionAge}세에 소진`;

const dependentText = (summary: ScenarioSummary, propertyProvided: boolean): string =>
  propertyProvided ? `${summary.dependentLikelyYears}년` : "재산 입력 시 표시";

const sectionTitle = (text: string): Content => ({
  text,
  style: "section",
});

/** 제목이 페이지 맨 아래에 홀로 남지 않게 첫 블록과 묶는다 */
const section = (title: string, first: Content, ...rest: Content[]): Content[] => [
  { stack: [sectionTitle(title), first], unbreakable: true },
  ...rest,
];

const tableLayout = {
  hLineColor: () => COLOR.border,
  vLineColor: () => COLOR.border,
  fillColor: (rowIndex: number) => (rowIndex === 0 ? COLOR.headerFill : null),
  paddingTop: () => 4,
  paddingBottom: () => 4,
};

const headerCell = (text: string): TableCell => ({ text, bold: true });

const planItemBlock = (item: PlanItem): Content => {
  const amounts: Content[] =
    item.actionType === "HOLD"
      ? []
      : [
          {
            text: [
              item.actionType === "LUMP_SUM" ? "수령액 (세전 / 세후) " : "월 평균 (세전 / 세후) ",
              { text: `${formatWan(item.monthlyGross)} / ${formatWan(item.monthlyNet)}`, bold: true },
              item.actionType === "INCOME" ? "" : `  ·  추정 세금 합계 ${formatWan(item.totalTax)}`,
            ],
          },
        ];
  return {
    unbreakable: true,
    margin: [0, 0, 0, 10],
    stack: [
      {
        text: [
          { text: `${item.priority}. ${item.label}`, bold: true },
          { text: `  ${ACTION_LABEL[item.actionType]}`, color: COLOR.primary },
        ],
      },
      { text: formatPeriod(item.startYm, item.endYm), color: COLOR.muted, fontSize: 10 },
      ...amounts,
      { text: [{ text: "실행 방법 ", bold: true }, item.method] },
      { text: [{ text: "세금 ", bold: true }, item.taxNote] },
      { text: [{ text: "건강보험 ", bold: true }, item.healthInsuranceNote] },
      ...(item.cautions.length > 0
        ? [{ ul: item.cautions, color: COLOR.caution, fontSize: 10 } as Content]
        : []),
    ],
  };
};

/** 리포트 스냅샷을 PDF 문서 정의로 바꾼다 (순수 함수 — 폰트·파일 접근 없음) */
export const buildReportDoc = (content: ReportContent): TDocumentDefinitions => {
  const { scenario, inputSummary } = content;
  const propertyProvided = inputSummary.propertyProvided;
  const recommendedTitle =
    content.comparison.find((row) => row.type === content.recommendedType)?.title ??
    content.recommendedType;

  const summaryRows: TableCell[][] = [
    [headerCell("항목"), headerCell("값")],
    ["세후 총 인출", formatWan(scenario.summary.netWithdrawal)],
    ["추정 세금 합계", formatWan(scenario.summary.totalTax)],
    [
      "자산 소진",
      `${depletionText(scenario.summary)}${
        scenario.summary.firstShortfallYm
          ? ` (부족 시작 ${formatYm(scenario.summary.firstShortfallYm)})`
          : ""
      }`,
    ],
    ["피부양자 추정 기간", dependentText(scenario.summary, propertyProvided)],
    ["계산 기간", formatPeriod(content.startYm, content.endYm)],
  ];

  const comparisonRows: TableCell[][] = [
    [headerCell("항목"), ...content.comparison.map((row) => headerCell(`${row.type}안`))],
    ["세후 총 인출", ...content.comparison.map((row) => formatWan(row.summary.netWithdrawal))],
    ["추정 세금", ...content.comparison.map((row) => formatWan(row.summary.totalTax))],
    [
      "자산 소진",
      ...content.comparison.map((row) =>
        row.summary.depletionAge === null ? "없음" : `${row.summary.depletionAge}세`,
      ),
    ],
    [
      "피부양자 추정",
      ...content.comparison.map((row) => dependentText(row.summary, propertyProvided)),
    ],
  ];

  const yearlyRows: TableCell[][] = [
    ["나이", "지출", "세후 인출", "세금", "부족", "연말 잔액", "피부양자"].map(headerCell),
    ...scenario.yearly.map((row): TableCell[] => [
      { text: [`${row.age}세\n`, { text: String(row.year), fontSize: 7, color: COLOR.muted }] },
      formatWan(row.expense),
      formatWan(row.netWithdrawal),
      formatWan(row.tax),
      row.shortfall > 0
        ? { text: formatWan(row.shortfall), color: COLOR.danger }
        : formatWan(row.shortfall),
      formatWan(row.endingBalance),
      DEPENDENT_STATUS_LABEL[row.dependentStatus],
    ]),
  ];

  const checkNeeded = content.accountChecks.filter(
    (check) => check.nonDeductibleStatus === "CHECK_NEEDED",
  );

  return {
    info: { title: content.title },
    pageSize: "A4",
    pageMargins: [40, 48, 40, 56],
    defaultStyle: { font: REPORT_FONT, fontSize: 11, lineHeight: 1.3 },
    styles: {
      title: { fontSize: 20, bold: true, color: COLOR.primary },
      section: { fontSize: 14, bold: true, color: COLOR.primary, margin: [0, 16, 0, 6] },
      muted: { color: COLOR.muted, fontSize: 10 },
    },
    footer: (currentPage: number, pageCount: number): Content => ({
      columns: [
        { text: `${content.title} · 규칙 버전 ${content.ruleVersion}`, style: "muted" },
        { text: `${currentPage} / ${pageCount}`, alignment: "right", style: "muted" },
      ],
      margin: [40, 16, 40, 0],
    }),
    content: [
      { text: content.title, style: "title" },
      {
        text: `생성일 ${formatDate(content.generatedAt)} · 규칙 버전 ${content.ruleVersion}`,
        style: "muted",
        margin: [0, 2, 0, 12],
      },
      {
        text: [
          { text: scenario.title, bold: true, fontSize: 15 },
          scenario.recommended ? { text: "  추천", color: COLOR.primary, bold: true } : "",
        ],
      },
      { text: scenario.goal, margin: [0, 2, 0, 8] },
      {
        table: { widths: [130, "*"], body: summaryRows },
        layout: tableLayout,
      },

      ...section(
        "지금 할 일",
        content.nextActions.length > 0
          ? {
              ol: content.nextActions.map((action) => ({
                text: [
                  { text: `${formatYm(action.startYm ?? content.startYm)}부터 `, bold: true },
                  `${action.label} · ${ACTION_LABEL[action.actionType]}`,
                  action.monthlyNet > 0 ? ` · 월 평균 세후 ${formatWan(action.monthlyNet)}` : "",
                  { text: `\n${action.method}`, style: "muted" },
                ],
                margin: [0, 0, 0, 4],
              })),
            }
          : { text: "지금 바로 실행할 항목이 없습니다.", style: "muted" },
        {
          text: `기본 추천: ${recommendedTitle}. ${content.recommendationNote}`,
          style: "muted",
          margin: [0, 6, 0, 0],
        },
      ),

      ...section(
        "A~D 시나리오 비교",
        {
          table: { headerRows: 1, widths: [90, "*", "*", "*", "*"], body: comparisonRows },
          layout: tableLayout,
          fontSize: 10,
        },
        {
          ul: content.comparison.map(
            (row) => `${row.type}안: ${row.title}${row.recommended ? " (추천)" : ""}`,
          ),
          style: "muted",
          margin: [0, 6, 0, 0],
        },
      ),

      ...section("인출 우선순위", { ol: scenario.priorityOrder }),

      ...section(
        "계좌별 실행안",
        checkNeeded.length > 0
          ? {
              text: `${checkNeeded.map((c) => c.label).join(", ")} 계좌는 비공제 원금 확인이 필요합니다. 금융사의 연금 과세구분 조회 결과를 반영하면 세금이 더 정확해집니다.`,
              color: COLOR.caution,
              margin: [0, 0, 0, 8],
            }
          : { text: "" },
        ...scenario.planItems.map(planItemBlock),
      ),

      // 긴 표라서 새 페이지에서 시작한다
      { text: "연도별 현금흐름 (연간 합계)", style: "section", pageBreak: "before" },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: [40, "*", "*", "*", "*", "*", 50],
          body: yearlyRows,
        },
        layout: tableLayout,
        fontSize: 9,
      },
      {
        text: "피부양자는 “추정 가능 / 주의 / 확인 필요” 세 단계로만 표시하며, 실제 자격은 건강보험공단에서 확인하세요.",
        style: "muted",
        margin: [0, 6, 0, 0],
      },

      ...(scenario.notes.length > 0
        ? section("참고", { ul: scenario.notes, style: "muted" })
        : []),

      ...section(
        "기준일·규칙",
        {
          text: `규칙 버전 ${content.ruleVersion} · ${content.basisDates
            .map((b) => `${b.domain} ${b.effectiveDate}`)
            .join(" · ")}`,
          style: "muted",
        },
        { ul: content.disclaimers, style: "muted", margin: [0, 4, 0, 0] },
      ),
    ],
  };
};
