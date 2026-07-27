import { type jsPDF as JsPdfInstance } from "jspdf";
import { CODE_BLOCK_PADDING_X_PT, CODE_BLOCK_PADDING_Y_PT, CSS_PT_PER_PX } from "../exportConstants";
import { splitTextToLines } from "../exportText";
import {
  type ExportImageContent,
  type ExportInlineContentRun,
  type ExportInlineTextStyle,
  type ExportTableCellBlock,
  type ExportTextBlockContent,
  type ExportTextBlockStyle,
  type PdfWriteCursor,
} from "../exportTypes";
import { writeBlockquoteTextBlock } from "./blockquoteWriter";
import { writeCodeTextBlock } from "./codeWriter";
import { writeDefaultTextBlock } from "./defaultWriter";
import { writeImageTextBlock } from "./imageWriter";
import { writeInlineContentTextBlock } from "./inlineContentWriter";

// 单元格文本类内容顶部到首行基线的比例。
const TABLE_CELL_TEXT_BASELINE_RATIO = 0.8;
// 任务列表方框字号比例。
const TASK_MARKER_SIZE_RATIO = 0.72;
// 任务列表方框与文本间距比例。
const TASK_MARKER_GAP_RATIO = 0.45;
// 任务列表方框最小尺寸（pt）。
const TASK_MARKER_MIN_SIZE_PT = 7;
// 行内图片最大行高占比。
const INLINE_IMAGE_MAX_LINE_HEIGHT_RATIO = 0.9;
// 行内代码横向内边距比例。
const INLINE_CODE_PADDING_X_RATIO = 0.35;
// 上下标字号比例。
const INLINE_SCRIPT_FONT_SIZE_RATIO = 0.65;
// 图片说明文字顶部可视间距（pt）。
const IMAGE_CAPTION_VISIBLE_TOP_GAP_PT = 8;
// 图片说明底部间距（pt）。
const IMAGE_CAPTION_BOTTOM_GAP_PT = 10;

/** 单元格内容绘制参数。 */
export interface WriteTableCellContentParams {
  /** 单元格块级内容。 */
  blocks: ExportTableCellBlock[];
  /** 兼容纯文本内容。 */
  fallbackText: string;
  /** 单元格文本水平对齐。 */
  textAlign: "left" | "center" | "right";
  /** 单元格内容左侧 x 坐标。 */
  leftPt: number;
  /** 单元格内容顶部 y 坐标。 */
  topYPt: number;
  /** 单元格内容宽度（pt）。 */
  contentWidthPt: number;
  /** 表格默认文本样式。 */
  fallbackStyle: ExportTextBlockStyle;
  /** 字体族。 */
  fontFamily: string;
}

/** 文本块高度测量参数。 */
interface MeasureTextBlockParams {
  /** 文本块内容。 */
  content: ExportTextBlockContent;
  /** 文本块样式。 */
  style: ExportTextBlockStyle;
  /** 文本可用宽度（pt）。 */
  contentWidthPt: number;
  /** 字体族。 */
  fontFamily: string;
}

/** 读取行内文本字体样式。 */
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

