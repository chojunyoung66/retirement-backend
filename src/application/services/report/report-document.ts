import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces.js";
import { buildExecutionChecklist } from "../../rules/execution-checklist.js";
import { DEPENDENT_STATUS_LABEL } from "../withdrawal/dependent.js";
import type { PlanItem, ScenarioSummary, YearRow } from "../withdrawal/types.js";
import { ACTION_LABEL, type ReportContent } from "./report-content.js";
import { assumptionRows, dependentReasonGroups, inputSummaryRows } from "./report-labels.js";

/** 월별 상세 표는 처음 2년만 싣는다 — 전체는 엑셀에 담는다 */
export const MONTHLY_DETAIL_MONTHS = 24;

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

const amountCell = (amount: number, danger = false): TableCell =>
  danger && amount > 0
    ? { text: formatWan(amount), color: COLOR.danger, alignment: "right" }
    : { text: formatWan(amount), alignment: "right" };

const keyValueTable = (rows: [string, string][]): Content => ({
  table: { widths: [150, "*"], body: [[headerCell("항목"), headerCell("값")], ...rows] },
  layout: tableLayout,
});

interface YearColumn {
  header: string;
  cell: (row: YearRow) => TableCell;
}

/** 배우자 연금·실업급여처럼 값이 없는 열은 뺀다 (가로 페이지 폭 확보) */
const yearColumns = (yearly: YearRow[]): YearColumn[] => {
  const hasValue = (pick: (row: YearRow) => number | undefined) =>
    yearly.some((row) => (pick(row) ?? 0) > 0);
  const columns: (YearColumn | null)[] = [
    {
      header: "나이",
      cell: (row) => ({
        text: [`${row.age}세\n`, { text: String(row.year), fontSize: 7, color: COLOR.muted }],
      }),
    },
    { header: "지출", cell: (row) => amountCell(row.expense) },
    // 고도화 이전 리포트에는 건보료 필드가 없다
    { header: "건보료", cell: (row) => amountCell(row.healthPremium ?? 0) },
    { header: "국민연금", cell: (row) => amountCell(row.nationalPension) },
    hasValue((row) => row.spouseNationalPension)
      ? { header: "배우자 연금", cell: (row) => amountCell(row.spouseNationalPension) }
      : null,
    hasValue((row) => row.unemployment)
      ? { header: "실업급여", cell: (row) => amountCell(row.unemployment) }
      : null,
    { header: "세전 인출", cell: (row) => amountCell(row.grossWithdrawal) },
    { header: "세금", cell: (row) => amountCell(row.tax) },
    { header: "세후 인출", cell: (row) => amountCell(row.netWithdrawal) },
    { header: "부족", cell: (row) => amountCell(row.shortfall, true) },
    { header: "연말 잔액", cell: (row) => amountCell(row.endingBalance) },
    { header: "피부양자", cell: (row) => DEPENDENT_STATUS_LABEL[row.dependentStatus] },
  ];
  return columns.filter((column): column is YearColumn => column !== null);
};

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
        ? [
            { text: "운영 메모", bold: true, fontSize: 10 } as Content,
            { ul: item.cautions, color: COLOR.caution, fontSize: 10 } as Content,
          ]
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

  const columns = yearColumns(scenario.yearly);
  const yearlyRows: TableCell[][] = [
    columns.map((column) => headerCell(column.header)),
    ...scenario.yearly.map((row) => columns.map((column) => column.cell(row))),
  ];
  const reasonGroups = dependentReasonGroups(scenario.yearly);

  const monthly = scenario.monthly;
  const monthlyRows: TableCell[][] | null =
    monthly && monthly.ym.length > 0
      ? [
          ["연월", "세전 인출", "세금", "세후 인출", "부족", "잔액"].map(headerCell),
          ...monthly.ym.slice(0, MONTHLY_DETAIL_MONTHS).map((ym, i): TableCell[] => [
            formatYm(ym),
            amountCell(monthly.gross[i] ?? 0),
            amountCell(monthly.tax[i] ?? 0),
            amountCell(monthly.net[i] ?? 0),
            amountCell(monthly.shortfall[i] ?? 0, true),
            amountCell(monthly.balance[i] ?? 0),
          ]),
        ]
      : null;

  const checklist = buildExecutionChecklist(content, new Date(content.generatedAt));

  const checkNeeded = content.accountChecks.filter(
    (check) => check.nonDeductibleStatus === "CHECK_NEEDED",
  );

  // 고도화 이전 리포트에는 ISA 전략이 없다
  const isaBlocks: Content[] = (content.isaStrategy ?? []).map((isa) => ({
    stack: [
      {
        text: [
          { text: isa.label, bold: true },
          ` · 추가 공제대상 ${formatWan(isa.extraCreditBase)} · 최대 세액공제 약 ${formatWan(isa.maxTaxCreditEstimate)}`,
        ],
      },
      { ul: isa.notes, style: "muted" },
    ],
    margin: [0, 0, 0, 6],
  }));

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
      // 표지 — 첫 페이지에 선택안과 핵심 요약을 함께 둔다
      {
        stack: [
          { text: "RETIREMENT CASH PLAN", color: COLOR.muted, fontSize: 9, characterSpacing: 1 },
          { text: content.title, style: "title", margin: [0, 4, 0, 0] },
          {
            text: `생성일 ${formatDate(content.generatedAt)} · 규칙 버전 ${content.ruleVersion} · 계산 기간 ${formatPeriod(content.startYm, content.endYm)}`,
            style: "muted",
            margin: [0, 2, 0, 0],
          },
        ],
        margin: [0, 0, 0, 14],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: COLOR.primary }],
        margin: [0, 0, 0, 12],
      },
      {
        text: [
          { text: "선택한 실행안  ", color: COLOR.muted, fontSize: 10 },
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
        "입력·가정",
        keyValueTable(inputSummaryRows(content, formatWan)),
        { stack: [keyValueTable(assumptionRows(content))], margin: [0, 8, 0, 0] },
        {
          text: "이름·이메일·계좌번호 같은 식별정보는 리포트에 담지 않습니다.",
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

      ...(isaBlocks.length > 0
        ? section("ISA 만기·연금계좌 전환", isaBlocks[0]!, ...isaBlocks.slice(1))
        : []),

      // 열이 많은 표라서 가로 페이지에서 시작한다
      {
        text: "연도별 현금흐름 (연간 합계)",
        style: "section",
        pageBreak: "before",
        pageOrientation: "landscape",
      },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: columns.map((column, i) =>
            i === 0 ? 40 : column.header === "피부양자" ? 50 : "*",
          ),
          body: yearlyRows,
        },
        layout: tableLayout,
        fontSize: 8,
      },
      {
        text: "피부양자는 “추정 가능 / 주의 / 확인 필요” 세 단계로만 표시하며, 실제 자격은 건강보험공단에서 확인하세요.",
        style: "muted",
        margin: [0, 6, 0, 0],
      },
      ...(reasonGroups.length > 0
        ? section(
            "피부양자 판단 근거",
            {
              ul: reasonGroups.map((group) => ({
                text: [{ text: `${group.years}  `, bold: true }, group.label],
              })),
              fontSize: 10,
            },
          )
        : []),

      ...(monthlyRows
        ? [
            {
              text: `월별 현금흐름 (처음 ${Math.min(MONTHLY_DETAIL_MONTHS, monthlyRows.length - 1)}개월)`,
              style: "section",
              pageBreak: "before",
              pageOrientation: "portrait",
            } as Content,
            {
              table: { headerRows: 1, dontBreakRows: true, widths: [70, "*", "*", "*", "*", "*"], body: monthlyRows },
              layout: tableLayout,
              fontSize: 9,
            } as Content,
            {
              text: "전체 기간의 월별 값은 엑셀 파일에 담겨 있습니다.",
              style: "muted",
              margin: [0, 6, 0, 0],
            } as Content,
          ]
        : []),

      // 연도별 표가 가로라서 월별 표가 없으면 여기서 세로 페이지로 되돌린다
      {
        text: "100일 실행 체크리스트",
        style: "section",
        ...(monthlyRows ? {} : { pageBreak: "before", pageOrientation: "portrait" }),
      } as Content,
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: [50, "*", 30],
          body: [
            [headerCell("기한"), headerCell("할 일"), headerCell("완료")],
            ...checklist.map((item): TableCell[] => [`D+${item.dueDay}`, item.label, "□"]),
          ],
        },
        layout: tableLayout,
        fontSize: 10,
      },
      {
        text: "앱의 ‘100일 실행’ 화면에서 완료 여부를 기록하고 진행률을 확인할 수 있습니다.",
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
