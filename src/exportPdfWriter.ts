import { type jsPDF as JsPdfInstance } from "jspdf";
import {
  BLOCKQUOTE_LINE_GAP_PT,
  BLOCKQUOTE_LINE_WIDTH_PT,
  PDF_TOP_MARGIN_PT,
} from "./exportConstants";
import { splitTextToLines } from "./exportText";
import { type ExportTaskListMarker, type ExportTextBlockStyle, type ExportTextBlockType, type PdfWriteCursor } from "./exportTypes";

// 任务列表方框字号比例。
const TASK_MARKER_SIZE_RATIO = 0.72;
// 任务列表方框与文本间距比例。
const TASK_MARKER_GAP_RATIO = 0.45;
// 任务列表方框最小尺寸（pt）。
const TASK_MARKER_MIN_SIZE_PT = 7;
// 列表内容槽位最小宽度（em）。
const LIST_CONTENT_SLOT_MIN_EM = 1.6;

/** 确保当前页有足够空间写入下一行。 */
function ensureLineSpace(pdf: JsPdfInstance, cursor: PdfWriteCursor, lineHeightPt: number): void {
  if (cursor.yPt + lineHeightPt <= cursor.bottomPt) {
    return;
  }
  pdf.addPage();
  cursor.yPt = PDF_TOP_MARGIN_PT;
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

/** 文本块写入输入参数。 */
interface WriteTextBlockParams {
  /** 文本内容。 */
  text: string;
  /** 文本块样式。 */
  style: ExportTextBlockStyle;
  /** 字体族。 */
  fontFamily: string;
  /** 任务列表标记。 */
  taskListMarker?: ExportTaskListMarker;
  /** 列表项前缀文本。 */
  listMarker?: string;
  /** 列表项左侧缩进（pt）。 */
  listIndentPt?: number;
  /** 文本块类型。 */
  blockType?: ExportTextBlockType;
}

/** 写入普通文本块。 */
function writeDefaultTextBlock(
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

/** 写入引用块。 */
function writeBlockquoteTextBlock(
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

/** 文本块写入策略。 */
const TEXT_BLOCK_WRITER_MAP: Record<ExportTextBlockType, (pdf: JsPdfInstance, cursor: PdfWriteCursor, params: WriteTextBlockParams) => void> =
  {
    blockquote: writeBlockquoteTextBlock,
  };

/** 写入一个文本块。 */
export function writeTextBlock(pdf: JsPdfInstance, cursor: PdfWriteCursor, params: WriteTextBlockParams): void {
  // 文本块写入策略。
  const writer = params.blockType ? TEXT_BLOCK_WRITER_MAP[params.blockType] : undefined;
  if (writer) {
    writer(pdf, cursor, params);
    return;
  }
  writeDefaultTextBlock(pdf, cursor, params);
}
