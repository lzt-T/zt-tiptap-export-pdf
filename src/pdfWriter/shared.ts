import { type jsPDF as JsPdfInstance } from "jspdf";
import { PDF_TOP_MARGIN_PT } from "../exportConstants";
import { type PdfWriteCursor } from "../exportTypes";

/** 确保当前页有足够空间写入下一行。 */
export function ensureLineSpace(pdf: JsPdfInstance, cursor: PdfWriteCursor, lineHeightPt: number): void {
  if (cursor.yPt + lineHeightPt <= cursor.bottomPt) {
    return;
  }
  pdf.addPage();
  cursor.yPt = PDF_TOP_MARGIN_PT;
}
