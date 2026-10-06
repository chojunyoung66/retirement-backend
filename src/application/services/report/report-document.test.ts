import type { ContentTable } from "pdfmake/interfaces.js";
import { buildReportContent, type ReportContent } from "./report-content.js";
import {
  buildReportDoc,
  formatWan,
  formatYm,
  MONTHLY_DETAIL_MONTHS,
  REPORT_FONT,
} from "./report-document.js";
import { createPdfRenderer } from "./pdf-renderer.js";
import { sampleScenarioSet } from "./report.fixture.js";

const content = buildReportContent(
  sampleScenarioSet(),
  "D",
  new Date("2026-10-06T01:00:00.000Z"),
) as ReportContent;

describe("formatters", () => {
  it("만원 단위로 반올림하고 천 단위 쉼표를 붙인다", () => {
    expect(formatWan(0)).toBe("0만원");
    expect(formatWan(481_950_120)).toBe("48,195만원");
    expect(formatWan(12_345)).toBe("1만원");
  });

  it("연월을 한글로 표시한다", () => {
    expect(formatYm("2026-11")).toBe("2026년 11월");
    expect(formatYm(null)).toBe("-");
  });
});

describe("buildReportDoc", () => {
  const doc = buildReportDoc(content);
  const text = JSON.stringify(doc.content);

  it("한글 폰트와 A4 세로를 쓰고 메타데이터에는 제목만 넣는다", () => {
    expect(doc.pageSize).toBe("A4");
    expect(doc.defaultStyle?.font).toBe(REPORT_FONT);
    expect(doc.info).toEqual({ title: content.title });
  });

  it("요약 금액, 지금 할 일, 계좌별 실행안을 담는다", () => {
    expect(text).toContain(formatWan(content.scenario.summary.netWithdrawal));
    expect(text).toContain(formatWan(content.scenario.summary.totalTax));
    expect(text).toContain("지금 할 일");
    expect(text).toContain(content.nextActions[0].label);
    for (const planItem of content.scenario.planItems) {
      expect(text).toContain(planItem.method);
    }
  });

  it("기준일과 규칙 버전을 표시한다 (AC-10)", () => {
    expect(text).toContain(`규칙 버전 ${content.ruleVersion}`);
    for (const basis of content.basisDates) {
      expect(text).toContain(`${basis.domain} ${basis.effectiveDate}`);
    }
  });

  const blocks = doc.content as (ContentTable & { text?: string; pageOrientation?: string })[];
  const tableWithHeader = (header: string) =>
    blocks.find((block) => JSON.stringify(block?.table?.body?.[0] ?? "").includes(header));

  it("연도별 표는 가로 페이지에서 머리행을 반복하고 모든 연도와 수입 열을 담는다", () => {
    const heading = blocks.find((block) => block.text === "연도별 현금흐름 (연간 합계)");
    expect(heading?.pageOrientation).toBe("landscape");
    const yearly = tableWithHeader("연말 잔액");
    expect(yearly?.table.headerRows).toBe(1);
    const header = JSON.stringify(yearly?.table.body[0]);
    for (const column of ["건보료", "국민연금", "실업급여", "세전 인출", "세후 인출"]) {
      expect(header).toContain(column);
    }
    // 배우자 연금이 없는 페르소나라 열을 뺀다
    expect(header).not.toContain("배우자 연금");
    expect(yearly?.table.body.length).toBe(content.scenario.yearly.length + 1);
  });

  it("입력·가정과 피부양자 판단 근거를 담는다", () => {
    expect(text).toContain("입력·가정");
    expect(text).toContain("물가 상승률");
    expect(text).toContain("피부양자 판단 근거");
  });

  it("월별 상세는 처음 24개월만 세로 페이지로 싣는다", () => {
    const monthly = tableWithHeader("연월");
    expect(monthly?.table.body.length).toBe(MONTHLY_DETAIL_MONTHS + 1);
    const heading = blocks.find((block) => String(block.text ?? "").startsWith("월별 현금흐름"));
    expect(heading?.pageOrientation).toBe("portrait");
  });

  it("100일 실행 체크리스트를 담고, 월별 값이 없는 예전 리포트는 여기서 세로로 되돌린다", () => {
    expect(text).toContain("100일 실행 체크리스트");
    expect(text).toContain("D+100");
    const { monthly: _monthly, ...scenario } = content.scenario;
    const legacy = buildReportDoc({ ...content, scenario }).content as typeof blocks;
    expect(legacy.find((block) => block.text === "100일 실행 체크리스트")?.pageOrientation).toBe(
      "portrait",
    );
    expect(JSON.stringify(legacy)).not.toContain("월별 현금흐름 (처음");
  });

  it("재산을 입력하지 않았으면 피부양자 기간을 숫자로 쓰지 않는다", () => {
    const noProperty = buildReportDoc({
      ...content,
      inputSummary: { ...content.inputSummary, propertyProvided: false },
    });
    expect(JSON.stringify(noProperty.content)).toContain("재산 입력 시 표시");
  });
});

describe("createPdfRenderer", () => {
  it("한글 폰트를 넣은 PDF를 만든다", async () => {
    const pdf = await createPdfRenderer()(content);
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(pdf.length).toBeLessThan(1_500_000);
  }, 30_000);
});
