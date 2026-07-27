import { type jsPDF as JsPdfInstance } from "jspdf";
import { DEFAULT_EXPORT_TEXT_COLOR, PDF_TOP_MARGIN_PT } from "../exportConstants";
import { type ExportRgbColor, type PdfWriteCursor } from "../exportTypes";

/** 设置 PDF 文本颜色，缺失时回退为浅色主题正文色。 */
export function setPdfTextColor(pdf: JsPdfInstance, color?: Readonly<ExportRgbColor>): void {
  // 实际文本颜色。
  const resolvedColor = color || DEFAULT_EXPORT_TEXT_COLOR;
  pdf.setTextColor(resolvedColor[0], resolvedColor[1], resolvedColor[2]);
}

/** 设置 PDF 填充颜色。 */
export function setPdfFillColor(pdf: JsPdfInstance, color: Readonly<ExportRgbColor>): void {
  pdf.setFillColor(color[0], color[1], color[2]);
}

/** 设置 PDF 描边颜色。 */
export function setPdfDrawColor(pdf: JsPdfInstance, color: Readonly<ExportRgbColor>): void {
  pdf.setDrawColor(color[0], color[1], color[2]);
}

/** 确保当前页有足够空间写入下一行。 */
export function ensureLineSpace(pdf: JsPdfInstance, cursor: PdfWriteCursor, lineHeightPt: number): void {
  if (cursor.yPt + lineHeightPt <= cursor.bottomPt) {
    return;
  }
  pdf.addPage();
  cursor.yPt = PDF_TOP_MARGIN_PT;
}
