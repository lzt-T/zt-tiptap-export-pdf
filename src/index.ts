import { jsPDF, type jsPDF as JsPdfInstance } from "jspdf";
import {
  BUILTIN_FONT_FAMILY,
  ensureBuiltinChineseFontRegistered,
  waitForFontReady,
} from "./font";

/** PDF 导出可选参数。 */
export interface ExportEditorToPdfOptions {
  /** 导出的文件名，默认 editor.pdf。 */
  filename?: string;
  /** 导出时使用的字体族，默认使用内置中文字体。 */
  fontFamily?: string;
}

/** 文本块导出样式。 */
interface ExportTextBlockStyle {
  /** 字号（pt）。 */
  fontSizePt: number;
  /** 行高（pt）。 */
  lineHeightPt: number;
  /** 块后间距（pt）。 */
  marginBottomPt: number;
  /** PDF 字体样式。 */
  fontStyle: "normal";
}

/** PDF 写入游标。 */
interface PdfWriteCursor {
  /** 当前写入 y 坐标（pt）。 */
  yPt: number;
  /** 左侧写入 x 坐标（pt）。 */
  leftPt: number;
  /** 正文最大宽度（pt）。 */
  contentWidthPt: number;
  /** 页面高度（pt）。 */
  pageHeightPt: number;
  /** 页面底部边界（pt）。 */
  bottomPt: number;
}

/** 默认 PDF 文件名。 */
const DEFAULT_PDF_FILENAME = "editor.pdf";
/** 离屏渲染容器的 left 值，避免导出时闪现。 */
const OFFSCREEN_LEFT_PX = "-100000px";
/** PDF 顶部边距（pt）。 */
const PDF_TOP_MARGIN_PT = 48;
/** PDF 横向边距（pt）。 */
const PDF_HORIZONTAL_MARGIN_PT = 24;
/** PDF 底部边距（pt）。 */
const PDF_BOTTOM_MARGIN_PT = 24;
/** PDF 文本宽度安全余量（pt），避免边界测量误差导致裁剪。 */
const PDF_TEXT_WIDTH_SAFETY_PT = 2;
/** 浏览器 CSS 像素与 pt 的换算比例（72pt / 96px）。 */
const CSS_PT_PER_PX = 72 / 96;
/** 浏览器 CSS pt 与像素的换算比例（96px / 72pt）。 */
const CSS_PX_PER_PT = 96 / 72;
/** 默认导出字体族。 */
const DEFAULT_EXPORT_FONT_FAMILY = BUILTIN_FONT_FAMILY;
/** 默认正文行高倍数。 */
const DEFAULT_LINE_HEIGHT_FACTOR = 1.5;
/** 默认块后间距（pt）。 */
const DEFAULT_BLOCK_MARGIN_BOTTOM_PT = 8;
/** 列表项前缀。 */
const LIST_ITEM_PREFIX = "• ";
/** 优先作为行尾断点的字符。 */
const PREFERRED_LINE_BREAK_CHARACTERS = " ,.;:!?，。、《》；：！？）】」』)]}";
/** 固定导出标题样式（对齐 zt-reactjs-tiptap prose.css）。 */
const EXPORT_HEADING_STYLE_MAP = {
  h1: { fontSizeEm: 2, fontWeight: "700", lineHeight: "1.3", marginBottomPt: 10 },
  h2: { fontSizeEm: 1.5, fontWeight: "700", lineHeight: "1.4", marginBottomPt: 9 },
  h3: { fontSizeEm: 1.25, fontWeight: "700", lineHeight: "1.5", marginBottomPt: 8 },
  h4: { fontSizeEm: 1.125, fontWeight: "600", lineHeight: "1.5", marginBottomPt: 7 },
  h5: { fontSizeEm: 1, fontWeight: "600", lineHeight: "1.55", marginBottomPt: 6 },
  h6: { fontSizeEm: 1, fontWeight: "500", lineHeight: "1.6", marginBottomPt: 6 },
} as const;

