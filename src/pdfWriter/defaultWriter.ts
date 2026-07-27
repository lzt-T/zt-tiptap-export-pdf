import { type jsPDF as JsPdfInstance } from "jspdf";
import {
  DEFAULT_EXPORT_BACKGROUND_COLOR,
  DEFAULT_EXPORT_TEXT_COLOR,
  DEFAULT_MUTED_BORDER_COLOR,
} from "../exportConstants";
import { splitTextToLines } from "../exportText";
import {
  type ExportTaskListMarker,
  type ExportTaskListMarkerStyle,
  type ExportTextBlockStyle,
  type PdfWriteCursor,
} from "../exportTypes";
import { ensureLineSpace, setPdfDrawColor, setPdfFillColor, setPdfTextColor } from "./shared";
import { type WriteTextBlockParams } from "./types";

// 任务列表方框字号比例。
const TASK_MARKER_SIZE_RATIO = 0.72;
// 任务列表方框与文本间距比例。
const TASK_MARKER_GAP_RATIO = 0.45;
// 任务列表方框最小尺寸（pt）。
const TASK_MARKER_MIN_SIZE_PT = 7;
// 列表内容槽位最小宽度（em）。
const LIST_CONTENT_SLOT_MIN_EM = 1.6;

/** 计算当前文本行写入 x 坐标。 */
function getTextLineLeftPt(
  pdf: JsPdfInstance,
  textLine: string,
  textAlign: ExportTextBlockStyle["textAlign"],
  textLeftPt: number,
  textWidthPt: number,
): number {
  // 当前行文本宽度。
  const lineWidthPt = pdf.getTextWidth(textLine);
  // 当前行右对齐 x 坐标。
  const rightAlignedXPt = textLeftPt + Math.max(textWidthPt - lineWidthPt, 0);
  if (textAlign === "center") {
    return textLeftPt + Math.max((textWidthPt - lineWidthPt) / 2, 0);
  }
  if (textAlign === "right") {
    return rightAlignedXPt;
  }
  return textLeftPt;
}

/** 绘制任务列表标记。 */
function drawTaskListMarker(
  pdf: JsPdfInstance,
  marker: ExportTaskListMarker,
  leftPt: number,
  baselineYPt: number,
  markerSizePt: number,
  markerStyle?: ExportTaskListMarkerStyle,
): void {
  // 方框顶部坐标。
  const markerTopPt = baselineYPt - markerSizePt * 0.8;
  // 方框边框颜色。
  const borderColor = markerStyle?.borderColor || DEFAULT_MUTED_BORDER_COLOR;
  // 方框背景颜色。
  const backgroundColor =
    markerStyle?.backgroundColor || (marker === "checked" ? DEFAULT_EXPORT_TEXT_COLOR : DEFAULT_EXPORT_BACKGROUND_COLOR);
  setPdfDrawColor(pdf, borderColor);
  setPdfFillColor(pdf, backgroundColor);
  pdf.setLineWidth(0.8);
  pdf.rect(leftPt, markerTopPt, markerSizePt, markerSizePt, "FD");

  if (marker !== "checked") {
    return;
  }

  // 对勾起点 x 坐标。
  const checkStartXPt = leftPt + markerSizePt * 0.22;
  // 对勾起点 y 坐标。
  const checkStartYPt = markerTopPt + markerSizePt * 0.55;
  // 对勾中点 x 坐标。
  const checkMiddleXPt = leftPt + markerSizePt * 0.42;
  // 对勾中点 y 坐标。
  const checkMiddleYPt = markerTopPt + markerSizePt * 0.75;
  // 对勾终点 x 坐标。
  const checkEndXPt = leftPt + markerSizePt * 0.82;
  // 对勾终点 y 坐标。
  const checkEndYPt = markerTopPt + markerSizePt * 0.28;
  // 对勾颜色。
  const checkColor = markerStyle?.checkColor || DEFAULT_EXPORT_BACKGROUND_COLOR;
  setPdfDrawColor(pdf, checkColor);
  pdf.line(checkStartXPt, checkStartYPt, checkMiddleXPt, checkMiddleYPt);
  pdf.line(checkMiddleXPt, checkMiddleYPt, checkEndXPt, checkEndYPt);
}

/** 写入普通文本块。 */
export function writeDefaultTextBlock(
  pdf: JsPdfInstance,
  cursor: PdfWriteCursor,
  { text, style, fontFamily, taskListMarker, taskListMarkerStyle, listMarker, listIndentPt }: WriteTextBlockParams,
): void {
  pdf.setFont(fontFamily, style.fontStyle);
  pdf.setFontSize(style.fontSizePt);
  setPdfTextColor(pdf, style.color);
  // 块级左侧缩进。
  const blockIndentLeftPt = style.indentLeftPt || 0;
  // 列表层级缩进。
  const listTextIndentPt = listIndentPt || 0;
  // 任务列表方框尺寸。
  const taskMarkerSizePt = Math.max(style.fontSizePt * TASK_MARKER_SIZE_RATIO, TASK_MARKER_MIN_SIZE_PT);
  // 任务列表标记宽度。
  const taskMarkerSlotWidthPt = taskListMarker ? taskMarkerSizePt + style.fontSizePt * TASK_MARKER_GAP_RATIO : 0;
  // 列表 marker 文本宽度。
  const listMarkerSlotWidthPt = listMarker ? pdf.getTextWidth(listMarker) : 0;
  // 列表内容槽位最小宽度。
  const listContentMinSlotWidthPt = style.fontSizePt * LIST_CONTENT_SLOT_MIN_EM;
  // 列表内容槽位宽度。
  const listContentSlotWidthPt =
    listMarker || taskListMarker
      ? Math.max(listContentMinSlotWidthPt, listMarkerSlotWidthPt, taskMarkerSlotWidthPt)
      : 0;
  // 文本写入 x 坐标。
  const textLeftPt = cursor.leftPt + blockIndentLeftPt + listTextIndentPt + listContentSlotWidthPt;
  // 文本可用宽度。
  const textWidthPt = cursor.contentWidthPt - blockIndentLeftPt - listTextIndentPt - listContentSlotWidthPt;
  // 可写入文本行。
  const textLines = splitTextToLines(pdf, text, textWidthPt);
  if (textLines.length === 0) {
    ensureLineSpace(pdf, cursor, style.lineHeightPt);
    cursor.yPt += style.lineHeightPt + style.marginBottomPt;
    return;
  }
  textLines.forEach((textLine, lineIndex) => {
    ensureLineSpace(pdf, cursor, style.lineHeightPt);
    if (listMarker && lineIndex === 0) {
      pdf.text(listMarker, cursor.leftPt + blockIndentLeftPt + listTextIndentPt, cursor.yPt);
    }
    if (taskListMarker && lineIndex === 0) {
      drawTaskListMarker(
        pdf,
        taskListMarker,
        cursor.leftPt + blockIndentLeftPt + listTextIndentPt,
        cursor.yPt,
        taskMarkerSizePt,
        taskListMarkerStyle,
      );
    }
    if (style.textAlign === "justify" && lineIndex < textLines.length - 1) {
      pdf.text(textLine, textLeftPt, cursor.yPt, { align: "justify", maxWidth: textWidthPt });
    } else {
      // 当前行写入 x 坐标。
      const textLineLeftPt = getTextLineLeftPt(pdf, textLine, style.textAlign, textLeftPt, textWidthPt);
      pdf.text(textLine, textLineLeftPt, cursor.yPt);
    }
    cursor.yPt += style.lineHeightPt;
  });
  cursor.yPt += style.marginBottomPt;
}
