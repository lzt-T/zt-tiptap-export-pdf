import { type jsPDF as JsPdfInstance } from "jspdf";
import {
  BLOCKQUOTE_LINE_GAP_PT,
  BLOCKQUOTE_LINE_WIDTH_PT,
  DEFAULT_BLOCK_MARGIN_BOTTOM_PT,
  PDF_TOP_MARGIN_PT,
} from "./exportConstants";
import { splitTextToLines } from "./exportText";
import {
  type ExportTableContent,
  type ExportTaskListMarker,
  type ExportTextBlockStyle,
  type ExportTextBlockType,
  type PdfWriteCursor,
} from "./exportTypes";

// 任务列表方框字号比例。
const TASK_MARKER_SIZE_RATIO = 0.72;
// 任务列表方框与文本间距比例。
const TASK_MARKER_GAP_RATIO = 0.45;
// 任务列表方框最小尺寸（pt）。
const TASK_MARKER_MIN_SIZE_PT = 7;
// 列表内容槽位最小宽度（em）。
const LIST_CONTENT_SLOT_MIN_EM = 1.6;
// 表格默认单元格内边距（pt）。
const TABLE_CELL_PADDING_PT = 6;
// 表格边框宽度（pt）。
const TABLE_BORDER_WIDTH_PT = 0.8;
// 表头背景色灰度值。
const TABLE_HEADER_FILL_GRAY = 243;
// 表格最小段后间距（pt）。
const TABLE_MARGIN_BOTTOM_PT = DEFAULT_BLOCK_MARGIN_BOTTOM_PT;

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
  /** 表格内容。 */
  tableContent?: ExportTableContent;
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

/** 计算表格每列宽度（pt）。 */
function getTableColumnWidthPt(contentWidthPt: number, columnCount: number): number {
  return contentWidthPt / Math.max(columnCount, 1);
}

/** 表格布局单元格。 */
interface TableLayoutCell {
  /** 单元格文本。 */
  text: string;
  /** 单元格起始行索引。 */
  startRowIndex: number;
  /** 单元格起始列索引。 */
  startColumnIndex: number;
  /** 横向合并列数。 */
  colSpan: number;
  /** 纵向合并行数。 */
  rowSpan: number;
  /** 是否为表头行单元格。 */
  isHeaderRow: boolean;
  /** 水平对齐。 */
  textAlign: "left" | "center" | "right";
  /** 垂直对齐。 */
  verticalAlign: "top" | "middle" | "bottom";
}

/** 表格布局结果。 */
interface TableLayoutResult {
  /** 全部起始单元格列表。 */
  cells: TableLayoutCell[];
  /** 总行数。 */
  rowCount: number;
  /** 总列数。 */
  columnCount: number;
}

/** 表格绘制单元格。 */
interface TableRenderCell extends TableLayoutCell {
  /** 单元格拆分后的文本行。 */
  textLines: string[];
  /** 单元格最小高度（pt）。 */
  requiredHeightPt: number;
}

/** 按逻辑网格构建表格布局。 */
function buildTableLayout(tableContent: ExportTableContent): TableLayoutResult {
  // 列占用截止行索引（不含）。
  const columnBlockedUntilRowIndexes: number[] = [];
  // 布局单元格列表。
  const layoutCells: TableLayoutCell[] = [];
  // 最大列数。
  let maxColumnCount = 0;
  tableContent.rows.forEach((row, rowIndex) => {
    // 当前待放置列索引。
    let currentColumnIndex = 0;
    row.cells.forEach((cell) => {
      while ((columnBlockedUntilRowIndexes[currentColumnIndex] || 0) > rowIndex) {
        currentColumnIndex += 1;
      }
      // 当前单元格横向跨度。
      const normalizedColSpan = Math.max(cell.colSpan || 1, 1);
      // 当前单元格纵向跨度。
      const normalizedRowSpan = Math.max(cell.rowSpan || 1, 1);
      for (let spanOffset = 0; spanOffset < normalizedColSpan; spanOffset += 1) {
        const blockedColumnIndex = currentColumnIndex + spanOffset;
        columnBlockedUntilRowIndexes[blockedColumnIndex] = Math.max(
          columnBlockedUntilRowIndexes[blockedColumnIndex] || 0,
          rowIndex + normalizedRowSpan,
        );
      }
      layoutCells.push({
        text: cell.text,
        startRowIndex: rowIndex,
        startColumnIndex: currentColumnIndex,
        colSpan: normalizedColSpan,
        rowSpan: normalizedRowSpan,
        isHeaderRow: row.isHeaderRow,
        textAlign: cell.textAlign,
        verticalAlign: cell.verticalAlign,
      });
      currentColumnIndex += normalizedColSpan;
    });
    maxColumnCount = Math.max(maxColumnCount, currentColumnIndex);
  });
  return {
    cells: layoutCells,
    rowCount: tableContent.rows.length,
    columnCount: maxColumnCount,
  };
}

