import path from "node:path";
import { fileURLToPath } from "node:url";
import pdfmake from "pdfmake";
import type { ReportContent } from "./report-content.js";
import { buildReportDoc, REPORT_FONT } from "./report-document.js";

// src/·dist/ 모두 application/services/report 아래에 있어 네 단계 위가 백엔드 루트다
const DEFAULT_FONT_DIR = fileURLToPath(new URL("../../../../assets/fonts/", import.meta.url));

/** 한글 폰트만 읽도록 파일·URL 접근을 막은 PDF 렌더러 */
export const createPdfRenderer = (fontDir: string = DEFAULT_FONT_DIR) => {
  const root = path.resolve(fontDir);
  pdfmake.setFonts({
    [REPORT_FONT]: {
      normal: path.join(root, "NotoSansKR-Regular.ttf"),
      bold: path.join(root, "NotoSansKR-Bold.ttf"),
      italics: path.join(root, "NotoSansKR-Regular.ttf"),
      bolditalics: path.join(root, "NotoSansKR-Bold.ttf"),
    },
  });
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((filePath) => path.resolve(filePath).startsWith(root));

  return (content: ReportContent): Promise<Buffer> =>
    pdfmake.createPdf(buildReportDoc(content)).getBuffer() as Promise<Buffer>;
};
