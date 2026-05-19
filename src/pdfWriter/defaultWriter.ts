import { type jsPDF as JsPdfInstance } from "jspdf";
import { splitTextToLines } from "../exportText";
import { type ExportTaskListMarker, type PdfWriteCursor } from "../exportTypes";
import { ensureLineSpace } from "./shared";
import { type WriteTextBlockParams } from "./types";

// 任务列表方框字号比例。
const TASK_MARKER_SIZE_RATIO = 0.72;
// 任务列表方框与文本间距比例。
const TASK_MARKER_GAP_RATIO = 0.45;
// 任务列表方框最小尺寸（pt）。
const TASK_MARKER_MIN_SIZE_PT = 7;
// 列表内容槽位最小宽度（em）。
const LIST_CONTENT_SLOT_MIN_EM = 1.6;

/** 绘制任务列表标记。 */
function drawTaskListMarker(
  pdf: JsPdfInstance,
  marker: ExportTaskListMarker,
  leftPt: number,
  baselineYPt: number,
  markerSizePt: number,
): void {
  // 方框顶部坐标。
  const markerTopPt = baselineYPt - markerSizePt * 0.8;
  pdf.setDrawColor(17, 17, 17);
  pdf.setLineWidth(0.8);
  pdf.rect(leftPt, markerTopPt, markerSizePt, markerSizePt, "S");

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
  pdf.line(checkStartXPt, checkStartYPt, checkMiddleXPt, checkMiddleYPt);
  pdf.line(checkMiddleXPt, checkMiddleYPt, checkEndXPt, checkEndYPt);
}

/** 写入普通文本块。 */
export function writeDefaultTextBlock(
  pdf: JsPdfInstance,
  cursor: PdfWriteCursor,
  { text, style, fontFamily, taskListMarker, listMarker, listIndentPt }: WriteTextBlockParams,
): void {
  pdf.setFont(fontFamily, style.fontStyle);
  pdf.setFontSize(style.fontSizePt);
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
  const textLeftPt = cursor.leftPt + listTextIndentPt + listContentSlotWidthPt;
  // 文本可用宽度。
  const textWidthPt = cursor.contentWidthPt - listTextIndentPt - listContentSlotWidthPt;
  // 可写入文本行。
  const textLines = splitTextToLines(pdf, text, textWidthPt);
  textLines.forEach((textLine, lineIndex) => {
    ensureLineSpace(pdf, cursor, style.lineHeightPt);
    if (listMarker && lineIndex === 0) {
      pdf.text(listMarker, cursor.leftPt + listTextIndentPt, cursor.yPt);
    }
    if (taskListMarker && lineIndex === 0) {
      drawTaskListMarker(pdf, taskListMarker, cursor.leftPt + listTextIndentPt, cursor.yPt, taskMarkerSizePt);
    }
    pdf.text(textLine, textLeftPt, cursor.yPt);
    cursor.yPt += style.lineHeightPt;
  });
  cursor.yPt += style.marginBottomPt;
}
