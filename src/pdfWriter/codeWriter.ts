import { type jsPDF as JsPdfInstance } from "jspdf";
import {
  CODE_BLOCK_PADDING_X_PT,
  CODE_BLOCK_PADDING_Y_PT,
  DEFAULT_CODE_BLOCK_BACKGROUND_COLOR,
  PDF_TOP_MARGIN_PT,
} from "../exportConstants";
import { splitTextToLines } from "../exportText";
import { type PdfWriteCursor } from "../exportTypes";
import { type WriteTextBlockParams } from "./types";
import { setPdfFillColor, setPdfTextColor } from "./shared";

/** 计算代码块文本行（先保留原始换行，再按宽度折行）。 */
function getCodeBlockLines(pdf: JsPdfInstance, text: string, textWidthPt: number): string[] {
  // 归一化后的代码块文本。
  const normalizedText = text.replace(/\r\n?/g, "\n");
  // 原始换行分段。
  const rawLines = normalizedText.split("\n");
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
  setPdfTextColor(pdf, style.color);
  // 代码块横向内边距。
  const codePaddingXPt = style.paddingXPt || CODE_BLOCK_PADDING_X_PT;
  // 代码块纵向内边距。
  const codePaddingYPt = style.paddingYPt || CODE_BLOCK_PADDING_Y_PT;
  // 代码块文本起始 x 坐标。
  const codeTextLeftPt = cursor.leftPt + codePaddingXPt;
  // 代码块文本可用宽度。
  const codeTextWidthPt = Math.max(cursor.contentWidthPt - codePaddingXPt * 2, 1);
  // 代码块可写入文本行。
  const codeLines = getCodeBlockLines(pdf, text, codeTextWidthPt);
  // 代码块总高度（pt）。
  const codeBlockHeightPt = codeLines.length * style.lineHeightPt + codePaddingYPt * 2;
  // 文本基线偏移。
  const textBaselineOffsetPt = style.lineHeightPt * 0.8;
  // 代码块背景顶部 y 坐标（将“当前文本基线”换算为“块顶”坐标）。
  let codeBlockTopYPt = Math.max(cursor.yPt - textBaselineOffsetPt, PDF_TOP_MARGIN_PT);
  if (codeBlockTopYPt + codeBlockHeightPt > cursor.bottomPt) {
    pdf.addPage();
    cursor.yPt = PDF_TOP_MARGIN_PT;
    codeBlockTopYPt = cursor.yPt;
  }
  // 代码块实际背景颜色。
  const codeBlockBackgroundColor = style.backgroundColor || DEFAULT_CODE_BLOCK_BACKGROUND_COLOR;
  setPdfFillColor(pdf, codeBlockBackgroundColor);
  pdf.rect(cursor.leftPt, codeBlockTopYPt, cursor.contentWidthPt, codeBlockHeightPt, "F");
  // 代码块文本当前基线 y 坐标。
  let lineBaselineYPt = codeBlockTopYPt + codePaddingYPt + textBaselineOffsetPt;
  codeLines.forEach((lineText) => {
    // 清理后的单行文本，避免 jsPDF 隐式按换行绘制多行。
    const drawableLineText = lineText.replace(/[\r\n]/g, "");
    pdf.text(drawableLineText, codeTextLeftPt, lineBaselineYPt);
    lineBaselineYPt += style.lineHeightPt;
  });
  cursor.yPt = codeBlockTopYPt + codeBlockHeightPt + style.marginBottomPt + textBaselineOffsetPt;
}
