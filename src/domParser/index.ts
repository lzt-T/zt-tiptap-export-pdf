import { getExportBlockElements } from "./blockCollector";
import { getBlockExportContent as parseBlockExportContent } from "./contentParser";

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

export { getExportBlockElements };

/** 读取块级节点导出内容。 */
export function getBlockExportContent(element: HTMLElement, exportRootElement: HTMLElement) {
  void exportRootElement;
  return parseBlockExportContent(element);
}