/** 计算单元格文本行。 */
function getTableCellTextLines(pdf: JsPdfInstance, text: string, textWidthPt: number): string[] {
  // 文本拆行结果。
  const splitLines = splitTextToLines(pdf, text, textWidthPt);
  if (splitLines.length > 0) {
    return splitLines;
  }
  return [""];
}

/** 计算单元格单行文本 x 坐标。 */
function getTableCellLineLeftXPt(
  pdf: JsPdfInstance,
  lineText: string,
  textAlign: "left" | "center" | "right",
  cellLeftXPt: number,
  cellWidthPt: number,
): number {
  // 单元格左侧文本边距起点 x 坐标。
  const leftAlignedXPt = cellLeftXPt + TABLE_CELL_PADDING_PT;
  // 单元格右侧文本边距终点 x 坐标。
  const rightAlignedXPt = cellLeftXPt + cellWidthPt - TABLE_CELL_PADDING_PT;
  if (textAlign === "center") {
    // 当前行文本宽度（pt）。
    const lineWidthPt = pdf.getTextWidth(lineText);
    return cellLeftXPt + (cellWidthPt - lineWidthPt) / 2;
  }
  if (textAlign === "right") {
    // 当前行文本宽度（pt）。
    const lineWidthPt = pdf.getTextWidth(lineText);
    return rightAlignedXPt - lineWidthPt;
  }
  return leftAlignedXPt;
}

/** 计算单元格文本起始基线 y 坐标。 */
function getTableCellTextStartBaselineYPt(
  cellTopYPt: number,
  cellHeightPt: number,
  textLineCount: number,
  lineHeightPt: number,
  verticalAlign: "top" | "middle" | "bottom",
): number {
  // 文本块总高度（pt）。
  const textBlockHeightPt = textLineCount * lineHeightPt;
  // 单元格可用内容高度（pt）。
  const availableContentHeightPt = Math.max(cellHeightPt - TABLE_CELL_PADDING_PT * 2, 0);
  // 默认顶部文本块起始偏移（pt）。
  let textTopOffsetPt = TABLE_CELL_PADDING_PT;
  if (verticalAlign === "middle") {
    textTopOffsetPt = TABLE_CELL_PADDING_PT + Math.max((availableContentHeightPt - textBlockHeightPt) / 2, 0);
  } else if (verticalAlign === "bottom") {
    textTopOffsetPt = TABLE_CELL_PADDING_PT + Math.max(availableContentHeightPt - textBlockHeightPt, 0);
  }
  // 期望起始基线 y 坐标。
  const expectedBaselineYPt = cellTopYPt + textTopOffsetPt + lineHeightPt * 0.8;
  // 基线最小边界。
  const minBaselineYPt = cellTopYPt + TABLE_CELL_PADDING_PT + lineHeightPt * 0.8;
  // 基线最大边界。
  const maxBaselineYPt =
    cellTopYPt + Math.max(cellHeightPt - TABLE_CELL_PADDING_PT - Math.max((textLineCount - 1) * lineHeightPt, 0), lineHeightPt) * 0.8;
  return Math.min(Math.max(expectedBaselineYPt, minBaselineYPt), maxBaselineYPt);
}

