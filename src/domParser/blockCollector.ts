import { isImageExportElement } from "./imageParser";

// 块级公式节点选择器。
const BLOCK_MATH_SELECTOR = '.tiptap-mathematics-render[data-type="block-math"]';
// 图片节点选择器。
const IMAGE_SELECTOR = ".image-node-wrapper,figure,img[src]";
// 支持导出的块级节点选择器。
const EXPORT_BLOCK_SELECTOR = `h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,table,${BLOCK_MATH_SELECTOR},${IMAGE_SELECTOR}`;

/** 判断是否为支持的块级导出节点。 */
function isExportBlockElement(element: Element): element is HTMLElement {
  // 节点标签名。
  const tagName = element.tagName.toLowerCase();
  return (
    ["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote", "pre", "table"].includes(tagName) ||
    element.matches(BLOCK_MATH_SELECTOR) ||
    (element instanceof HTMLElement && isImageExportElement(element))
  );
}

/** 判断节点是否位于列表项内部，避免 li 内段落重复导出。 */
function isNestedInListItem(element: HTMLElement): boolean {
  // 最近的列表项节点。
  const closestListItem = element.closest("li");
  return closestListItem instanceof HTMLElement && closestListItem !== element;
}

/** 判断节点是否位于表格内部，避免单元格内块级文本重复导出。 */
function isNestedInTable(element: HTMLElement): boolean {
  // 最近的表格节点。
  const closestTable = element.closest("table");
  return closestTable instanceof HTMLTableElement && closestTable !== element;
}

/** 判断图片节点是否已由外层图片块承载。 */
function isNestedInImageBlock(element: HTMLElement): boolean {
  // 最近的图片块节点。
  const closestImageBlock = element.closest(".image-node-wrapper,figure");
  return closestImageBlock instanceof HTMLElement && closestImageBlock !== element;
}

/** 判断节点是否位于引用块内部，避免引用内容重复导出。 */
function isNestedInBlockquote(element: HTMLElement): boolean {
  // 最近的引用块节点。
  const closestBlockquote = element.closest("blockquote");
  return closestBlockquote instanceof HTMLElement && closestBlockquote !== element;
}

/** 获取需要导出的块级节点列表。 */
export function getExportBlockElements(rootElement: HTMLElement): HTMLElement[] {
  // 根节点自身的块级节点。
  const rootBlockElements = isExportBlockElement(rootElement) ? [rootElement] : [];
  // 按 DOM 顺序获取所有块级节点。
  const blockElements = [...rootBlockElements, ...Array.from(rootElement.querySelectorAll(EXPORT_BLOCK_SELECTOR))];
  return blockElements.filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement &&
      isExportBlockElement(element) &&
      !isNestedInListItem(element) &&
      !isNestedInTable(element) &&
      !isNestedInImageBlock(element) &&
      !isNestedInBlockquote(element),
  );
}
