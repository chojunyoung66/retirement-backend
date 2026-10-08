import ExcelJS from "exceljs";
import { buildReportContent, type ReportContent } from "./report-content.js";
import { buildReportWorkbook, createXlsxRenderer, SHEET } from "./report-workbook.js";
import { legacySnapshotOf, sampleScenarioSet } from "./report.fixture.js";

const content = buildReportContent(
  sampleScenarioSet(),
  "D",
  new Date("2026-10-06T01:00:00.000Z"),
) as ReportContent;

describe("buildReportWorkbook", () => {
  const workbook = buildReportWorkbook(content);

  it("원본 샘플과 같은 이름의 시트를 순서대로 만든다", () => {
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      SHEET.summary,
      SHEET.input,
      SHEET.comparison,
      SHEET.plan,
      SHEET.annuityLimit,
      SHEET.yearly,
      SHEET.monthly,
      SHEET.basis,
    ]);
  });

  const headerOf = (sheet: ExcelJS.Worksheet) => sheet.getRow(1).values as unknown[];

  it("실행안 시트에 지방소득세·시작 총액·첫해 수령한도·초과 연도 열을 담는다", () => {
    const plan = workbook.getWorksheet(SHEET.plan)!;
    const header = headerOf(plan);
    for (const column of ["지방소득세(포함)", "시작 총액", "첫해 수령한도", "한도 초과 연도"]) {
      expect(header).toContain(column);
    }
    const dcIndex = content.scenario.planItems.findIndex((p) => p.accountType === "DC");
    const dc = content.scenario.planItems[dcIndex];
    const row = plan.getRow(dcIndex + 2);
    expect(row.getCell(header.indexOf("시작 총액")).value).toBe(300_000_000);
    expect(row.getCell(header.indexOf("첫해 수령한도")).value).toBe(dc.annuityLimit!.years[0].limit);
    expect(row.getCell(header.indexOf("지방소득세(포함)")).value).toBe(dc.localIncomeTax);
  });

  it("연금수령한도 시트는 연금계좌의 연차별 행을 담는다", () => {
    const expected = content.scenario.planItems.reduce(
      (sum, item) => sum + (item.annuityLimit?.years.length ?? 0),
      0,
    );
    expect(expected).toBeGreaterThan(0);
    expect(workbook.getWorksheet(SHEET.annuityLimit)!.rowCount).toBe(expected + 1);
  });

  it("요약·비교·연도별 시트에 지방소득세를 담는다", () => {
    const summaryText = JSON.stringify(workbook.getWorksheet(SHEET.summary)!.getSheetValues());
    expect(summaryText).toContain("지방소득세(세금 합계에 포함)");
    expect(headerOf(workbook.getWorksheet(SHEET.comparison)!)).toContain("지방소득세(포함)");
    const yearly = workbook.getWorksheet(SHEET.yearly)!;
    const col = headerOf(yearly).indexOf("지방소득세(포함)");
    expect(yearly.getRow(2).getCell(col).value).toBe(content.scenario.yearly[0].localIncomeTax);
  });

  it("예전 스냅샷은 한도 시트를 빼고 지방소득세는 합계에서 나눠 채운다", () => {
    const legacy = buildReportWorkbook(legacySnapshotOf(content));
    expect(legacy.getWorksheet(SHEET.annuityLimit)).toBeUndefined();
    const yearly = legacy.getWorksheet(SHEET.yearly)!;
    const col = headerOf(yearly).indexOf("지방소득세(포함)");
    expect(yearly.getRow(2).getCell(col).value).toBe(Math.round(content.scenario.yearly[0].tax / 11));
    const plan = legacy.getWorksheet(SHEET.plan)!;
    expect(plan.getRow(2).getCell(headerOf(plan).indexOf("시작 총액")).value).toBeNull();
  });

  it("시나리오·실행안·연도별·월별 시트는 머리행 + 데이터 행 수가 맞다", () => {
    const rows = (name: string) => workbook.getWorksheet(name)!.rowCount;
    expect(rows(SHEET.comparison)).toBe(content.comparison.length + 1);
    expect(rows(SHEET.plan)).toBe(content.scenario.planItems.length + 1);
    expect(rows(SHEET.yearly)).toBe(content.scenario.yearly.length + 1);
    expect(rows(SHEET.monthly)).toBe(content.scenario.monthly!.ym.length + 1);
  });

  it("금액은 숫자로 넣고 천 단위 서식을 건다", () => {
    const yearly = workbook.getWorksheet(SHEET.yearly)!;
    const expense = yearly.getRow(2).getCell(3);
    expect(typeof expense.value).toBe("number");
    expect(expense.value).toBe(content.scenario.yearly[0].expense);
    expect(yearly.getColumn(3).numFmt).toBe("#,##0");
  });

  it("월별 값이 없는 예전 리포트는 월별 시트를 빼고 만든다", () => {
    const { monthly: _monthly, ...scenario } = content.scenario;
    const legacy = buildReportWorkbook({ ...content, scenario });
    expect(legacy.getWorksheet(SHEET.monthly)).toBeUndefined();
  });

  it("기준일과 규칙 버전을 담는다", () => {
    const basis = workbook.getWorksheet(SHEET.basis)!;
    const text = JSON.stringify(basis.getSheetValues());
    expect(text).toContain(content.ruleVersion);
    expect(text).toContain(content.basisDates[0].effectiveDate);
  });
});

describe("createXlsxRenderer", () => {
  it("다시 읽을 수 있는 xlsx 파일을 만든다", async () => {
    const buffer = await createXlsxRenderer()(content);
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(loaded.getWorksheet(SHEET.summary)?.getCell("A1").value).toBe(content.title);
  });
});