/** 计算表格每行高度。 */
function getTableRowHeights(
  renderCells: TableRenderCell[],
  rowCount: number,
  lineHeightPt: number,
): number[] {
  // 每行高度（pt）。
  const rowHeightsPt = Array.from({ length: rowCount }, () => lineHeightPt + TABLE_CELL_PADDING_PT * 2);
  renderCells.forEach((cell) => {
    if (cell.rowSpan === 1) {
      rowHeightsPt[cell.startRowIndex] = Math.max(rowHeightsPt[cell.startRowIndex], cell.requiredHeightPt);
    }
  });
  renderCells.forEach((cell) => {
    if (cell.rowSpan <= 1) {
      return;
    }
    // 合并覆盖结束行（不含）。
    const endRowIndex = Math.min(cell.startRowIndex + cell.rowSpan, rowCount);
    // 当前覆盖范围已分配总高度。
    const allocatedHeightPt = rowHeightsPt
      .slice(cell.startRowIndex, endRowIndex)
      .reduce((totalHeightPt, heightPt) => totalHeightPt + heightPt, 0);
    if (allocatedHeightPt >= cell.requiredHeightPt) {
      return;
    }
    // 当前覆盖范围高度缺口。
    const heightDeficitPt = cell.requiredHeightPt - allocatedHeightPt;
    // 覆盖行数。
    const coveredRowCount = Math.max(endRowIndex - cell.startRowIndex, 1);
    // 均摊到每行的补偿高度。
    const rowHeightDeltaPt = heightDeficitPt / coveredRowCount;
    for (let rowIndex = cell.startRowIndex; rowIndex < endRowIndex; rowIndex += 1) {
      rowHeightsPt[rowIndex] += rowHeightDeltaPt;
    }
  });
  return rowHeightsPt;
}

/** 判断行是否被之前起始的合并单元格覆盖。 */
function getRowCoveredByPreviousRowSpanMap(renderCells: TableRenderCell[], rowCount: number): boolean[] {
  // 行覆盖标记。
  const coveredMap = Array.from({ length: rowCount }, () => false);
  renderCells.forEach((cell) => {
    if (cell.rowSpan <= 1) {
      return;
    }
    const endRowIndex = Math.min(cell.startRowIndex + cell.rowSpan, rowCount);
    for (let rowIndex = cell.startRowIndex + 1; rowIndex < endRowIndex; rowIndex += 1) {
      coveredMap[rowIndex] = true;
    }
  });
  return coveredMap;
}

/** 获取不可拆分页段。 */
function getTableRowSegments(rowCoveredByPreviousRowSpanMap: boolean[]): Array<{ startRowIndex: number; endRowIndex: number }> {
  // 分段列表。
  const segments: Array<{ startRowIndex: number; endRowIndex: number }> = [];
  // 总行数。
  const rowCount = rowCoveredByPreviousRowSpanMap.length;
  // 当前分段起始行。
  let segmentStartRowIndex = 0;
  for (let rowIndex = 1; rowIndex < rowCount; rowIndex += 1) {
    if (rowCoveredByPreviousRowSpanMap[rowIndex]) {
      continue;
    }
    segments.push({
      startRowIndex: segmentStartRowIndex,
      endRowIndex: rowIndex,
    });
    segmentStartRowIndex = rowIndex;
  }
  segments.push({
    startRowIndex: segmentStartRowIndex,
    endRowIndex: rowCount,
  });
  return segments;
}