/** 判断两个 RGB 颜色是否一致。 */
function isSameRgbColor(leftColor?: [number, number, number], rightColor?: [number, number, number]): boolean {
  if (!leftColor || !rightColor) {
    return !leftColor && !rightColor;
  }
  return leftColor[0] === rightColor[0] && leftColor[1] === rightColor[1] && leftColor[2] === rightColor[2];
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

/** 设置测量用行内字体。 */
function setMeasureInlineFont(pdf: JsPdfInstance, fontFamily: string, textStyle?: ExportInlineTextStyle): void {
  try {
    pdf.setFont(fontFamily, getInlineFontStyle(textStyle));
  } catch {
    pdf.setFont(fontFamily, "normal");
  }
}

/** 读取行内代码横向内边距。 */
function getInlineCodePaddingXPt(style: ExportTextBlockStyle, textStyle?: ExportInlineTextStyle): number {
  return textStyle?.code ? style.fontSizePt * INLINE_CODE_PADDING_X_RATIO : 0;
}

/** 计算行内图片尺寸。 */
function getInlineImageSizePt(imageContent: ExportImageContent, lineHeightPt: number): { widthPt: number; heightPt: number } {
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

/** 计算列表内容槽位宽度。 */
function getListContentSlotWidthPt(pdf: JsPdfInstance, content: ExportTextBlockContent, style: ExportTextBlockStyle): number {
  // 任务列表方框尺寸。
  const taskMarkerSizePt = Math.max(style.fontSizePt * TASK_MARKER_SIZE_RATIO, TASK_MARKER_MIN_SIZE_PT);
  // 任务列表槽位宽度。
  const taskMarkerSlotWidthPt = content.taskListMarker ? taskMarkerSizePt + style.fontSizePt * TASK_MARKER_GAP_RATIO : 0;
  // 列表 marker 槽位宽度。
  const listMarkerSlotWidthPt = content.listMarker ? pdf.getTextWidth(content.listMarker) : 0;
  if (content.taskListMarker) {
    return taskMarkerSlotWidthPt;
  }
  return listMarkerSlotWidthPt;
}

/** 计算文本内容实际可用宽度。 */
function getTextContentWidthPt(pdf: JsPdfInstance, content: ExportTextBlockContent, style: ExportTextBlockStyle, contentWidthPt: number): number {
  // 块级缩进。
  const blockIndentLeftPt = style.indentLeftPt || 0;
  // 列表缩进。
  const listTextIndentPt = content.listIndentPt || 0;
  // 列表槽位宽度。
  const listContentSlotWidthPt = getListContentSlotWidthPt(pdf, content, style);
  return Math.max(contentWidthPt - blockIndentLeftPt - listTextIndentPt - listContentSlotWidthPt, 1);
}

/** 计算普通文本行数。 */
function getDefaultTextLineCount(pdf: JsPdfInstance, params: MeasureTextBlockParams): number {
  // 文本可用宽度。
  const textWidthPt = getTextContentWidthPt(pdf, params.content, params.style, params.contentWidthPt);
  // 文本行列表。
  const textLines = splitTextToLines(pdf, params.content.text, textWidthPt);
  return Math.max(textLines.length, 1);
}

/** 计算代码块文本行。 */
function getCodeBlockLines(pdf: JsPdfInstance, text: string, textWidthPt: number): string[] {
  // 归一化后的代码文本。
  const normalizedText = text.replace(/\r\n?/g, "\n");
  // 代码原始行。
  const rawLines = normalizedText.split("\n");
  // 代码可写入行。
  const codeLines: string[] = [];
  rawLines.forEach((rawLine) => {
    // 当前行折行结果。
    const wrappedLines = splitTextToLines(pdf, rawLine, textWidthPt);
    codeLines.push(...(wrappedLines.length > 0 ? wrappedLines : [""]));
  });
  return codeLines;
}

/** 计算引用块行数。 */
function getBlockquoteLineCount(pdf: JsPdfInstance, params: MeasureTextBlockParams): number {
  // 引用文本宽度。
  const quoteTextWidthPt = getTextContentWidthPt(pdf, params.content, params.style, params.contentWidthPt);
  // 引用文本行。
  const quoteLines = params.content.text.split("\n").flatMap((lineText) => splitTextToLines(pdf, lineText, quoteTextWidthPt));
  return Math.max(quoteLines.length, 1);
}

/** 计算行内混合内容行数。 */
function getInlineContentLineCount(pdf: JsPdfInstance, params: MeasureTextBlockParams): number {
  if (!params.content.inlineContent || params.content.inlineContent.length === 0) {
    return 0;
  }
  // 行内内容可用宽度。
  const lineWidthPt = getTextContentWidthPt(pdf, params.content, params.style, params.contentWidthPt);
  // 当前行宽度。
  let currentLineWidthPt = 0;
  // 行数。
  let lineCount = 1;
  // 是否包含可写入内容。
  let hasPrintableContent = false;
  // 当前行最后一个文本样式。
  let previousTextStyle: ExportInlineTextStyle | undefined;

  /** 开启新行。 */
  function startNewLine(): void {
    lineCount += 1;
    currentLineWidthPt = 0;
    previousTextStyle = undefined;
  }

  /** 收集文本片段。 */
  function collectTextRun(text: string, textStyle?: ExportInlineTextStyle): void {
    setMeasureInlineFont(pdf, params.fontFamily, textStyle);
    pdf.setFontSize(textStyle?.script ? params.style.fontSizePt * INLINE_SCRIPT_FONT_SIZE_RATIO : params.style.fontSizePt);
    Array.from(text).forEach((character) => {
      if (!character.trim() && currentLineWidthPt === 0) {
        return;
      }
      // 字符宽度。
      const characterWidthPt = pdf.getTextWidth(character);
      // 字符额外宽度。
      const characterExtraWidthPt = isSameInlineTextStyle(previousTextStyle, textStyle)
        ? 0
        : getInlineCodePaddingXPt(params.style, textStyle) * 2;
      if (currentLineWidthPt > 0 && currentLineWidthPt + characterWidthPt + characterExtraWidthPt > lineWidthPt) {
        startNewLine();
      }
      currentLineWidthPt += characterWidthPt + characterExtraWidthPt;
      previousTextStyle = textStyle;
      hasPrintableContent = true;
    });
    pdf.setFontSize(params.style.fontSizePt);
  }

  /** 收集图片片段。 */
  function collectImageRun(imageContent: ExportImageContent): void {
    // 行内图片尺寸。
    const imageSize = getInlineImageSizePt(imageContent, params.style.lineHeightPt);
    if (currentLineWidthPt > 0 && currentLineWidthPt + imageSize.widthPt > lineWidthPt) {
      startNewLine();
    }
    currentLineWidthPt += imageSize.widthPt;
    previousTextStyle = undefined;
    hasPrintableContent = true;
  }

  // 行内片段收集策略。
  const runCollectorMap: Record<ExportInlineContentRun["type"], (run: ExportInlineContentRun) => void> = {
    image: (run) => {
      if (run.type === "image") {
        collectImageRun(run.imageContent);
      }
    },
    text: (run) => {
      if (run.type === "text") {
        collectTextRun(run.text, run.style);
      }
    },
  };

  params.content.inlineContent.forEach((run) => {
    runCollectorMap[run.type](run);
  });
  return hasPrintableContent ? lineCount : 0;
}

/** 计算图片块高度。 */
function getImageBlockHeightPt(pdf: JsPdfInstance, params: MeasureTextBlockParams): number {
  if (!params.content.imageContent) {
    return 0;
  }
  // 图片原始宽度（pt）。
  const naturalWidthPt = params.content.imageContent.widthPx * CSS_PT_PER_PX;
  // 图片原始高度（pt）。
  const naturalHeightPt = params.content.imageContent.heightPx * CSS_PT_PER_PX;
  // 图片缩放比例。
  const imageScale = Math.min(params.contentWidthPt / naturalWidthPt, 1);
  // 图片宽度（pt）。
  const imageWidthPt = naturalWidthPt * imageScale;
  // 图片高度（pt）。
  const imageHeightPt = naturalHeightPt * imageScale;
  // 图片说明行。
  const captionLines = params.content.imageCaptionText ? splitTextToLines(pdf, params.content.imageCaptionText, imageWidthPt) : [];
  // 图片说明首行基线间距。
  const captionBaselineGapPt = captionLines.length > 0 ? params.style.fontSizePt + IMAGE_CAPTION_VISIBLE_TOP_GAP_PT : 0;
  // 图片说明高度。
  const captionHeightPt = captionLines.length * params.style.lineHeightPt;
  // 图片说明底部间距。
  const captionBottomGapPt = captionLines.length > 0 ? IMAGE_CAPTION_BOTTOM_GAP_PT : 0;
  return imageHeightPt + captionBaselineGapPt + captionHeightPt + captionBottomGapPt + params.style.marginBottomPt;
}

/** 计算单元格块内容高度。 */
function getCellBlockHeightPt(pdf: JsPdfInstance, params: MeasureTextBlockParams): number {
  if (params.content.blockType === "code") {
    // 代码文本可用宽度。
    const textWidthPt = Math.max(params.contentWidthPt - (params.style.paddingXPt || CODE_BLOCK_PADDING_X_PT) * 2, 1);
    // 代码行数。
    const codeLineCount = getCodeBlockLines(pdf, params.content.text, textWidthPt).length;
    return (
      codeLineCount * params.style.lineHeightPt +
      (params.style.paddingYPt || CODE_BLOCK_PADDING_Y_PT) * 2 +
      params.style.marginBottomPt
    );
  }
  if (params.content.blockType === "image") {
    return getImageBlockHeightPt(pdf, params);
  }
  if (params.content.blockType === "inlineContent") {
    // 行内混合内容行数。
    const inlineLineCount = getInlineContentLineCount(pdf, params);
    return inlineLineCount > 0
      ? params.style.lineHeightPt * inlineLineCount + params.style.marginBottomPt
      : 0;
  }
  if (params.content.blockType === "blockquote") {
    // 引用块行数。
    const quoteLineCount = getBlockquoteLineCount(pdf, params);
    return params.style.lineHeightPt * quoteLineCount + params.style.marginBottomPt;
  }
  // 普通文本行数。
  const defaultLineCount = getDefaultTextLineCount(pdf, params);
  return params.style.lineHeightPt * defaultLineCount + params.style.marginBottomPt;
}

/** 读取单元格实际块列表。 */
function getCellContentBlocks(params: WriteTableCellContentParams): ExportTableCellBlock[] {
  if (params.blocks.length > 0) {
    return params.blocks;
  }
  if (!params.fallbackText) {
    return [];
  }
  return [
    {
      content: { text: params.fallbackText },
      style: params.fallbackStyle,
    },
  ];
}

/** 合并单元格默认对齐。 */
function resolveCellBlockStyle(style: ExportTextBlockStyle, textAlign: "left" | "center" | "right"): ExportTextBlockStyle {
  return {
    ...style,
    textAlign: style.textAlign === "left" ? textAlign : style.textAlign,
  };
}

/** 计算表格单元格内容高度。 */
export function getTableCellContentHeightPt(pdf: JsPdfInstance, params: WriteTableCellContentParams): number {
  // 实际块列表。
  const blocks = getCellContentBlocks(params);
  if (blocks.length === 0) {
    return params.fallbackStyle.lineHeightPt;
  }
  return blocks.reduce((totalHeightPt, block) => {
    // 合并后的块样式。
    const blockStyle = resolveCellBlockStyle(block.style, params.textAlign);
    return (
      totalHeightPt +
      getCellBlockHeightPt(pdf, {
        content: block.content,
        style: blockStyle,
        contentWidthPt: params.contentWidthPt,
        fontFamily: params.fontFamily,
      })
    );
  }, 0);
}

/** 创建单元格内部写入游标。 */
function createCellBlockCursor(params: WriteTableCellContentParams, yPt: number): PdfWriteCursor {
  return {
    yPt,
    leftPt: params.leftPt,
    contentWidthPt: params.contentWidthPt,
    pageHeightPt: Number.MAX_SAFE_INTEGER,
    bottomPt: Number.MAX_SAFE_INTEGER,
  };
}

/** 写入单个单元格块内容。 */
function writeCellBlock(pdf: JsPdfInstance, params: WriteTableCellContentParams, block: ExportTableCellBlock, blockTopYPt: number): number {
  // 合并后的块样式。
  const blockStyle = resolveCellBlockStyle(block.style, params.textAlign);
  // 块高度。
  const blockHeightPt = getCellBlockHeightPt(pdf, {
    content: block.content,
    style: blockStyle,
    contentWidthPt: params.contentWidthPt,
    fontFamily: params.fontFamily,
  });
  // 文本类块首行基线。
  const textBaselineYPt = blockTopYPt + blockStyle.lineHeightPt * TABLE_CELL_TEXT_BASELINE_RATIO;
  // 写入游标。
  const cursor = createCellBlockCursor(
    params,
    block.content.blockType === "code" || block.content.blockType === "image" ? blockTopYPt : textBaselineYPt,
  );
  // 图片内容。
  const imageContent = block.content.imageContent
    ? {
        ...block.content.imageContent,
        align: block.content.imageContent.align || params.textAlign,
      }
    : undefined;
  // 块写入参数。
  const writeParams = {
    ...block.content,
    imageContent,
    style: blockStyle,
    fontFamily: params.fontFamily,
  };
  if (block.content.blockType === "code") {
    writeCodeTextBlock(pdf, cursor, writeParams);
  } else if (block.content.blockType === "image") {
    writeImageTextBlock(pdf, cursor, writeParams);
  } else if (block.content.blockType === "inlineContent") {
    writeInlineContentTextBlock(pdf, cursor, writeParams);
  } else if (block.content.blockType === "blockquote") {
    writeBlockquoteTextBlock(pdf, cursor, writeParams);
  } else {
    writeDefaultTextBlock(pdf, cursor, writeParams);
  }
  return blockHeightPt;
}

/** 写入表格单元格内容。 */
export function writeTableCellContent(pdf: JsPdfInstance, params: WriteTableCellContentParams): void {
  // 实际块列表。
  const blocks = getCellContentBlocks(params);
  // 当前块顶部。
  let blockTopYPt = params.topYPt;
  blocks.forEach((block) => {
    blockTopYPt += writeCellBlock(pdf, params, block, blockTopYPt);
  });
  pdf.setFont(params.fontFamily, params.fallbackStyle.fontStyle);
}
