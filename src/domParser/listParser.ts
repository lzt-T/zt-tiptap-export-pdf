import { CSS_PT_PER_PX, LIST_ITEM_PREFIX } from "../exportConstants";
import { type ExportTaskListMarker } from "../exportTypes";

// 列表层级缩进兜底步长（px）。
const DEFAULT_LIST_LEVEL_INDENT_PX = 32;

/** 判断节点是否为列表容器。 */
function isListElement(element: Element | null): element is HTMLUListElement | HTMLOListElement {
  return element instanceof HTMLUListElement || element instanceof HTMLOListElement;
}

/** 判断节点是否为任务列表容器。 */
function isTaskListElement(element: Element | null): element is HTMLUListElement {
  return element instanceof HTMLUListElement && element.getAttribute("data-type") === "taskList";
}

/** 读取任务列表项首行复选框标签。 */
function getTaskListItemLabelElement(element: HTMLElement): HTMLElement | null {
  // 任务列表项复选框标签。
  const checkboxLabelElement = element.querySelector(":scope > label");
  return checkboxLabelElement instanceof HTMLElement ? checkboxLabelElement : null;
}

/** 判断列表项是否属于任务列表。 */
export function isTaskListItem(element: HTMLElement): boolean {
  // 最近的列表容器。
  const closestList = element.closest("ul,ol");
  return (
    element.dataset.type === "taskItem" ||
    isTaskListElement(closestList) ||
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

/** 读取任务列表项首行复选框占位宽度（px）。 */
function getTaskListMarkerSlotWidthPx(element: HTMLElement): number {
  // 任务列表项复选框标签。
  const checkboxLabelElement = getTaskListItemLabelElement(element);
  if (!checkboxLabelElement) {
    return 0;
  }
  // 任务列表项样式。
  const listItemComputedStyle = window.getComputedStyle(element);
  // 任务列表项横向间距（px）。
  const columnGapPx = Number.parseFloat(listItemComputedStyle.columnGap) || 0;
  // 任务列表项间距（px）。
  const gapPx = columnGapPx || Number.parseFloat(listItemComputedStyle.gap) || 0;
  // 复选框标签渲染宽度（px）。
  const labelWidthPx = checkboxLabelElement.getBoundingClientRect().width || checkboxLabelElement.offsetWidth || 0;
  return labelWidthPx + gapPx;
}

/** 读取元素渲染左坐标（px）。 */
function getElementRenderLeftPx(element: HTMLElement): number {
  // 元素布局矩形。
  const elementRect = element.getBoundingClientRect();
  return Number.isFinite(elementRect.left) ? elementRect.left : 0;
}

/** 读取任务列表层级根容器。 */
function getTaskListRootElement(element: HTMLElement): HTMLUListElement | null {
  // 当前任务列表容器。
  let currentListElement = element.parentElement;
  // 最外层任务列表容器。
  let rootListElement: HTMLUListElement | null = null;
  while (currentListElement) {
    if (isTaskListElement(currentListElement)) {
      rootListElement = currentListElement;
    }
    currentListElement = currentListElement.parentElement;
  }
  return rootListElement;
}

/** 读取任务列表根层级首个任务项。 */
function getFirstTaskListItemElement(listElement: HTMLUListElement): HTMLElement | null {
  // 首个任务列表项。
  const firstTaskItemElement = Array.from(listElement.children).find(
    (childElement): childElement is HTMLElement =>
      childElement instanceof HTMLElement && childElement.dataset.type === "taskItem",
  );
  return firstTaskItemElement || null;
}

/** 读取任务列表视觉缩进（px）。 */
function getTaskListVisualIndentPx(element: HTMLElement): number | null {
  // 当前任务项复选框标签。
  const currentLabelElement = getTaskListItemLabelElement(element);
  if (!currentLabelElement) {
    return null;
  }
  // 任务列表根容器。
  const rootListElement = getTaskListRootElement(element);
  if (!rootListElement) {
    return null;
  }
  // 根层级首个任务项。
  const firstTaskItemElement = getFirstTaskListItemElement(rootListElement);
  if (!firstTaskItemElement) {
    return null;
  }
  // 根层级复选框标签。
  const rootLabelElement = getTaskListItemLabelElement(firstTaskItemElement);
  if (!rootLabelElement) {
    return null;
  }
  // 当前复选框左坐标（px）。
  const currentLeftPx = getElementRenderLeftPx(currentLabelElement);
  // 根复选框左坐标（px）。
  const rootLeftPx = getElementRenderLeftPx(rootLabelElement);
  // 视觉缩进（px）。
  const indentPx = currentLeftPx - rootLeftPx;
  return indentPx > 0 ? indentPx : 0;
}

/** 读取任务列表层级缩进步长（px）。 */
function getTaskListIndentStepPx(element: HTMLElement): number {
  // 当前遍历的任务项。
  let currentElement: HTMLElement | null = element;
  while (currentElement) {
    // 任务列表项首行复选框占位宽度（px）。
    const markerSlotWidthPx = getTaskListMarkerSlotWidthPx(currentElement);
    if (markerSlotWidthPx > 0) {
      return markerSlotWidthPx;
    }
    currentElement = currentElement.parentElement?.closest('li[data-type="taskItem"]') || null;
  }
  return DEFAULT_LIST_LEVEL_INDENT_PX;
}

/** 计算任务列表项左侧缩进（pt）。 */
function getTaskListItemIndentPt(element: HTMLElement): number {
  // 列表层级。
  const listLevel = getListItemLevel(element);
  // 任务列表视觉缩进（px）。
  const visualIndentPx = getTaskListVisualIndentPx(element);
  if (visualIndentPx !== null && visualIndentPx > 0) {
    return visualIndentPx * CSS_PT_PER_PX;
  }
  if (listLevel <= 1) {
    return 0;
  }
  // 任务列表层级缩进步长（px）。
  const stepPx = getTaskListIndentStepPx(element);
  return Math.max(listLevel - 1, 0) * stepPx * CSS_PT_PER_PX;
}

/** 读取最近有效列表容器的缩进步长（px）。 */
function getListIndentStepPx(element: HTMLElement): number {
  // 当前遍历节点。
  let currentElement: HTMLElement | null = element;
  while (currentElement) {
    // 当前节点所属列表容器。
    const parentListElement = currentElement.parentElement;
    if (isListElement(parentListElement)) {
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
  if (isTaskListItem(element)) {
    return getTaskListItemIndentPt(element);
  }
  if (!isListElement(element.parentElement)) {
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
  // 当前遍历的祖先节点。
  let currentElement: HTMLElement | null = element.parentElement;
  // 列表层级（根层级为 1）。
  let level = 0;
  while (currentElement) {
    if (isListElement(currentElement)) {
      level += 1;
    }
    currentElement = currentElement.parentElement;
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