/** 写入表格文本块。 */
function writeTableTextBlock(
  pdf: JsPdfInstance,
  cursor: PdfWriteCursor,
  { style, fontFamily, tableContent }: WriteTextBlockParams,
): void {
  if (!tableContent || tableContent.rows.length === 0) {
    return;
  }
  // 表格逻辑布局。
  const tableLayout = buildTableLayout(tableContent);
  if (tableLayout.columnCount <= 0 || tableLayout.rowCount <= 0) {
    return;
  }
  pdf.setFont(fontFamily, style.fontStyle);
  pdf.setFontSize(style.fontSizePt);
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(TABLE_BORDER_WIDTH_PT);

  // 列宽（pt）。
  const columnWidthPt = getTableColumnWidthPt(cursor.contentWidthPt, tableLayout.columnCount);
  // 预计算渲染单元格。
  const renderCells: TableRenderCell[] = tableLayout.cells.map((cell) => {
    // 单元格总宽度（pt）。
    const cellWidthPt = columnWidthPt * cell.colSpan;
    // 单元格文本可用宽度（pt）。
    const cellTextWidthPt = Math.max(cellWidthPt - TABLE_CELL_PADDING_PT * 2, 1);
    // 单元格文本行。
    const textLines = getTableCellTextLines(pdf, cell.text, cellTextWidthPt);
    // 单元格最小高度（pt）。
    const requiredHeightPt = textLines.length * style.lineHeightPt + TABLE_CELL_PADDING_PT * 2;
    return {
      ...cell,
      textLines,
      requiredHeightPt,
    };
  });
  // 每行高度（pt）。
  const rowHeightsPt = getTableRowHeights(renderCells, tableLayout.rowCount, style.lineHeightPt);
  // 行顶部 y 偏移（pt）。
  const rowTopOffsetsPt = Array.from({ length: tableLayout.rowCount }, () => 0);
  for (let rowIndex = 1; rowIndex < tableLayout.rowCount; rowIndex += 1) {
    rowTopOffsetsPt[rowIndex] = rowTopOffsetsPt[rowIndex - 1] + rowHeightsPt[rowIndex - 1];
  }
  // 行是否被之前起始的合并单元格覆盖。
  const rowCoveredByPreviousRowSpanMap = getRowCoveredByPreviousRowSpanMap(renderCells, tableLayout.rowCount);
  // 不可拆分页段。
  const tableRowSegments = getTableRowSegments(rowCoveredByPreviousRowSpanMap);
  // 当前基准起始 y 坐标。
  let tableBaseTopYPt = cursor.yPt;

  tableRowSegments.forEach((segment) => {
    // 当前分段高度（pt）。
    const segmentHeightPt = rowHeightsPt
      .slice(segment.startRowIndex, segment.endRowIndex)
      .reduce((totalHeightPt, heightPt) => totalHeightPt + heightPt, 0);
    if (cursor.yPt + segmentHeightPt > cursor.bottomPt) {
      pdf.addPage();
      cursor.yPt = PDF_TOP_MARGIN_PT;
      tableBaseTopYPt = cursor.yPt - rowTopOffsetsPt[segment.startRowIndex];
    }
    for (let rowIndex = segment.startRowIndex; rowIndex < segment.endRowIndex; rowIndex += 1) {
      // 当前行顶部 y 坐标。
      const rowTopYPt = tableBaseTopYPt + rowTopOffsetsPt[rowIndex];
      // 当前行底部 y 坐标。
      const rowBottomYPt = rowTopYPt + rowHeightsPt[rowIndex];
      renderCells.forEach((cell) => {
        if (cell.startRowIndex !== rowIndex) {
          return;
        }
        // 单元格结束行（不含）。
        const endRowIndex = Math.min(cell.startRowIndex + cell.rowSpan, tableLayout.rowCount);
        // 单元格总高度（pt）。
        const cellHeightPt =
          rowTopOffsetsPt[endRowIndex - 1] + rowHeightsPt[endRowIndex - 1] - rowTopOffsetsPt[cell.startRowIndex];
        // 单元格左侧 x 坐标。
        const cellLeftXPt = cursor.leftPt + columnWidthPt * cell.startColumnIndex;
        // 单元格总宽度（pt）。
        const cellWidthPt = columnWidthPt * cell.colSpan;
        if (cell.isHeaderRow) {
          pdf.setFillColor(TABLE_HEADER_FILL_GRAY, TABLE_HEADER_FILL_GRAY, TABLE_HEADER_FILL_GRAY);
          pdf.rect(cellLeftXPt, rowTopYPt, cellWidthPt, cellHeightPt, "F");
        }
        pdf.rect(cellLeftXPt, rowTopYPt, cellWidthPt, cellHeightPt, "S");
        // 单元格文本起始基线 y 坐标。
        const textStartBaselineYPt = getTableCellTextStartBaselineYPt(
          rowTopYPt,
          cellHeightPt,
          cell.textLines.length,
          style.lineHeightPt,
          cell.verticalAlign,
        );
        cell.textLines.forEach((lineText, lineIndex) => {
          // 当前文本行基线 y 坐标。
          const lineBaselineYPt = textStartBaselineYPt + style.lineHeightPt * lineIndex;
          // 当前文本行 x 坐标。
          const lineLeftXPt = getTableCellLineLeftXPt(pdf, lineText, cell.textAlign, cellLeftXPt, cellWidthPt);
          pdf.text(lineText, lineLeftXPt, lineBaselineYPt);
        });
      });
      cursor.yPt = rowBottomYPt;
    }
  });
  cursor.yPt += TABLE_MARGIN_BOTTOM_PT;
}

/** 文本块写入策略。 */
const TEXT_BLOCK_WRITER_MAP: Record<ExportTextBlockType, (pdf: JsPdfInstance, cursor: PdfWriteCursor, params: WriteTextBlockParams) => void> =
  {
    blockquote: writeBlockquoteTextBlock,
    table: writeTableTextBlock,
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
