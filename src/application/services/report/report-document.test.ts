import type { ContentTable } from "pdfmake/interfaces.js";
import { buildReportContent, type ReportContent } from "./report-content.js";
import { buildReportDoc, formatWan, formatYm, REPORT_FONT } from "./report-document.js";
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

  it("연도별 표는 머리행을 페이지마다 반복하고 모든 연도를 담는다", () => {
    const yearly = (doc.content as ContentTable[]).find(
      (block) => block?.table?.widths?.length === 8,
    );
    expect(yearly?.table.headerRows).toBe(1);
    expect(JSON.stringify(yearly?.table.body[0])).toContain("건보료");
    expect(yearly?.table.body.length).toBe(content.scenario.yearly.length + 1);
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
