import { type jsPDF as JsPdfInstance } from "jspdf";
import { DEFAULT_BLOCK_MARGIN_BOTTOM_PT, PDF_TOP_MARGIN_PT } from "../exportConstants";
import { type ExportTableCellBlock, type ExportTableContent, type PdfWriteCursor } from "../exportTypes";
import { getTableCellContentHeightPt, writeTableCellContent } from "./tableCellContentWriter";
import { type WriteTextBlockParams } from "./types";

// 表格默认单元格内边距（pt）。
const TABLE_CELL_PADDING_PT = 6;
// 表格边框宽度（pt）。
const TABLE_BORDER_WIDTH_PT = 0.8;
// 表头背景色灰度值。
const TABLE_HEADER_FILL_GRAY = 243;
// 表格最小段后间距（pt）。
const TABLE_MARGIN_BOTTOM_PT = DEFAULT_BLOCK_MARGIN_BOTTOM_PT;
// 表格后下一段文本首行基线偏移比例。
const TABLE_NEXT_TEXT_BASELINE_RATIO = 0.8;

/** 表格布局单元格。 */
interface TableLayoutCell {
  /** 单元格文本。 */
  text: string;
  /** 单元格内块级内容。 */
  blocks: ExportTableCellBlock[];
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
  /** 单元格最小高度（pt）。 */
  requiredHeightPt: number;
}

/** 计算表格每列宽度（pt）。 */
function getTableColumnWidthPt(contentWidthPt: number, columnCount: number): number {
  return contentWidthPt / Math.max(columnCount, 1);
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
        blocks: cell.blocks,
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

/** 计算单元格内容顶部 y 坐标。 */
function getTableCellContentTopYPt(
  cellTopYPt: number,
  cellHeightPt: number,
  contentHeightPt: number,
  verticalAlign: "top" | "middle" | "bottom",
): number {
  // 单元格可用内容高度（pt）。
  const availableContentHeightPt = Math.max(cellHeightPt - TABLE_CELL_PADDING_PT * 2, 0);
  // 默认内容起始偏移（pt）。
  let contentTopOffsetPt = TABLE_CELL_PADDING_PT;
  if (verticalAlign === "middle") {
    contentTopOffsetPt = TABLE_CELL_PADDING_PT + Math.max((availableContentHeightPt - contentHeightPt) / 2, 0);
  } else if (verticalAlign === "bottom") {
    contentTopOffsetPt = TABLE_CELL_PADDING_PT + Math.max(availableContentHeightPt - contentHeightPt, 0);
  }
  return cellTopYPt + contentTopOffsetPt;
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
export function writeTableTextBlock(
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
    // 单元格内容可用宽度（pt）。
    const cellContentWidthPt = Math.max(cellWidthPt - TABLE_CELL_PADDING_PT * 2, 1);
    // 单元格最小高度（pt）。
    const requiredHeightPt =
      getTableCellContentHeightPt(pdf, {
        blocks: cell.blocks,
        fallbackText: cell.text,
        textAlign: cell.textAlign,
        leftPt: 0,
        topYPt: 0,
        contentWidthPt: cellContentWidthPt,
        fallbackStyle: style,
        fontFamily,
      }) +
      TABLE_CELL_PADDING_PT * 2;
    return {
      ...cell,
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
        // 单元格内容高度（pt）。
        const cellContentHeightPt = Math.max(cell.requiredHeightPt - TABLE_CELL_PADDING_PT * 2, 0);
        // 单元格内容顶部 y 坐标。
        const contentTopYPt = getTableCellContentTopYPt(
          rowTopYPt,
          cellHeightPt,
          cellContentHeightPt,
          cell.verticalAlign,
        );
        writeTableCellContent(pdf, {
          blocks: cell.blocks,
          fallbackText: cell.text,
          textAlign: cell.textAlign,
          leftPt: cellLeftXPt + TABLE_CELL_PADDING_PT,
          topYPt: contentTopYPt,
          contentWidthPt: Math.max(cellWidthPt - TABLE_CELL_PADDING_PT * 2, 1),
          fallbackStyle: style,
          fontFamily,
        });
      });
      cursor.yPt = rowBottomYPt;
    }
  });
  cursor.yPt += TABLE_MARGIN_BOTTOM_PT + style.lineHeightPt * TABLE_NEXT_TEXT_BASELINE_RATIO;
}
