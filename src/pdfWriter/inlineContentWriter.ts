import { type jsPDF as JsPdfInstance } from "jspdf";
import { CSS_PT_PER_PX } from "../exportConstants";
import {
  type ExportImageContent,
  type ExportInlineContentRun,
  type ExportTaskListMarker,
  type ExportTextBlockStyle,
  type PdfWriteCursor,
} from "../exportTypes";
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

/** 行内图片导出尺寸。 */
interface InlineImageSizePt {
  /** 图片宽度（pt）。 */
  widthPt: number;
  /** 图片高度（pt）。 */
  heightPt: number;
}

/** 行内行项目。 */
type InlineLineItem =
  | {
      /** 项目类型。 */
      type: "text";
      /** 文本内容。 */
      text: string;
      /** 项目宽度（pt）。 */
      widthPt: number;
    }
  | {
      /** 项目类型。 */
      type: "image";
      /** 图片内容。 */
      imageContent: ExportImageContent;
      /** 图片尺寸。 */
      imageSize: InlineImageSizePt;
      /** 项目宽度（pt）。 */
      widthPt: number;
    };

/** 行内内容行。 */
interface InlineContentLine {
  /** 当前行项目列表。 */
  items: InlineLineItem[];
  /** 当前行宽度（pt）。 */
  widthPt: number;
}

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
function getInlineImageSizePt(imageContent: ExportImageContent, lineHeightPt: number): InlineImageSizePt {
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

/** 计算行内内容行起始 x 坐标。 */
function getInlineLineLeftPt(
  textAlign: ExportTextBlockStyle["textAlign"],
  lineLeftPt: number,
  lineRightPt: number,
  lineWidthPt: number,
): number {
  // 行内内容可用宽度。
  const availableWidthPt = lineRightPt - lineLeftPt;
  if (textAlign === "center") {
    return lineLeftPt + Math.max((availableWidthPt - lineWidthPt) / 2, 0);
  }
  if (textAlign === "right") {
    return lineLeftPt + Math.max(availableWidthPt - lineWidthPt, 0);
  }
  return lineLeftPt;
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
  // 行起始 x 坐标。
  const lineLeftPt = cursor.leftPt + blockIndentLeftPt + listTextIndentPt + listContentSlotWidthPt;
  // 行结束 x 坐标。
  const lineRightPt = cursor.leftPt + cursor.contentWidthPt;
  // 行可用宽度。
  const lineWidthPt = lineRightPt - lineLeftPt;
  // 已收集的行内内容行。
  const inlineLines: InlineContentLine[] = [{ items: [], widthPt: 0 }];
  // 当前收集行。
  let currentLine = inlineLines[0];

  /** 开始收集新行。 */
  function startNewInlineLine(): void {
    // 新行内容。
    const newLine: InlineContentLine = { items: [], widthPt: 0 };
    inlineLines.push(newLine);
    currentLine = newLine;
  }

  /** 追加文本行项目。 */
  function appendTextLineItem(text: string, widthPt: number): void {
    // 前一个行项目。
    const previousItem = currentLine.items[currentLine.items.length - 1];
    if (previousItem?.type === "text") {
      previousItem.text += text;
      previousItem.widthPt += widthPt;
    } else {
      currentLine.items.push({ type: "text", text, widthPt });
    }
    currentLine.widthPt += widthPt;
  }

  /** 追加图片行项目。 */
  function appendImageLineItem(imageContent: ExportImageContent, imageSize: InlineImageSizePt): void {
    currentLine.items.push({
      type: "image",
      imageContent,
      imageSize,
      widthPt: imageSize.widthPt,
    });
    currentLine.widthPt += imageSize.widthPt;
  }

  /** 收集文本片段。 */
  function collectTextRun(text: string): void {
    // 待写入字符。
    const characters = Array.from(text);
    characters.forEach((character) => {
      if (!character.trim() && currentLine.widthPt === 0) {
        return;
      }
      // 当前字符宽度。
      const characterWidthPt = pdf.getTextWidth(character);
      if (currentLine.widthPt > 0 && currentLine.widthPt + characterWidthPt > lineWidthPt) {
        startNewInlineLine();
      }
      appendTextLineItem(character, characterWidthPt);
    });
  }

  /** 收集图片片段。 */
  function collectImageRun(imageContent: ExportImageContent): void {
    // 行内图片尺寸。
    const imageSize = getInlineImageSizePt(imageContent, style.lineHeightPt);
    if (currentLine.widthPt > 0 && currentLine.widthPt + imageSize.widthPt > lineWidthPt) {
      startNewInlineLine();
    }
    appendImageLineItem(imageContent, imageSize);
  }

  /** 收集策略中的图片片段。 */
  function collectMappedImageRun(run: ExportInlineContentRun): void {
    if (run.type === "image") {
      collectImageRun(run.imageContent);
    }
  }

  /** 收集策略中的文本片段。 */
  function collectMappedTextRun(run: ExportInlineContentRun): void {
    if (run.type === "text") {
      collectTextRun(run.text);
    }
  }

  // 行内片段收集策略。
  const runCollectorMap: Record<ExportInlineContentRun["type"], (run: ExportInlineContentRun) => void> = {
    image: collectMappedImageRun,
    text: collectMappedTextRun,
  };

  inlineContent.forEach((run) => {
    runCollectorMap[run.type](run);
  });

  // 可写入的行内内容行。
  const printableLines = inlineLines.filter((line) => line.items.length > 0);
  printableLines.forEach((line, lineIndex) => {
    ensureLineSpace(pdf, cursor, style.lineHeightPt);
    if (lineIndex === 0 && listMarker) {
      pdf.text(listMarker, cursor.leftPt + blockIndentLeftPt + listTextIndentPt, cursor.yPt);
    }
    if (lineIndex === 0 && taskListMarker) {
      drawTaskListMarker(
        pdf,
        taskListMarker,
        cursor.leftPt + blockIndentLeftPt + listTextIndentPt,
        cursor.yPt,
        taskMarkerSizePt,
      );
    }
    // 当前行写入 x 坐标。
    let currentXPt = getInlineLineLeftPt(style.textAlign, lineLeftPt, lineRightPt, line.widthPt);
    line.items.forEach((item) => {
      if (item.type === "text") {
        pdf.text(item.text, currentXPt, cursor.yPt);
      } else {
        // 图片顶部 y 坐标。
        const imageTopPt = cursor.yPt - item.imageSize.heightPt * INLINE_IMAGE_BASELINE_RATIO;
        pdf.addImage(item.imageContent.dataUrl, "PNG", currentXPt, imageTopPt, item.imageSize.widthPt, item.imageSize.heightPt);
      }
      currentXPt += item.widthPt;
    });
    cursor.yPt += style.lineHeightPt;
  });
  cursor.yPt += style.marginBottomPt;
}
