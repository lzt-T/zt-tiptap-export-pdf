import { CSS_PT_PER_PX, LIST_ITEM_PREFIX } from "../exportConstants";
import { type ExportTaskListMarker } from "../exportTypes";

// 列表层级缩进兜底步长（px）。
const DEFAULT_LIST_LEVEL_INDENT_PX = 32;

/** 判断列表项是否属于任务列表。 */
export function isTaskListItem(element: HTMLElement): boolean {
  // 最近的列表容器。
  const closestList = element.closest("ul,ol");
  return (
    element.dataset.type === "taskItem" ||
    closestList?.getAttribute("data-type") === "taskList" ||
    element.querySelector('input[type="checkbox"]') instanceof HTMLInputElement
  );
}

/** 获取任务列表项标记。 */
export function getTaskListMarker(element: HTMLElement): ExportTaskListMarker {
  // 任务复选框。
  const checkboxElement = element.querySelector('input[type="checkbox"]');
  // 任务项选中状态。
  const isChecked =
    element.getAttribute("data-checked") === "true" || (checkboxElement instanceof HTMLInputElement && checkboxElement.checked);
  if (isChecked) {
    return "checked";
  }
  return "unchecked";
}

/** 获取有序列表项序号前缀。 */
function getOrderedListItemPrefix(element: HTMLElement): string {
  // 有序列表容器。
  const orderedListElement = element.parentElement;
  if (!(orderedListElement instanceof HTMLOListElement)) {
    return LIST_ITEM_PREFIX;
  }
  // 同级列表项。
  const siblingListItems = Array.from(orderedListElement.children).filter(
    (childElement): childElement is HTMLLIElement => childElement instanceof HTMLLIElement,
  );
  // 当前列表项序号。
  const itemIndex = siblingListItems.indexOf(element as HTMLLIElement);
  // 有序列表起始序号。
  const startIndex = Number.parseInt(orderedListElement.getAttribute("start") || "1", 10);
  // 当前列表项样式。
  const listItemComputedStyle = window.getComputedStyle(element);
  return resolveOrderedListMarker(itemIndex + startIndex, listItemComputedStyle.listStyleType);
}

/** 获取列表项前缀。 */
export function getListItemPrefix(element: HTMLElement): string {
  if (element.parentElement instanceof HTMLOListElement) {
    return getOrderedListItemPrefix(element);
  }
  if (!(element.parentElement instanceof HTMLUListElement)) {
    return LIST_ITEM_PREFIX;
  }
  // 当前列表项样式。
  const listItemComputedStyle = window.getComputedStyle(element);
  return resolveUnorderedListMarker(listItemComputedStyle.listStyleType);
}

/** 将正整数转换为小写字母序号。 */
function toLowerAlpha(value: number): string {
  // 剩余待转换数值。
  let remainingValue = Math.max(value, 1);
  // 转换后的字母序列。
  let result = "";
  while (remainingValue > 0) {
    // 当前字符索引（0-25）。
    const charIndex = (remainingValue - 1) % 26;
    result = `${String.fromCharCode(97 + charIndex)}${result}`;
    remainingValue = Math.floor((remainingValue - 1) / 26);
  }
  return result;
}

/** 将正整数转换为小写罗马数字。 */
function toLowerRoman(value: number): string {
  // 罗马数字映射表。
  const romanMap: Array<{ symbol: string; value: number }> = [
    { symbol: "m", value: 1000 },
    { symbol: "cm", value: 900 },
    { symbol: "d", value: 500 },
    { symbol: "cd", value: 400 },
    { symbol: "c", value: 100 },
    { symbol: "xc", value: 90 },
    { symbol: "l", value: 50 },
    { symbol: "xl", value: 40 },
    { symbol: "x", value: 10 },
    { symbol: "ix", value: 9 },
    { symbol: "v", value: 5 },
    { symbol: "iv", value: 4 },
    { symbol: "i", value: 1 },
  ];
  // 剩余待转换数值。
  let remainingValue = Math.max(value, 1);
  // 转换后的罗马数字。
  let result = "";
  romanMap.forEach(({ symbol, value: romanValue }) => {
    while (remainingValue >= romanValue) {
      result += symbol;
      remainingValue -= romanValue;
    }
  });
  return result;
}

/** 根据 CSS list-style-type 生成有序列表 marker。 */
function resolveOrderedListMarker(index: number, listStyleType: string): string {
  if (listStyleType === "lower-alpha") {
    return `${toLowerAlpha(index)}. `;
  }
  if (listStyleType === "upper-alpha") {
    return `${toLowerAlpha(index).toUpperCase()}. `;
  }
  if (listStyleType === "lower-roman") {
    return `${toLowerRoman(index)}. `;
  }
  if (listStyleType === "upper-roman") {
    return `${toLowerRoman(index).toUpperCase()}. `;
  }
  return `${index}. `;
}

/** 根据 CSS list-style-type 生成无序列表 marker。 */
function resolveUnorderedListMarker(listStyleType: string): string {
  if (listStyleType === "circle") {
    return "◦ ";
  }
  if (listStyleType === "square") {
    return "▪ ";
  }
  return LIST_ITEM_PREFIX;
}

/** 读取最近有效列表容器的缩进步长（px）。 */
function getListIndentStepPx(element: HTMLElement): number {
  // 当前遍历节点。
  let currentElement: HTMLElement | null = element;
  while (currentElement) {
    // 当前节点所属列表容器。
    const parentListElement = currentElement.parentElement;
    if (parentListElement instanceof HTMLUListElement || parentListElement instanceof HTMLOListElement) {
      // 列表容器左内边距（px）。
      const paddingLeftPx = Number.parseFloat(window.getComputedStyle(parentListElement).paddingLeft) || 0;
      if (paddingLeftPx > 0) {
        return paddingLeftPx;
      }
    }
    currentElement = currentElement.parentElement?.closest("li") || null;
  }
  return DEFAULT_LIST_LEVEL_INDENT_PX;
}

/** 计算列表项左侧缩进（pt）。 */
export function getListItemIndentPt(element: HTMLElement): number {
  if (!(element.parentElement instanceof HTMLUListElement || element.parentElement instanceof HTMLOListElement)) {
    return 0;
  }
  // 列表层级。
  const listLevel = getListItemLevel(element);
  // 列表层级缩进步长（px）。
  const stepPx = getListIndentStepPx(element);
  return Math.max(listLevel - 1, 0) * stepPx * CSS_PT_PER_PX;
}

/** 计算列表项嵌套层级。 */
function getListItemLevel(element: HTMLElement): number {
  // 当前遍历节点。
  let currentElement: HTMLElement | null = element;
  // 列表层级（根层级为 1）。
  let level = 0;
  while (currentElement) {
    if (currentElement.parentElement instanceof HTMLUListElement || currentElement.parentElement instanceof HTMLOListElement) {
      level += 1;
    }
    currentElement = currentElement.parentElement?.closest("li") || null;
  }
  return Math.max(level, 1);
}

/** 读取列表项文本，仅保留本级文本，排除子列表与任务复选框。 */
export function getListItemText(element: HTMLElement): string {
  // 克隆后的列表项节点。
  const clonedElement = element.cloneNode(true) as HTMLElement;
  clonedElement.querySelectorAll("ul,ol").forEach((nestedListElement) => {
    nestedListElement.remove();
  });
  clonedElement.querySelectorAll('input[type="checkbox"]').forEach((checkboxElement) => {
    checkboxElement.remove();
  });
  return (clonedElement.textContent || "").replace(/\s+/g, " ").trim();
}
