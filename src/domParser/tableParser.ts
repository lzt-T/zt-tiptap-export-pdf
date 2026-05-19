import { type ExportTableRow } from "../exportTypes";

/** 读取表格单元格文本。 */
function getTableCellText(element: HTMLElement): string {
  // 归一化后的文本。
  const normalizedText = (element.textContent || "").replace(/\s+/g, " ").trim();
  return normalizedText;
}

/** 解析单元格跨度，非法值回退为 1。 */
function parseTableCellSpan(value: string | null): number {
  // 解析后的跨度值。
  const parsedSpan = Number.parseInt(value || "1", 10);
  if (!Number.isFinite(parsedSpan) || parsedSpan < 1) {
    return 1;
  }
  return parsedSpan;
}

/** 解析单元格水平对齐，非法值回退为 left。 */
function parseTableCellTextAlign(element: HTMLElement): "left" | "center" | "right" {
  // 内联水平对齐样式。
  const inlineTextAlign = element.style.textAlign;
  if (inlineTextAlign === "center" || inlineTextAlign === "right" || inlineTextAlign === "left") {
    return inlineTextAlign;
  }
  // 计算后的水平对齐样式。
  const computedTextAlign = window.getComputedStyle(element).textAlign;
  if (computedTextAlign === "center" || computedTextAlign === "right" || computedTextAlign === "left") {
    return computedTextAlign;
  }
  return "left";
}

/** 解析单元格垂直对齐，非法值回退为 top。 */
function parseTableCellVerticalAlign(element: HTMLElement): "top" | "middle" | "bottom" {
  // 内联垂直对齐样式。
  const inlineVerticalAlign = element.style.verticalAlign;
  if (inlineVerticalAlign === "middle" || inlineVerticalAlign === "bottom" || inlineVerticalAlign === "top") {
    return inlineVerticalAlign;
  }
  // 计算后的垂直对齐样式。
  const computedVerticalAlign = window.getComputedStyle(element).verticalAlign;
  if (computedVerticalAlign === "middle" || computedVerticalAlign === "bottom" || computedVerticalAlign === "top") {
    return computedVerticalAlign;
  }
  return "top";
}

/** 读取表格行内容。 */
export function getTableRows(element: HTMLElement): ExportTableRow[] {
  // 表格行节点。
  const tableRowElements = Array.from(element.querySelectorAll("tr")).filter(
    (tableRowElement): tableRowElement is HTMLTableRowElement => tableRowElement instanceof HTMLTableRowElement,
  );
  // 表格行数据。
  const tableRows: ExportTableRow[] = [];
  tableRowElements.forEach((tableRowElement) => {
    // 当前行单元格节点。
    const tableCellElements = Array.from(tableRowElement.children).filter((tableCellElement): tableCellElement is HTMLElement => {
      if (!(tableCellElement instanceof HTMLElement)) {
        return false;
      }
      const tagName = tableCellElement.tagName.toLowerCase();
      return tagName === "th" || tagName === "td";
    });
    if (tableCellElements.length === 0) {
      return;
    }
    // 当前行单元格列表。
    const cells = tableCellElements.map((tableCellElement) => ({
      text: getTableCellText(tableCellElement),
      colSpan: parseTableCellSpan(tableCellElement.getAttribute("colspan")),
      rowSpan: parseTableCellSpan(tableCellElement.getAttribute("rowspan")),
      textAlign: parseTableCellTextAlign(tableCellElement),
      verticalAlign: parseTableCellVerticalAlign(tableCellElement),
    }));
    tableRows.push({
      cells,
      isHeaderRow: tableCellElements.every((tableCellElement) => tableCellElement.tagName.toLowerCase() === "th"),
    });
  });
  return tableRows;
}
