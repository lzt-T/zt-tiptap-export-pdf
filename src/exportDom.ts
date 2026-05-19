import { LIST_ITEM_PREFIX } from "./exportConstants";

/** 获取可视宽度（px），优先使用 getBoundingClientRect。 */
export function getElementRenderWidthPx(element: HTMLElement): number {
  // 节点布局宽度。
  const rectWidth = element.getBoundingClientRect().width;
  if (Number.isFinite(rectWidth) && rectWidth > 0) {
    return rectWidth;
  }
  return Math.max(element.clientWidth, element.scrollWidth, element.offsetWidth, 1);
}

/** 解析导出内容根节点：支持传入节点本身就是 ProseMirror。 */
export function resolveProseMirrorElement(rootElement: HTMLElement): HTMLElement | null {
  if (rootElement.classList.contains("ProseMirror")) {
    return rootElement;
  }
  // 嵌套的编辑器内容节点。
  const nestedProseMirrorElement = rootElement.querySelector(".ProseMirror");
  return nestedProseMirrorElement instanceof HTMLElement ? nestedProseMirrorElement : null;
}

/** 判断是否为支持的块级导出节点。 */
function isExportBlockElement(element: Element): element is HTMLElement {
  // 节点标签名。
  const tagName = element.tagName.toLowerCase();
  return ["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote", "pre"].includes(tagName);
}

/** 获取需要导出的块级节点列表。 */
export function getExportBlockElements(rootElement: HTMLElement): HTMLElement[] {
  // 第一层块级节点。
  const directBlockElements = Array.from(rootElement.children).filter(isExportBlockElement);
  if (directBlockElements.length > 0) {
    return directBlockElements;
  }
  // 兜底块级节点。
  const fallbackBlockElements = Array.from(rootElement.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote,pre"));
  return fallbackBlockElements.filter((element): element is HTMLElement => element instanceof HTMLElement);
}

/** 读取块级节点文本。 */
export function getBlockText(element: HTMLElement): string {
  // 归一化后的文本。
  const normalizedText = (element.textContent || "").replace(/\s+/g, " ").trim();
  if (!normalizedText) {
    return "";
  }
  if (element.tagName.toLowerCase() === "li") {
    return `${LIST_ITEM_PREFIX}${normalizedText}`;
  }
  return normalizedText;
}
