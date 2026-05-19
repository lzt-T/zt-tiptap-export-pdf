import { type jsPDF as JsPdfInstance } from "jspdf";
import { CODE_BLOCK_FILL_GRAY, CODE_BLOCK_PADDING_X_PT, CODE_BLOCK_PADDING_Y_PT, PDF_TOP_MARGIN_PT } from "../exportConstants";
import { splitTextToLines } from "../exportText";
import { type PdfWriteCursor } from "../exportTypes";
import { type WriteTextBlockParams } from "./types";

/** 计算代码块文本行（先保留原始换行，再按宽度折行）。 */
function getCodeBlockLines(pdf: JsPdfInstance, text: string, textWidthPt: number): string[] {
  // 原始换行分段。
  const rawLines = text.split("\n");
  // 代码块可写入文本行。
  const codeLines: string[] = [];
  rawLines.forEach((rawLine) => {
    // 当前分段折行结果。
    const wrappedLines = splitTextToLines(pdf, rawLine, textWidthPt);
    if (wrappedLines.length > 0) {
      codeLines.push(...wrappedLines);
      return;
    }
    codeLines.push("");
  });
  return codeLines;
}

/** 写入代码块。 */
export function writeCodeTextBlock(
  pdf: JsPdfInstance,
  cursor: PdfWriteCursor,
  { text, style, fontFamily }: WriteTextBlockParams,
): void {
  pdf.setFont(fontFamily, style.fontStyle);
  pdf.setFontSize(style.fontSizePt);
  // 代码块文本起始 x 坐标。
  const codeTextLeftPt = cursor.leftPt + CODE_BLOCK_PADDING_X_PT;
  // 代码块文本可用宽度。
  const codeTextWidthPt = Math.max(cursor.contentWidthPt - CODE_BLOCK_PADDING_X_PT * 2, 1);
  // 代码块可写入文本行。
  const codeLines = getCodeBlockLines(pdf, text, codeTextWidthPt);
  // 代码块总高度（pt）。
  const codeBlockHeightPt = codeLines.length * style.lineHeightPt + CODE_BLOCK_PADDING_Y_PT * 2;
  if (cursor.yPt + codeBlockHeightPt > cursor.bottomPt) {
    pdf.addPage();
    cursor.yPt = PDF_TOP_MARGIN_PT;
  }
  // 代码块背景顶部 y 坐标。
  const codeBlockTopYPt = cursor.yPt;
  pdf.setFillColor(CODE_BLOCK_FILL_GRAY, CODE_BLOCK_FILL_GRAY, CODE_BLOCK_FILL_GRAY);
  pdf.rect(cursor.leftPt, codeBlockTopYPt, cursor.contentWidthPt, codeBlockHeightPt, "F");
  // 代码块文本当前基线 y 坐标。
  let lineBaselineYPt = codeBlockTopYPt + CODE_BLOCK_PADDING_Y_PT + style.lineHeightPt * 0.8;
  codeLines.forEach((lineText) => {
    pdf.text(lineText, codeTextLeftPt, lineBaselineYPt);
    lineBaselineYPt += style.lineHeightPt;
  });
  cursor.yPt = codeBlockTopYPt + codeBlockHeightPt + style.marginBottomPt;
}
