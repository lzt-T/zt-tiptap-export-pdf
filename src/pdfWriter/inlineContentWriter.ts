import { type jsPDF as JsPdfInstance } from "jspdf";
import { CSS_PT_PER_PX } from "../exportConstants";
import { type ExportImageContent, type ExportInlineContentRun, type ExportTaskListMarker, type PdfWriteCursor } from "../exportTypes";
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
// 行内图片最大行高占比。
const INLINE_IMAGE_MAX_LINE_HEIGHT_RATIO = 0.9;
// 行内图片基线对齐比例。
const INLINE_IMAGE_BASELINE_RATIO = 0.82;

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

/** 计算行内图片尺寸。 */
function getInlineImageSizePt(imageContent: ExportImageContent, lineHeightPt: number) {
  // 图片原始宽度（pt）。
  const naturalWidthPt = imageContent.widthPx * CSS_PT_PER_PX;
  // 图片原始高度（pt）。
  const naturalHeightPt = imageContent.heightPx * CSS_PT_PER_PX;
  // 图片最大高度（pt）。
  const maxHeightPt = lineHeightPt * INLINE_IMAGE_MAX_LINE_HEIGHT_RATIO;
  // 图片缩放比例。
  const imageScale = Math.min(maxHeightPt / naturalHeightPt, 1);
  return {
    widthPt: naturalWidthPt * imageScale,
    heightPt: naturalHeightPt * imageScale,
  };
}

/** 写入含行内公式的混合内容块。 */
export function writeInlineContentTextBlock(
  pdf: JsPdfInstance,
  cursor: PdfWriteCursor,
  { inlineContent, style, fontFamily, taskListMarker, listMarker, listIndentPt }: WriteTextBlockParams,
): void {
  if (!inlineContent || inlineContent.length === 0) {
    return;
  }

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
  // 行起始 x 坐标。
  const lineLeftPt = cursor.leftPt + listTextIndentPt + listContentSlotWidthPt;
  // 行结束 x 坐标。
  const lineRightPt = cursor.leftPt + cursor.contentWidthPt;
  // 当前 x 坐标。
  let currentXPt = lineLeftPt;
  // 是否为首行。
  let isFirstLine = true;

  /** 写入新行。 */
  function startNewLine(): void {
    cursor.yPt += style.lineHeightPt;
    currentXPt = lineLeftPt;
    isFirstLine = false;
  }

  /** 确保当前行可写，并绘制列表标记。 */
  function ensureWritableLine(): void {
    ensureLineSpace(pdf, cursor, style.lineHeightPt);
    if (isFirstLine && listMarker) {
      pdf.text(listMarker, cursor.leftPt + listTextIndentPt, cursor.yPt);
    }
    if (isFirstLine && taskListMarker) {
      drawTaskListMarker(pdf, taskListMarker, cursor.leftPt + listTextIndentPt, cursor.yPt, taskMarkerSizePt);
    }
  }

  /** 写入文本片段。 */
  function writeTextRun(text: string): void {
    // 待写入字符。
    const characters = Array.from(text);
    characters.forEach((character) => {
      if (!character.trim() && currentXPt === lineLeftPt) {
        return;
      }
      // 当前字符宽度。
      const characterWidthPt = pdf.getTextWidth(character);
      if (currentXPt > lineLeftPt && currentXPt + characterWidthPt > lineRightPt) {
        startNewLine();
      }
      ensureWritableLine();
      pdf.text(character, currentXPt, cursor.yPt);
      currentXPt += characterWidthPt;
    });
  }

  /** 写入图片片段。 */
  function writeImageRun(imageContent: ExportImageContent): void {
    // 行内图片尺寸。
    const imageSize = getInlineImageSizePt(imageContent, style.lineHeightPt);
    if (currentXPt > lineLeftPt && currentXPt + imageSize.widthPt > lineRightPt) {
      startNewLine();
    }
    ensureWritableLine();
    // 图片顶部 y 坐标。
    const imageTopPt = cursor.yPt - imageSize.heightPt * INLINE_IMAGE_BASELINE_RATIO;
    pdf.addImage(imageContent.dataUrl, "PNG", currentXPt, imageTopPt, imageSize.widthPt, imageSize.heightPt);
    currentXPt += imageSize.widthPt;
  }

  /** 写入策略中的图片片段。 */
  function writeMappedImageRun(run: ExportInlineContentRun): void {
    if (run.type === "image") {
      writeImageRun(run.imageContent);
    }
  }

  /** 写入策略中的文本片段。 */
  function writeMappedTextRun(run: ExportInlineContentRun): void {
    if (run.type === "text") {
      writeTextRun(run.text);
    }
  }

  // 行内片段写入策略。
  const runWriterMap: Record<ExportInlineContentRun["type"], (run: ExportInlineContentRun) => void> = {
    image: writeMappedImageRun,
    text: writeMappedTextRun,
  };

  inlineContent.forEach((run) => {
    runWriterMap[run.type](run);
  });
  cursor.yPt += style.lineHeightPt + style.marginBottomPt;
}
