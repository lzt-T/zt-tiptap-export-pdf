import { type jsPDF as JsPdfInstance } from "jspdf";
import { PDF_TOP_MARGIN_PT } from "./exportConstants";
import { splitTextToLines } from "./exportText";
import { type ExportTextBlockStyle, type PdfWriteCursor } from "./exportTypes";

/** 确保当前页有足够空间写入下一行。 */
function ensureLineSpace(pdf: JsPdfInstance, cursor: PdfWriteCursor, lineHeightPt: number): void {
  if (cursor.yPt + lineHeightPt <= cursor.bottomPt) {
    return;
  }
  pdf.addPage();
  cursor.yPt = PDF_TOP_MARGIN_PT;
}

/** 写入一个文本块。 */
export function writeTextBlock(
  pdf: JsPdfInstance,
  cursor: PdfWriteCursor,
  text: string,
  style: ExportTextBlockStyle,
  fontFamily: string,
): void {
  pdf.setFont(fontFamily, style.fontStyle);
  pdf.setFontSize(style.fontSizePt);
  // 可写入文本行。
  const textLines = splitTextToLines(pdf, text, cursor.contentWidthPt);
  textLines.forEach((textLine) => {
    ensureLineSpace(pdf, cursor, style.lineHeightPt);
    pdf.text(textLine, cursor.leftPt, cursor.yPt);
    cursor.yPt += style.lineHeightPt;
  });
  cursor.yPt += style.marginBottomPt;
}
