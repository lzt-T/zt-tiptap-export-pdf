import { type jsPDF as JsPdfInstance } from "jspdf";
import {
  CSS_PT_PER_PX,
  DEFAULT_BLOCK_MARGIN_BOTTOM_PT,
  DEFAULT_BLOCKQUOTE_INDENT_PT,
  DEFAULT_LINE_HEIGHT_FACTOR,
  EXPORT_HEADING_STYLE_MAP,
  PREFERRED_LINE_BREAK_CHARACTERS,
} from "./exportConstants";
import { type ExportTextBlockStyle } from "./exportTypes";

/** 解析 CSS 字号值（如 16px）。 */
export function parsePxValue(value: string): number {
  // 解析后的数值。
  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

/** 将 CSS 像素转换为 PDF pt。 */
export function pxToPt(valuePx: number): number {
  return valuePx * CSS_PT_PER_PX;
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
export function getTextBlockStyle(element: HTMLElement, bodyFontSizePx: number): ExportTextBlockStyle {
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
  // 引用块左侧缩进（pt）。
  const indentLeftPt =
    tagName === "blockquote"
      ? pxToPt(parsePxValue(computedStyle.paddingLeft)) || DEFAULT_BLOCKQUOTE_INDENT_PT
      : undefined;
  // 代码块横向内边距（pt）。
  const paddingXPt = tagName === "pre" ? pxToPt(parsePxValue(computedStyle.paddingLeft)) : undefined;
  // 代码块纵向内边距（pt）。
  const paddingYPt = tagName === "pre" ? pxToPt(parsePxValue(computedStyle.paddingTop)) : undefined;
  return {
    fontSizePt,
    lineHeightPt: fontSizePt * lineHeightFactor,
    marginBottomPt,
    indentLeftPt,
    paddingXPt,
    paddingYPt,
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
export function splitTextToLines(pdf: JsPdfInstance, text: string, maxWidthPt: number): string[] {
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
