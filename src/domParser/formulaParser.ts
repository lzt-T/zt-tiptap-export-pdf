import { snapdom } from "@zumer/snapdom";
import { type ExportImageContent, type ExportInlineContentRun, type ExportTextBlockContent } from "../exportTypes";
import { getListItemIndentPt, getListItemPrefix, getTaskListMarker, isTaskListItem } from "./listParser";

// 行内公式渲染节点选择器。
const INLINE_FORMULA_RENDER_SELECTOR = '.tiptap-mathematics-render[data-type="inline-math"]';
// 块级公式渲染节点选择器。
const BLOCK_FORMULA_RENDER_SELECTOR = '.tiptap-mathematics-render[data-type="block-math"]';
// 公式截图设备像素比。
const FORMULA_CAPTURE_DPR = 2;
// 支持行内公式混合导出的标签。
const INLINE_FORMULA_BLOCK_TAG_NAMES = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "li"];

/** 判断节点是否为块级公式渲染节点。 */
export function isBlockFormulaRenderElement(element: HTMLElement): boolean {
  return element.matches(BLOCK_FORMULA_RENDER_SELECTOR);
}

/** 判断节点是否包含行内公式渲染节点。 */
export function hasInlineFormulaRenderElement(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase();
  return INLINE_FORMULA_BLOCK_TAG_NAMES.includes(tagName) && Boolean(element.querySelector(INLINE_FORMULA_RENDER_SELECTOR));
}

/** 将公式节点截图为图片内容。 */
async function getFormulaImageContent(element: HTMLElement): Promise<ExportImageContent | null> {
  // 节点布局尺寸。
  const elementRect = element.getBoundingClientRect();
  // 截图宽度（px）。
  const captureWidthPx = Math.max(Math.ceil(elementRect.width), element.scrollWidth, 1);
  // 截图高度（px）。
  const captureHeightPx = Math.max(Math.ceil(elementRect.height), element.scrollHeight, 1);
  // 公式块截图图片。
  const image = await snapdom.toPng(element, {
    backgroundColor: "#ffffff",
    dpr: FORMULA_CAPTURE_DPR,
    embedFonts: true,
    height: captureHeightPx,
    width: captureWidthPx,
  });

  if (!image.src) {
    return null;
  }

  return {
    dataUrl: image.src,
    widthPx: captureWidthPx,
    heightPx: captureHeightPx,
  };
}

/** 将块级公式截图为图片导出内容。 */
export async function getFormulaImageBlockContent(element: HTMLElement): Promise<ExportTextBlockContent> {
  // 公式图片内容。
  const imageContent = await getFormulaImageContent(element);
  if (!imageContent) {
    return { text: "" };
  }

  return {
    text: "[image]",
    blockType: "image",
    imageContent,
  };
}

/** 判断行内解析是否应跳过当前元素。 */
function shouldSkipInlineFormulaContent(element: HTMLElement, rootElement: HTMLElement): boolean {
  if (element === rootElement) {
    return false;
  }
  const tagName = element.tagName.toLowerCase();
  return tagName === "ul" || tagName === "ol" || (element instanceof HTMLInputElement && element.type === "checkbox");
}

/** 追加文本片段并合并相邻文本。 */
function appendTextRun(runs: ExportInlineContentRun[], text: string): void {
  // 归一化后的文本。
  const normalizedText = text.replace(/\s+/g, " ");
  if (!normalizedText) {
    return;
  }
  // 前一个行内片段。
  const previousRun = runs[runs.length - 1];
  if (previousRun?.type === "text") {
    previousRun.text += normalizedText;
    return;
  }
  runs.push({ type: "text", text: normalizedText });
}

/** 按 DOM 顺序读取行内文本与公式图片片段。 */
async function collectInlineContentRuns(node: Node, rootElement: HTMLElement, runs: ExportInlineContentRun[]): Promise<void> {
  if (node.nodeType === Node.TEXT_NODE) {
    appendTextRun(runs, node.textContent || "");
    return;
  }
  if (!(node instanceof HTMLElement) || shouldSkipInlineFormulaContent(node, rootElement)) {
    return;
  }
  if (node.matches(INLINE_FORMULA_RENDER_SELECTOR)) {
    // 行内公式图片内容。
    const imageContent = await getFormulaImageContent(node);
    if (imageContent) {
      runs.push({ type: "image", imageContent });
    }
    return;
  }
  // 子节点列表。
  const childNodes = Array.from(node.childNodes);
  for (const childNode of childNodes) {
    await collectInlineContentRuns(childNode, rootElement, runs);
  }
}

/** 读取含行内公式的块级导出内容。 */
export async function getInlineFormulaBlockContent(element: HTMLElement): Promise<ExportTextBlockContent> {
  // 行内内容片段。
  const inlineContent: ExportInlineContentRun[] = [];
  await collectInlineContentRuns(element, element, inlineContent);
  if (inlineContent.length === 0) {
    return { text: "" };
  }
  if (inlineContent[0]?.type === "text") {
    inlineContent[0].text = inlineContent[0].text.trimStart();
  }
  // 最后一个行内片段。
  const lastRun = inlineContent[inlineContent.length - 1];
  if (lastRun?.type === "text") {
    lastRun.text = lastRun.text.trimEnd();
  }
  if (inlineContent.every((run) => run.type === "text" && !run.text)) {
    return { text: "" };
  }
  if (element.tagName.toLowerCase() !== "li") {
    return {
      text: "[inlineContent]",
      blockType: "inlineContent",
      inlineContent,
    };
  }
  // 列表缩进（pt）。
  const listIndentPt = getListItemIndentPt(element);
  if (isTaskListItem(element)) {
    return {
      text: "[inlineContent]",
      blockType: "inlineContent",
      inlineContent,
      taskListMarker: getTaskListMarker(element),
      listIndentPt,
    };
  }
  return {
    text: "[inlineContent]",
    blockType: "inlineContent",
    inlineContent,
    listMarker: getListItemPrefix(element),
    listIndentPt,
  };
}
