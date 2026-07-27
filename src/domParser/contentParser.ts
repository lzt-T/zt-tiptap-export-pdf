import { type ExportTextBlockContent } from "../exportTypes";
import {
  getListItemIndentPt,
  getListItemPrefix,
  getListItemText,
  getTaskListMarker,
  getTaskListMarkerStyle,
  isTaskListItem,
} from "./listParser";
import { getTableRows } from "./tableParser";
import { getBlockquoteText, getCodeBlockText } from "./textExtractor";

/** 读取块级节点导出内容。 */
export async function getBlockExportContent(element: HTMLElement, bodyFontSizePx: number): Promise<ExportTextBlockContent> {
  if (element.tagName.toLowerCase() === "table") {
    // 表格行数据。
    const rows = await getTableRows(element, bodyFontSizePx);
    if (rows.length === 0) {
      return { text: "" };
    }
    // 是否全部为空单元格。
    const isAllCellsEmpty = rows.every((row) => row.cells.every((cell) => !cell.text && cell.blocks.length === 0));
    if (isAllCellsEmpty) {
      return { text: "" };
    }
    return {
      text: "[table]",
      blockType: "table",
      tableContent: {
        rows,
      },
    };
  }
  if (element.tagName.toLowerCase() === "blockquote") {
    // 引用块文本。
    const blockquoteText = getBlockquoteText(element);
    if (!blockquoteText) {
      return { text: "" };
    }
    return {
      text: blockquoteText,
      blockType: "blockquote",
    };
  }
  if (element.tagName.toLowerCase() === "pre") {
    // 代码块文本。
    const codeBlockText = getCodeBlockText(element);
    if (!codeBlockText) {
      return { text: "" };
    }
    return {
      text: codeBlockText,
      blockType: "code",
    };
  }
  // 归一化后的文本。
  const normalizedText =
    element.tagName.toLowerCase() === "li"
      ? getListItemText(element)
      : (element.textContent || "").replace(/\s+/g, " ").trim();
  if (!normalizedText) {
    return { text: "" };
  }
  if (element.tagName.toLowerCase() === "li") {
    // 列表缩进（pt）。
    const listIndentPt = getListItemIndentPt(element);
    if (isTaskListItem(element)) {
      return {
        text: normalizedText,
        taskListMarker: getTaskListMarker(element),
        taskListMarkerStyle: getTaskListMarkerStyle(element),
        listIndentPt,
      };
    }
    return {
      text: normalizedText,
      listMarker: getListItemPrefix(element),
      listIndentPt,
    };
  }
  return { text: normalizedText };
}
