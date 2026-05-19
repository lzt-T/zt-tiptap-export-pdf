import { type jsPDF as JsPdfInstance } from "jspdf";
import { BLOCKQUOTE_LINE_GAP_PT, BLOCKQUOTE_LINE_WIDTH_PT } from "../exportConstants";
import { splitTextToLines } from "../exportText";
import { type PdfWriteCursor } from "../exportTypes";
import { ensureLineSpace } from "./shared";
import { type WriteTextBlockParams } from "./types";

/** 写入引用块。 */
export function writeBlockquoteTextBlock(
  pdf: JsPdfInstance,
  cursor: PdfWriteCursor,
  { text, style, fontFamily }: WriteTextBlockParams,
): void {
  pdf.setFont(fontFamily, style.fontStyle);
  pdf.setFontSize(style.fontSizePt);
  // 引用块文本左侧缩进（pt）。
  const quoteIndentPt = style.indentLeftPt || 0;
  // 引用块竖线与文本总缩进（pt）。
  const quoteTextIndentPt = quoteIndentPt + BLOCKQUOTE_LINE_GAP_PT;
  // 引用块文本写入 x 坐标。
  const quoteTextLeftPt = cursor.leftPt + quoteTextIndentPt;
  // 引用块文本可用宽度。
  const quoteTextWidthPt = cursor.contentWidthPt - quoteTextIndentPt;
  // 引用块文本行列表。
  const quoteLines = text.split("\n").flatMap((lineText) => splitTextToLines(pdf, lineText, quoteTextWidthPt));
  quoteLines.forEach((lineText) => {
    ensureLineSpace(pdf, cursor, style.lineHeightPt);
    // 当前行竖线起点 y 坐标。
    const lineStartYPt = cursor.yPt - style.lineHeightPt * 0.8;
    // 当前行竖线终点 y 坐标。
    const lineEndYPt = cursor.yPt + style.lineHeightPt * 0.2;
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(BLOCKQUOTE_LINE_WIDTH_PT);
    pdf.line(cursor.leftPt, lineStartYPt, cursor.leftPt, lineEndYPt);
    pdf.text(lineText, quoteTextLeftPt, cursor.yPt);
    cursor.yPt += style.lineHeightPt;
  });
  cursor.yPt += style.marginBottomPt;
}
