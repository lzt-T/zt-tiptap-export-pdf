import { snapdom } from "@zumer/snapdom";
import {
  type ExportImageContent,
  type ExportInlineContentRun,
  type ExportInlineTextStyle,
  type ExportTextBlockContent,
} from "../exportTypes";
import { getListItemIndentPt, getListItemPrefix, getTaskListMarker, isTaskListItem } from "./listParser";

// 行内公式渲染节点选择器。
const INLINE_FORMULA_RENDER_SELECTOR = '.tiptap-mathematics-render[data-type="inline-math"]';
// 块级公式渲染节点选择器。
const BLOCK_FORMULA_RENDER_SELECTOR = '.tiptap-mathematics-render[data-type="block-math"]';
// 公式截图设备像素比。
const FORMULA_CAPTURE_DPR = 2;
// 支持行内公式混合导出的标签。
const INLINE_FORMULA_BLOCK_TAG_NAMES = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "li"];
// 支持行内样式导出的标签。
const INLINE_CONTENT_BLOCK_TAG_NAMES = INLINE_FORMULA_BLOCK_TAG_NAMES;

/** 判断节点是否为块级公式渲染节点。 */
export function isBlockFormulaRenderElement(element: HTMLElement): boolean {
  return element.matches(BLOCK_FORMULA_RENDER_SELECTOR);
}

/** 判断节点是否包含行内公式渲染节点。 */
export function hasInlineFormulaRenderElement(element: HTMLElement): boolean {
  // 标签名。
  const tagName = element.tagName.toLowerCase();
  return INLINE_FORMULA_BLOCK_TAG_NAMES.includes(tagName) && Boolean(element.querySelector(INLINE_FORMULA_RENDER_SELECTOR));
}

/** 判断节点是否支持行内内容导出。 */
export function isInlineContentExportElement(element: HTMLElement): boolean {
  return INLINE_CONTENT_BLOCK_TAG_NAMES.includes(element.tagName.toLowerCase());
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
  // 标签名。
  const tagName = element.tagName.toLowerCase();
  return tagName === "ul" || tagName === "ol" || (element instanceof HTMLInputElement && element.type === "checkbox");
}

/** 判断两个行内文本样式是否一致。 */
function isSameInlineTextStyle(leftStyle?: ExportInlineTextStyle, rightStyle?: ExportInlineTextStyle): boolean {
  return (
    Boolean(leftStyle?.bold) === Boolean(rightStyle?.bold) &&
    Boolean(leftStyle?.italic) === Boolean(rightStyle?.italic) &&
    Boolean(leftStyle?.underline) === Boolean(rightStyle?.underline) &&
    Boolean(leftStyle?.strike) === Boolean(rightStyle?.strike) &&
    Boolean(leftStyle?.code) === Boolean(rightStyle?.code) &&
    (leftStyle?.linkHref || "") === (rightStyle?.linkHref || "")
  );
}

/** 判断 CSS 字重是否应视为加粗。 */
function isBoldFontWeight(fontWeight: string): boolean {
  // 数字字重。
  const numericFontWeight = Number.parseInt(fontWeight, 10);
  if (Number.isFinite(numericFontWeight)) {
    return numericFontWeight >= 600;
  }
  return fontWeight === "bold" || fontWeight === "bolder";
}

/** 判断标签名是否表示加粗。 */
function isBoldTagName(tagName: string): boolean {
  return tagName === "strong" || tagName === "b";
}

/** 判断标签名是否表示斜体。 */
function isItalicTagName(tagName: string): boolean {
  return tagName === "em" || tagName === "i";
}

/** 判断标签名是否表示下划线。 */
function isUnderlineTagName(tagName: string): boolean {
  return tagName === "u";
}

/** 判断标签名是否表示删除线。 */
function isStrikeTagName(tagName: string): boolean {
  return tagName === "s" || tagName === "del" || tagName === "strike";
}

/** 读取链接元素地址。 */
function getLinkElementHref(element: HTMLElement): string | undefined {
  if (!(element instanceof HTMLAnchorElement)) {
    return undefined;
  }
  return element.href || element.getAttribute("href") || undefined;
}

