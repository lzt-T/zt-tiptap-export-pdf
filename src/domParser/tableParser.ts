import { getTextBlockStyle } from "../exportText";
import { type ExportTableCellBlock, type ExportTableRow, type ExportTextBlockContent } from "../exportTypes";
import {
  getFormulaImageBlockContent,
  getInlineContentBlockContent,
  isBlockFormulaRenderElement,
} from "./formulaParser";
import { getImageBlockExportContent, isImageExportElement } from "./imageParser";
import { getBlockquoteText, getCodeBlockText } from "./textExtractor";

// 块级公式节点选择器。
const BLOCK_MATH_SELECTOR = '.tiptap-mathematics-render[data-type="block-math"]';
// 表格单元格内部可导出的块级节点选择器。
const TABLE_CELL_BLOCK_SELECTOR = `h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,${BLOCK_MATH_SELECTOR},.image-node-wrapper,figure,img[src]`;

/** 读取表格单元格文本。 */
function getTableCellText(element: HTMLElement): string {
  // 归一化后的文本。
  const normalizedText = (element.textContent || "").replace(/\s+/g, " ").trim();
  return normalizedText;
}

/** 判断节点是否位于当前单元格内的嵌套表格中。 */
function isNestedInInnerTable(element: HTMLElement, cellElement: HTMLElement): boolean {
  // 最近的表格节点。
  const closestTable = element.closest("table");
  return closestTable instanceof HTMLTableElement && cellElement.contains(closestTable);
}

/** 判断节点是否位于其他列表项内部。 */
function isNestedInOtherListItem(element: HTMLElement): boolean {
  // 最近的列表项节点。
  const closestListItem = element.closest("li");
  return closestListItem instanceof HTMLElement && closestListItem !== element;
}

/** 判断节点是否位于图片块内部。 */
function isNestedInImageBlock(element: HTMLElement): boolean {
  // 最近的图片块节点。
  const closestImageBlock = element.closest(".image-node-wrapper,figure");
  return closestImageBlock instanceof HTMLElement && closestImageBlock !== element;
}

/** 判断节点是否位于引用块内部。 */
function isNestedInBlockquote(element: HTMLElement): boolean {
  // 最近的引用块节点。
  const closestBlockquote = element.closest("blockquote");
  return closestBlockquote instanceof HTMLElement && closestBlockquote !== element;
}

/** 读取当前单元格内可导出的块级节点。 */
function getTableCellBlockElements(cellElement: HTMLElement): HTMLElement[] {
  // 单元格内候选块级节点。
  const blockElements = Array.from(cellElement.querySelectorAll(TABLE_CELL_BLOCK_SELECTOR)).filter(
    (blockElement): blockElement is HTMLElement => blockElement instanceof HTMLElement,
  );
  return blockElements.filter(
    (blockElement) =>
      !isNestedInInnerTable(blockElement, cellElement) &&
      !isNestedInOtherListItem(blockElement) &&
      !isNestedInImageBlock(blockElement) &&
      !isNestedInBlockquote(blockElement),
  );
}

/** 读取表格内部块级节点内容。 */
async function getTableCellBlockContent(element: HTMLElement): Promise<ExportTextBlockContent> {
  if (isBlockFormulaRenderElement(element)) {
    return getFormulaImageBlockContent(element);
  }
  if (isImageExportElement(element)) {
    return getImageBlockExportContent(element);
  }
  if (element.tagName.toLowerCase() === "blockquote") {
    // 引用块文本。
    const blockquoteText = getBlockquoteText(element);
    return blockquoteText ? { text: blockquoteText, blockType: "blockquote" } : { text: "" };
  }
  if (element.tagName.toLowerCase() === "pre") {
    // 代码块文本。
    const codeBlockText = getCodeBlockText(element);
    return codeBlockText ? { text: codeBlockText, blockType: "code" } : { text: "" };
  }
  return getInlineContentBlockContent(element);
}

/** 读取表格单元格内部块级内容。 */
async function getTableCellBlocks(element: HTMLElement, bodyFontSizePx: number): Promise<ExportTableCellBlock[]> {
  // 单元格内块级节点。
  const blockElements = getTableCellBlockElements(element);
  // 实际解析节点列表。
  const exportElements = blockElements.length > 0 ? blockElements : [element];
  // 单元格块级内容。
  const blocks: ExportTableCellBlock[] = [];

  for (const exportElement of exportElements) {
    // 块级内容。
    const content = await getTableCellBlockContent(exportElement);
    if (!content.text) {
      continue;
    }
    blocks.push({
      content,
      style: getTextBlockStyle(exportElement, bodyFontSizePx),
    });
  }

  return blocks;
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
export async function getTableRows(element: HTMLElement, bodyFontSizePx: number): Promise<ExportTableRow[]> {
  // 表格行节点。
  const tableRowElements = Array.from(element.querySelectorAll("tr")).filter(
    (tableRowElement): tableRowElement is HTMLTableRowElement =>
      tableRowElement instanceof HTMLTableRowElement && tableRowElement.closest("table") === element,
  );
  // 表格行数据。
  const tableRows: ExportTableRow[] = [];
  for (const tableRowElement of tableRowElements) {
    // 当前行单元格节点。
    const tableCellElements = Array.from(tableRowElement.children).filter((tableCellElement): tableCellElement is HTMLElement => {
      if (!(tableCellElement instanceof HTMLElement)) {
        return false;
      }
      const tagName = tableCellElement.tagName.toLowerCase();
      return tagName === "th" || tagName === "td";
    });
    if (tableCellElements.length === 0) {
      continue;
    }
    // 当前行单元格列表。
    const cells = await Promise.all(
      tableCellElements.map(async (tableCellElement) => ({
        text: getTableCellText(tableCellElement),
        blocks: await getTableCellBlocks(tableCellElement, bodyFontSizePx),
        colSpan: parseTableCellSpan(tableCellElement.getAttribute("colspan")),
        rowSpan: parseTableCellSpan(tableCellElement.getAttribute("rowspan")),
        textAlign: parseTableCellTextAlign(tableCellElement),
        verticalAlign: parseTableCellVerticalAlign(tableCellElement),
      })),
    );
    tableRows.push({
      cells,
      isHeaderRow: tableCellElements.every((tableCellElement) => tableCellElement.tagName.toLowerCase() === "th"),
    });
  }
  return tableRows;
}
