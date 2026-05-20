import { type jsPDF as JsPdfInstance } from "jspdf";
import { CSS_PT_PER_PX } from "../exportConstants";
import {
  type ExportImageContent,
  type ExportInlineContentRun,
  type ExportInlineTextStyle,
  type ExportRgbColor,
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
// 行内代码横向内边距比例。
const INLINE_CODE_PADDING_X_RATIO = 0.35;
// 行内代码纵向内边距比例。
const INLINE_CODE_PADDING_Y_RATIO = 0.18;
// 上下标字号比例。
const INLINE_SCRIPT_FONT_SIZE_RATIO = 0.65;
// 上下标基线偏移比例。
const INLINE_SCRIPT_BASELINE_OFFSET_RATIO_MAP: Record<NonNullable<ExportInlineTextStyle["script"]>, number> = {
  super: -0.35,
  sub: 0.2,
};
// 行内代码背景色。
const INLINE_CODE_BACKGROUND_COLOR: ExportRgbColor = [241, 245, 249];
// 链接文本颜色。
const LINK_TEXT_COLOR: ExportRgbColor = [29, 78, 216];
// 默认文本颜色。
const DEFAULT_TEXT_COLOR: ExportRgbColor = [17, 17, 17];

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
      /** 文本样式。 */
      style?: ExportInlineTextStyle;
      /** 项目宽度（pt）。 */
      widthPt: number;
      /** 纯文本宽度（pt）。 */
      textWidthPt: number;
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

/** 判断两个行内文本样式是否一致。 */
function isSameInlineTextStyle(leftStyle?: ExportInlineTextStyle, rightStyle?: ExportInlineTextStyle): boolean {
  return (
    Boolean(leftStyle?.bold) === Boolean(rightStyle?.bold) &&
    Boolean(leftStyle?.italic) === Boolean(rightStyle?.italic) &&
    Boolean(leftStyle?.underline) === Boolean(rightStyle?.underline) &&
    Boolean(leftStyle?.strike) === Boolean(rightStyle?.strike) &&
    Boolean(leftStyle?.code) === Boolean(rightStyle?.code) &&
    (leftStyle?.script || "") === (rightStyle?.script || "") &&
    (leftStyle?.linkHref || "") === (rightStyle?.linkHref || "") &&
    isSameRgbColor(leftStyle?.color, rightStyle?.color) &&
    isSameRgbColor(leftStyle?.backgroundColor, rightStyle?.backgroundColor)
  );
}

/** 判断两个 RGB 颜色是否一致。 */
function isSameRgbColor(leftColor?: ExportRgbColor, rightColor?: ExportRgbColor): boolean {
  if (!leftColor || !rightColor) {
    return !leftColor && !rightColor;
  }
  return leftColor[0] === rightColor[0] && leftColor[1] === rightColor[1] && leftColor[2] === rightColor[2];
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

/** 读取行内代码横向内边距。 */
function getInlineCodePaddingXPt(style: ExportTextBlockStyle, textStyle?: ExportInlineTextStyle): number {
  return textStyle?.code ? style.fontSizePt * INLINE_CODE_PADDING_X_RATIO : 0;
}

/** 读取文本片段字体样式。 */
function getInlineFontStyle(textStyle?: ExportInlineTextStyle): string {
  if (textStyle?.bold && textStyle.italic) {
    return "bolditalic";
  }
  if (textStyle?.bold) {
    return "bold";
  }
  if (textStyle?.italic) {
    return "italic";
  }
  return "normal";
}

/** 设置行内文本字体。 */
function setInlineTextFont(pdf: JsPdfInstance, fontFamily: string, textStyle?: ExportInlineTextStyle): void {
  try {
    pdf.setFont(fontFamily, getInlineFontStyle(textStyle));
  } catch {
    pdf.setFont(fontFamily, "normal");
  }
}

/** 读取行内文本颜色。 */
function getInlineTextColor(textStyle?: ExportInlineTextStyle): ExportRgbColor {
  if (textStyle?.linkHref) {
    return LINK_TEXT_COLOR;
  }
  return textStyle?.color || DEFAULT_TEXT_COLOR;
}

/** 设置行内文本颜色。 */
function setInlineTextColor(pdf: JsPdfInstance, textStyle?: ExportInlineTextStyle): void {
  // 文本颜色。
  const textColor = getInlineTextColor(textStyle);
  pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
}

/** 绘制行内文本高亮背景。 */
function drawInlineTextBackground(
  pdf: JsPdfInstance,
  leftPt: number,
  baselineYPt: number,
  widthPt: number,
  fontSizePt: number,
  backgroundColor: ExportRgbColor,
): void {
  // 背景高度。
  const backgroundHeightPt = fontSizePt * 1.05;
  // 背景顶部坐标。
  const backgroundTopPt = baselineYPt - fontSizePt * 0.82;
  pdf.setFillColor(backgroundColor[0], backgroundColor[1], backgroundColor[2]);
  pdf.rect(leftPt, backgroundTopPt, widthPt, backgroundHeightPt, "F");
}

/** 绘制行内代码背景。 */
function drawInlineCodeBackground(
  pdf: JsPdfInstance,
  leftPt: number,
  baselineYPt: number,
  widthPt: number,
  fontSizePt: number,
): void {
  // 背景高度。
  const backgroundHeightPt = fontSizePt + fontSizePt * INLINE_CODE_PADDING_Y_RATIO * 2;
  // 背景顶部坐标。
  const backgroundTopPt = baselineYPt - fontSizePt * 0.82;
  pdf.setFillColor(INLINE_CODE_BACKGROUND_COLOR[0], INLINE_CODE_BACKGROUND_COLOR[1], INLINE_CODE_BACKGROUND_COLOR[2]);
  pdf.roundedRect(leftPt, backgroundTopPt, widthPt, backgroundHeightPt, 2, 2, "F");
}

/** 绘制文本装饰线。 */
function drawInlineTextDecorations(
  pdf: JsPdfInstance,
  textStyle: ExportInlineTextStyle | undefined,
  textLeftPt: number,
  baselineYPt: number,
  textWidthPt: number,
  fontSizePt: number,
): void {
  if (!textStyle?.underline && !textStyle?.strike) {
    return;
  }
  // 文本颜色。
  const textColor = getInlineTextColor(textStyle);
  pdf.setDrawColor(textColor[0], textColor[1], textColor[2]);
  pdf.setLineWidth(Math.max(fontSizePt * 0.04, 0.4));
  if (textStyle.underline) {
    // 下划线 y 坐标。
    const underlineYPt = baselineYPt + fontSizePt * 0.12;
    pdf.line(textLeftPt, underlineYPt, textLeftPt + textWidthPt, underlineYPt);
  }
  if (textStyle.strike) {
    // 删除线 y 坐标。
    const strikeYPt = baselineYPt - fontSizePt * 0.32;
    pdf.line(textLeftPt, strikeYPt, textLeftPt + textWidthPt, strikeYPt);
  }
}

/** 写入链接注释。 */
function writeLinkAnnotation(
  pdf: JsPdfInstance,
  textStyle: ExportInlineTextStyle | undefined,
  textLeftPt: number,
  baselineYPt: number,
  textWidthPt: number,
  fontSizePt: number,
): void {
  if (!textStyle?.linkHref) {
    return;
  }
  // 链接区域顶部坐标。
  const linkTopPt = baselineYPt - fontSizePt * 0.85;
  pdf.link(textLeftPt, linkTopPt, textWidthPt, fontSizePt * 1.2, { url: textStyle.linkHref });
}

/** 写入行内文本项目。 */
function writeInlineTextItem(
  pdf: JsPdfInstance,
  item: Extract<InlineLineItem, { type: "text" }>,
  leftPt: number,
  baselineYPt: number,
  blockStyle: ExportTextBlockStyle,
  fontFamily: string,
): void {
  // 代码横向内边距。
  const codePaddingXPt = getInlineCodePaddingXPt(blockStyle, item.style);
  // 文本起始 x 坐标。
  const textLeftPt = leftPt + codePaddingXPt;
  // 文本实际字号。
  const textFontSizePt = item.style?.script ? blockStyle.fontSizePt * INLINE_SCRIPT_FONT_SIZE_RATIO : blockStyle.fontSizePt;
  // 文本基线偏移比例。
  const textBaselineOffsetRatio = item.style?.script ? INLINE_SCRIPT_BASELINE_OFFSET_RATIO_MAP[item.style.script] : 0;
  // 文本实际基线。
  const textBaselineYPt = baselineYPt + blockStyle.fontSizePt * textBaselineOffsetRatio;
  if (item.style?.backgroundColor && !item.style.code) {
    drawInlineTextBackground(pdf, textLeftPt, textBaselineYPt, item.textWidthPt, textFontSizePt, item.style.backgroundColor);
  }
  if (item.style?.code) {
    drawInlineCodeBackground(pdf, leftPt, textBaselineYPt, item.widthPt, textFontSizePt);
  }
  setInlineTextFont(pdf, fontFamily, item.style);
  pdf.setFontSize(textFontSizePt);
  setInlineTextColor(pdf, item.style);
  pdf.text(item.text, textLeftPt, textBaselineYPt);
  drawInlineTextDecorations(pdf, item.style, textLeftPt, textBaselineYPt, item.textWidthPt, textFontSizePt);
  writeLinkAnnotation(pdf, item.style, textLeftPt, textBaselineYPt, item.textWidthPt, textFontSizePt);
  pdf.setFontSize(blockStyle.fontSizePt);
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
  function appendTextLineItem(text: string, textWidthPt: number, textStyle?: ExportInlineTextStyle): void {
    // 代码横向内边距。
    const codePaddingXPt = getInlineCodePaddingXPt(style, textStyle);
    // 前一个行项目。
    const previousItem = currentLine.items[currentLine.items.length - 1];
    if (previousItem?.type === "text" && isSameInlineTextStyle(previousItem.style, textStyle)) {
      previousItem.text += text;
      previousItem.widthPt += textWidthPt;
      previousItem.textWidthPt += textWidthPt;
      currentLine.widthPt += textWidthPt;
      return;
    } else {
      // 当前项目宽度。
      const widthPt = textWidthPt + codePaddingXPt * 2;
      currentLine.items.push({ type: "text", text, style: textStyle, widthPt, textWidthPt });
      currentLine.widthPt += widthPt;
    }
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
  function collectTextRun(text: string, textStyle?: ExportInlineTextStyle): void {
    setInlineTextFont(pdf, fontFamily, textStyle);
    pdf.setFontSize(textStyle?.script ? style.fontSizePt * INLINE_SCRIPT_FONT_SIZE_RATIO : style.fontSizePt);
    // 待写入字符。
    const characters = Array.from(text);
    characters.forEach((character) => {
      if (!character.trim() && currentLine.widthPt === 0) {
        return;
      }
      // 当前字符宽度。
      const characterWidthPt = pdf.getTextWidth(character);
      // 前一个行项目。
      const previousItem = currentLine.items[currentLine.items.length - 1];
      // 当前字符额外宽度。
      const characterExtraWidthPt =
        previousItem?.type === "text" && isSameInlineTextStyle(previousItem.style, textStyle)
          ? 0
          : getInlineCodePaddingXPt(style, textStyle) * 2;
      if (currentLine.widthPt > 0 && currentLine.widthPt + characterWidthPt + characterExtraWidthPt > lineWidthPt) {
        startNewInlineLine();
      }
      appendTextLineItem(character, characterWidthPt, textStyle);
    });
    pdf.setFontSize(style.fontSizePt);
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
      collectTextRun(run.text, run.style);
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
    pdf.setFont(fontFamily, style.fontStyle);
    pdf.setTextColor(DEFAULT_TEXT_COLOR[0], DEFAULT_TEXT_COLOR[1], DEFAULT_TEXT_COLOR[2]);
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
        writeInlineTextItem(pdf, item, currentXPt, cursor.yPt, style, fontFamily);
      } else {
        // 图片顶部 y 坐标。
        const imageTopPt = cursor.yPt - item.imageSize.heightPt * INLINE_IMAGE_BASELINE_RATIO;
        pdf.addImage(item.imageContent.dataUrl, "PNG", currentXPt, imageTopPt, item.imageSize.widthPt, item.imageSize.heightPt);
      }
      currentXPt += item.widthPt;
    });
    cursor.yPt += style.lineHeightPt;
  });
  pdf.setFont(fontFamily, style.fontStyle);
  pdf.setTextColor(DEFAULT_TEXT_COLOR[0], DEFAULT_TEXT_COLOR[1], DEFAULT_TEXT_COLOR[2]);
  cursor.yPt += style.marginBottomPt;
}