/** 解析 CSS 字号值（如 16px）。 */
function parsePxValue(value: string): number {
  // 解析后的数值。
  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

/** 将 CSS 像素转换为 PDF pt。 */
function pxToPt(valuePx: number): number {
  return valuePx * CSS_PT_PER_PX;
}

/** 获取可视宽度（px），优先使用 getBoundingClientRect。 */
function getElementRenderWidthPx(element: HTMLElement): number {
  // 节点布局宽度。
  const rectWidth = element.getBoundingClientRect().width;
  if (Number.isFinite(rectWidth) && rectWidth > 0) {
    return rectWidth;
  }
  return Math.max(element.clientWidth, element.scrollWidth, element.offsetWidth, 1);
}

/** 解析导出内容根节点：支持传入节点本身就是 ProseMirror。 */
function resolveProseMirrorElement(rootElement: HTMLElement): HTMLElement | null {
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
function getExportBlockElements(rootElement: HTMLElement): HTMLElement[] {
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
function getBlockText(element: HTMLElement): string {
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

/** 解析 CSS 行高倍数。 */
function resolveLineHeightFactor(computedStyle: CSSStyleDeclaration, fontSizePx: number): number {
  // 行高原始值。
  const lineHeight = computedStyle.lineHeight;
  if (!lineHeight || lineHeight === "normal") {
    return DEFAULT_LINE_HEIGHT_FACTOR;
  }
  if (lineHeight.endsWith("px")) {
    // 行高像素值。
    const lineHeightPx = parsePxValue(lineHeight);
    return lineHeightPx > 0 && fontSizePx > 0 ? lineHeightPx / fontSizePx : DEFAULT_LINE_HEIGHT_FACTOR;
  }
  // 行高倍数值。
  const lineHeightFactor = Number.parseFloat(lineHeight);
  return Number.isFinite(lineHeightFactor) && lineHeightFactor > 0 ? lineHeightFactor : DEFAULT_LINE_HEIGHT_FACTOR;
}

/** 判断节点是否应使用标题样式。 */
function isHeadingTagName(tagName: string): tagName is keyof typeof EXPORT_HEADING_STYLE_MAP {
  return tagName in EXPORT_HEADING_STYLE_MAP;
}

/** 获取文本块导出样式。 */
function getTextBlockStyle(element: HTMLElement, bodyFontSizePx: number): ExportTextBlockStyle {
  // 标签名。
  const tagName = element.tagName.toLowerCase();
  // 节点计算样式。
  const computedStyle = window.getComputedStyle(element);
  // 原始字号（px）。
  const elementFontSizePx = parsePxValue(computedStyle.fontSize) || bodyFontSizePx;
  if (isHeadingTagName(tagName)) {
    // 标题固定样式。
    const headingStyle = EXPORT_HEADING_STYLE_MAP[tagName];
    // 标题字号（pt）。
    const headingFontSizePt = pxToPt(bodyFontSizePx * headingStyle.fontSizeEm);
    return {
      fontSizePt: headingFontSizePt,
      lineHeightPt: headingFontSizePt * Number.parseFloat(headingStyle.lineHeight),
      marginBottomPt: headingStyle.marginBottomPt,
      fontStyle: "normal",
    };
  }
  // 正文字号（pt）。
  const fontSizePt = pxToPt(elementFontSizePx);
  // 行高倍数。
  const lineHeightFactor = resolveLineHeightFactor(computedStyle, elementFontSizePx);
  // 块后间距（pt）。
  const marginBottomPt = pxToPt(parsePxValue(computedStyle.marginBottom)) || DEFAULT_BLOCK_MARGIN_BOTTOM_PT;
  return {
    fontSizePt,
    lineHeightPt: fontSizePt * lineHeightFactor,
    marginBottomPt,
    fontStyle: "normal",
  };
}

/** 判断字符是否适合作为行尾断点。 */
function isPreferredLineBreakCharacter(character: string): boolean {
  return PREFERRED_LINE_BREAK_CHARACTERS.includes(character);
}

/** 查找当前行中最后一个优先断点。 */
function findLastPreferredLineBreakIndex(characters: string[]): number {
  for (let index = characters.length - 1; index >= 0; index -= 1) {
    if (isPreferredLineBreakCharacter(characters[index])) {
      return index + 1;
    }
  }
  return -1;
}

/** 将文本拆为 PDF 可写入行。 */
function splitTextToLines(pdf: JsPdfInstance, text: string, maxWidthPt: number): string[] {
  // 待处理字符队列。
  let remainingCharacters = Array.from(text);
  // PDF 可写入文本行。
  const textLines: string[] = [];

  while (remainingCharacters.length > 0) {
    // 当前行字符。
    let lineCharacters: string[] = [];

    while (remainingCharacters.length > 0) {
      // 下一个待测量字符。
      const nextCharacter = remainingCharacters[0];
      // 加入下一个字符后的候选行。
      const candidateLine = `${lineCharacters.join("")}${nextCharacter}`;

      if (lineCharacters.length === 0 || pdf.getTextWidth(candidateLine) <= maxWidthPt) {
        lineCharacters = [...lineCharacters, nextCharacter];
        remainingCharacters = remainingCharacters.slice(1);
        continue;
      }

      // 当前行最后一个优先断点。
      const preferredBreakIndex = findLastPreferredLineBreakIndex(lineCharacters);
      if (preferredBreakIndex > 0) {
        // 断点后的剩余字符。
        const overflowCharacters = lineCharacters.slice(preferredBreakIndex);
        remainingCharacters = [...overflowCharacters, ...remainingCharacters];
        lineCharacters = lineCharacters.slice(0, preferredBreakIndex);
      }
      break;
    }

    // 当前行文本。
    const lineText = lineCharacters.join("").trimEnd();
    if (lineText) {
      textLines.push(lineText);
    }
  }

  return textLines;
}

/** 确保当前页有足够空间写入下一行。 */
function ensureLineSpace(pdf: JsPdfInstance, cursor: PdfWriteCursor, lineHeightPt: number): void {
  if (cursor.yPt + lineHeightPt <= cursor.bottomPt) {
    return;
  }
  pdf.addPage();
  cursor.yPt = PDF_TOP_MARGIN_PT;
}

/** 写入一个文本块。 */
function writeTextBlock(
  pdf: JsPdfInstance,
  cursor: PdfWriteCursor,
  text: string,
  style: ExportTextBlockStyle,
  fontFamily: string,
): void {
  pdf.setFont(fontFamily, style.fontStyle);
  pdf.setFontSize(style.fontSizePt);
  // 可写入文本行。
  const textLines = splitTextToLines(pdf, text, cursor.contentWidthPt);
  textLines.forEach((textLine) => {
    ensureLineSpace(pdf, cursor, style.lineHeightPt);
    pdf.text(textLine, cursor.leftPt, cursor.yPt);
    cursor.yPt += style.lineHeightPt;
  });
  cursor.yPt += style.marginBottomPt;
}

/**
 * 将编辑器内容节点导出为 PDF。
 * 说明：
 * - 仅支持浏览器环境。
 * - 输入节点应是“编辑区内容容器”，不包含工具栏与弹层。
 */
export async function exportEditorToPdf(
  element: HTMLElement,
  options?: ExportEditorToPdfOptions,
): Promise<void> {
  /** 最终导出文件名。 */
  const resolvedFilename = options?.filename?.trim() || DEFAULT_PDF_FILENAME;
  /** 最终导出字体族。 */
  const resolvedFontFamily = options?.fontFamily?.trim() || DEFAULT_EXPORT_FONT_FAMILY;

  await waitForFontReady(resolvedFontFamily);
  /** PDF 实例，采用 A4 纵向。 */
  const pdf = new jsPDF({
    orientation: "p",
    unit: "pt",
    format: "a4",
  });
  ensureBuiltinChineseFontRegistered(pdf);

  /** PDF 可用内容宽度。 */
  const pdfContentWidthPt = pdf.internal.pageSize.getWidth() - PDF_HORIZONTAL_MARGIN_PT * 2 - PDF_TEXT_WIDTH_SAFETY_PT;
  /** PDF 页面高度。 */
  const pdfPageHeightPt = pdf.internal.pageSize.getHeight();
  /** PDF 可用宽度换算后的 CSS 宽度。 */
  const renderWidthPx = Math.max(Math.floor(pdfContentWidthPt * CSS_PX_PER_PT), 1);
  /** 渲染源宽度。 */
  const sourceRenderWidthPx = Math.max(getElementRenderWidthPx(element), renderWidthPx);

  /** 离屏容器，用于复制节点后读取稳定计算样式。 */
  const offscreenContainer = document.createElement("div");
  offscreenContainer.style.position = "fixed";
  offscreenContainer.style.left = OFFSCREEN_LEFT_PX;
  offscreenContainer.style.top = "0";
  offscreenContainer.style.pointerEvents = "none";
  offscreenContainer.style.background = "#ffffff";
  offscreenContainer.style.width = `${sourceRenderWidthPx}px`;
  offscreenContainer.style.height = "auto";
  offscreenContainer.style.overflow = "visible";

  /** 克隆后的编辑区节点。 */
  const clonedElement = element.cloneNode(true) as HTMLElement;
  clonedElement.style.width = `${renderWidthPx}px`;
  clonedElement.style.color = "#111111";
  clonedElement.style.background = "#ffffff";
  clonedElement.style.height = "auto";
  clonedElement.style.maxHeight = "none";
  clonedElement.style.overflow = "visible";
  clonedElement.style.fontFamily = resolvedFontFamily;

  /** 克隆后的 ProseMirror 根节点。 */
  const proseMirrorElement = resolveProseMirrorElement(clonedElement);
  if (proseMirrorElement instanceof HTMLElement) {
    proseMirrorElement.style.width = `${renderWidthPx}px`;
    proseMirrorElement.style.maxWidth = `${renderWidthPx}px`;
    proseMirrorElement.style.boxSizing = "border-box";
    proseMirrorElement.style.color = "#111111";
    proseMirrorElement.style.background = "#ffffff";
    proseMirrorElement.style.fontFamily = resolvedFontFamily;
    proseMirrorElement.style.whiteSpace = "normal";
    proseMirrorElement.style.overflowWrap = "break-word";
    proseMirrorElement.style.wordBreak = "break-all";
  }

  offscreenContainer.appendChild(clonedElement);
  document.body.appendChild(offscreenContainer);

  try {
    /** 实际导出的内容根节点。 */
    const exportRootElement = proseMirrorElement || clonedElement;
    /** 编辑器正文计算样式。 */
    const rootComputedStyle = window.getComputedStyle(exportRootElement);
    /** 正文基准字号（px）。 */
    const bodyFontSizePx = parsePxValue(rootComputedStyle.fontSize) || 16;
    /** PDF 写入游标。 */
    const cursor: PdfWriteCursor = {
      yPt: PDF_TOP_MARGIN_PT,
      leftPt: PDF_HORIZONTAL_MARGIN_PT,
      contentWidthPt: pdfContentWidthPt,
      pageHeightPt: pdfPageHeightPt,
      bottomPt: pdfPageHeightPt - PDF_BOTTOM_MARGIN_PT,
    };
    /** 需要导出的块级节点。 */
    const blockElements = getExportBlockElements(exportRootElement);

    blockElements.forEach((blockElement) => {
      // 块级文本内容。
      const blockText = getBlockText(blockElement);
      if (!blockText) {
        return;
      }
      // 块级文本样式。
      const blockStyle = getTextBlockStyle(blockElement, bodyFontSizePx);
      writeTextBlock(pdf, cursor, blockText, blockStyle, resolvedFontFamily);
    });

    pdf.save(resolvedFilename);
  } finally {
    offscreenContainer.remove();
  }
}