/** 合并元素自身语义样式。 */
function mergeElementSemanticInlineStyle(inlineStyle: ExportInlineTextStyle, element: HTMLElement): void {
  // 标签名。
  const tagName = element.tagName.toLowerCase();
  inlineStyle.bold = inlineStyle.bold || isBoldTagName(tagName);
  inlineStyle.italic = inlineStyle.italic || isItalicTagName(tagName);
  inlineStyle.underline = inlineStyle.underline || isUnderlineTagName(tagName);
  inlineStyle.strike = inlineStyle.strike || isStrikeTagName(tagName);
  inlineStyle.code = inlineStyle.code || tagName === "code";
  inlineStyle.linkHref = inlineStyle.linkHref || getLinkElementHref(element);
}

/** 合并元素计算样式。 */
function mergeElementComputedInlineStyle(inlineStyle: ExportInlineTextStyle, element: HTMLElement): void {
  // 节点计算样式。
  const computedStyle = window.getComputedStyle(element);
  // 文本装饰线。
  const textDecorationLine = computedStyle.textDecorationLine || computedStyle.textDecoration;
  inlineStyle.bold = inlineStyle.bold || isBoldFontWeight(computedStyle.fontWeight);
  inlineStyle.italic =
    inlineStyle.italic || computedStyle.fontStyle === "italic" || computedStyle.fontStyle === "oblique";
  inlineStyle.underline = inlineStyle.underline || textDecorationLine.includes("underline");
  inlineStyle.strike = inlineStyle.strike || textDecorationLine.includes("line-through");
}

/** 判断行内样式是否有有效内容。 */
function hasInlineTextStyleValue(inlineStyle: ExportInlineTextStyle): boolean {
  return Object.values(inlineStyle).some(Boolean);
}

/** 读取文本节点祖先链行内样式。 */
function getInlineTextStyle(element: HTMLElement, rootElement: HTMLElement): ExportInlineTextStyle | undefined {
  // 行内文本样式。
  const inlineStyle: ExportInlineTextStyle = {};
  // 当前向上合并的元素。
  let currentElement: HTMLElement | null = element;

  while (currentElement) {
    mergeElementSemanticInlineStyle(inlineStyle, currentElement);
    mergeElementComputedInlineStyle(inlineStyle, currentElement);
    if (currentElement === rootElement) {
      break;
    }
    currentElement = currentElement.parentElement;
  }

  if (inlineStyle.linkHref) {
    inlineStyle.underline = true;
  }
  return hasInlineTextStyleValue(inlineStyle) ? inlineStyle : undefined;
}

/** 追加文本片段并合并相邻文本。 */
function appendTextRun(runs: ExportInlineContentRun[], text: string, style?: ExportInlineTextStyle): void {
  // 归一化后的文本。
  const normalizedText = text.replace(/\s+/g, " ");
  if (!normalizedText) {
    return;
  }
  // 前一个行内片段。
  const previousRun = runs[runs.length - 1];
  if (previousRun?.type === "text" && isSameInlineTextStyle(previousRun.style, style)) {
    previousRun.text += normalizedText;
    return;
  }
  runs.push({ type: "text", text: normalizedText, style });
}

/** 按 DOM 顺序读取行内文本与公式图片片段。 */
async function collectInlineContentRuns(node: Node, rootElement: HTMLElement, runs: ExportInlineContentRun[]): Promise<void> {
  if (node.nodeType === Node.TEXT_NODE) {
    // 文本父元素。
    const parentElement = node.parentElement;
    appendTextRun(runs, node.textContent || "", parentElement ? getInlineTextStyle(parentElement, rootElement) : undefined);
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
export async function getInlineContentBlockContent(element: HTMLElement): Promise<ExportTextBlockContent> {
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

/** 读取含行内公式的块级导出内容。 */
export async function getInlineFormulaBlockContent(element: HTMLElement): Promise<ExportTextBlockContent> {
  return getInlineContentBlockContent(element);
}
