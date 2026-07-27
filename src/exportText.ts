import { type jsPDF as JsPdfInstance } from "jspdf";
import {
  CSS_PT_PER_PX,
  DEFAULT_BLOCK_MARGIN_BOTTOM_PT,
  DEFAULT_BLOCKQUOTE_INDENT_PT,
  DEFAULT_LINE_HEIGHT_FACTOR,
  EXPORT_HEADING_STYLE_MAP,
  PREFERRED_LINE_BREAK_CHARACTERS,
} from "./exportConstants";
import { type ExportRgbColor, type ExportTextBlockStyle } from "./exportTypes";

// 支持导出的文本水平对齐值。
const EXPORT_TEXT_ALIGN_VALUES = ["left", "center", "right", "justify"] as const;
// 支持读取普通缩进的块级标签。
const EXPORT_INDENT_TAG_NAMES = ["p", "li", "h1", "h2", "h3", "h4", "h5", "h6"] as const;
// 已解析的 CSS 颜色缓存。
const CSS_RGB_COLOR_CACHE = new Map<string, ExportRgbColor | undefined>();
// 用于将 CSS Color 4 颜色转换为 sRGB 的画布上下文。
let cssColorCanvasContext: CanvasRenderingContext2D | null | undefined;

/** 获取 CSS 颜色转换使用的单像素画布上下文。 */
function getCssColorCanvasContext(): CanvasRenderingContext2D | null {
  if (cssColorCanvasContext !== undefined) {
    return cssColorCanvasContext;
  }
  // 单像素颜色转换画布。
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  cssColorCanvasContext = canvas.getContext("2d", { willReadFrequently: true });
  return cssColorCanvasContext;
}

/** 使用浏览器颜色引擎将 CSS Color 4 颜色转换为白底 RGB。 */
function convertCssColorToRgb(value: string): ExportRgbColor | undefined {
  if (typeof document === "undefined" || typeof CSS === "undefined" || !CSS.supports("color", value)) {
    return undefined;
  }
  // 颜色转换画布上下文。
  const context = getCssColorCanvasContext();
  if (!context) {
    return undefined;
  }
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 1, 1);
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  // 白底合成后的像素颜色。
  const colorData = context.getImageData(0, 0, 1, 1).data;
  return [colorData[0], colorData[1], colorData[2]];
}

/** 解析文本水平对齐值，非法值回退为 left。 */
function resolveTextAlign(computedStyle: CSSStyleDeclaration): ExportTextBlockStyle["textAlign"] {
  // CSS 文本水平对齐值。
  const textAlign = computedStyle.textAlign;
  return EXPORT_TEXT_ALIGN_VALUES.includes(textAlign as ExportTextBlockStyle["textAlign"])
    ? (textAlign as ExportTextBlockStyle["textAlign"])
    : "left";
}

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

/** 将 CSS rgb/rgba 颜色转换为白底 PDF 使用的 RGB 颜色。 */
export function parseCssRgbColor(value: string): ExportRgbColor | undefined {
  // 归一化后的 CSS 颜色值。
  const normalizedValue = value.trim();
  if (CSS_RGB_COLOR_CACHE.has(normalizedValue)) {
    return CSS_RGB_COLOR_CACHE.get(normalizedValue);
  }
  // RGB 颜色匹配结果。
  const match = normalizedValue.match(/^rgba?\(([^)]+)\)$/i);
  if (!match) {
    // CSS Color 4 转换结果。
    const convertedColor = convertCssColorToRgb(normalizedValue);
    CSS_RGB_COLOR_CACHE.set(normalizedValue, convertedColor);
    return convertedColor;
  }
  // RGB 与透明度通道。
  const colorParts = match[1].split(/[\s,\/]+/).filter(Boolean);
  if (colorParts.slice(0, 3).some((part) => part.endsWith("%"))) {
    // 百分比颜色转换结果。
    const convertedColor = convertCssColorToRgb(normalizedValue);
    CSS_RGB_COLOR_CACHE.set(normalizedValue, convertedColor);
    return convertedColor;
  }
  // RGB 通道。
  const rgbColor = colorParts.slice(0, 3).map((part) => Number.parseFloat(part));
  if (rgbColor.length !== 3 || rgbColor.some((color) => !Number.isFinite(color))) {
    CSS_RGB_COLOR_CACHE.set(normalizedValue, undefined);
    return undefined;
  }
  // Alpha 通道。
  const alphaPart = colorParts[3];
  // Alpha 数值。
  const alpha = alphaPart?.endsWith("%") ? Number.parseFloat(alphaPart) / 100 : Number.parseFloat(alphaPart || "1");
  if (!Number.isFinite(alpha) || alpha <= 0) {
    CSS_RGB_COLOR_CACHE.set(normalizedValue, undefined);
    return undefined;
  }
  // 限制后的 Alpha 数值。
  const normalizedAlpha = Math.min(alpha, 1);
  // 白底合成后的 RGB 通道。
  const compositedColor = rgbColor.map((color) => Math.round(color * normalizedAlpha + 255 * (1 - normalizedAlpha)));
  // 最终 RGB 颜色。
  const resolvedColor: ExportRgbColor = [compositedColor[0], compositedColor[1], compositedColor[2]];
  CSS_RGB_COLOR_CACHE.set(normalizedValue, resolvedColor);
  return resolvedColor;
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

/** 解析文本块左侧缩进。 */
function resolveIndentLeftPt(tagName: string, computedStyle: CSSStyleDeclaration): number | undefined {
  if (tagName === "blockquote") {
    return pxToPt(parsePxValue(computedStyle.paddingLeft)) || DEFAULT_BLOCKQUOTE_INDENT_PT;
  }
  if (!EXPORT_INDENT_TAG_NAMES.includes(tagName as (typeof EXPORT_INDENT_TAG_NAMES)[number])) {
    return undefined;
  }
  // 普通块级节点左侧缩进（pt）。
  const marginLeftPt = pxToPt(parsePxValue(computedStyle.marginLeft));
  return marginLeftPt > 0 ? marginLeftPt : undefined;
}

/** 获取文本块导出样式。 */
export function getTextBlockStyle(element: HTMLElement, bodyFontSizePx: number): ExportTextBlockStyle {
  // 标签名。
  const tagName = element.tagName.toLowerCase();
  // 节点计算样式。
  const computedStyle = window.getComputedStyle(element);
  // 文本水平对齐。
  const textAlign = resolveTextAlign(computedStyle);
  // 块级文本颜色。
  const color = parseCssRgbColor(computedStyle.color);
  // 块级背景颜色。
  const backgroundColor = parseCssRgbColor(computedStyle.backgroundColor);
  // 块级左边框颜色。
  const borderLeftColor = parseCssRgbColor(computedStyle.borderLeftColor);
  // 原始字号（px）。
  const elementFontSizePx = parsePxValue(computedStyle.fontSize) || bodyFontSizePx;
  // 文本块左侧缩进（pt）。
  const indentLeftPt = resolveIndentLeftPt(tagName, computedStyle);
  // 块前间距原始值（px）。
  const marginTopPx = Number.parseFloat(computedStyle.marginTop);
  // 块前间距（pt），无法解析时不增加额外间距。
  const marginTopPt = Number.isFinite(marginTopPx) ? pxToPt(marginTopPx) : 0;
  if (isHeadingTagName(tagName)) {
    // 标题固定样式。
    const headingStyle = EXPORT_HEADING_STYLE_MAP[tagName];
    // 标题字号（pt）。
    const headingFontSizePt = pxToPt(bodyFontSizePx * headingStyle.fontSizeEm);
    return {
      fontSizePt: headingFontSizePt,
      lineHeightPt: headingFontSizePt * Number.parseFloat(headingStyle.lineHeight),
      marginTopPt,
      marginBottomPt: headingStyle.marginBottomPt,
      indentLeftPt,
      textAlign,
      fontStyle: "normal",
      color,
      backgroundColor,
      borderLeftColor,
    };
  }
  // 正文字号（pt）。
  const fontSizePt = pxToPt(elementFontSizePx);
  // 行高倍数。
  const lineHeightFactor = resolveLineHeightFactor(computedStyle, elementFontSizePx);
  // 块后间距原始值（px）。
  const marginBottomPx = Number.parseFloat(computedStyle.marginBottom);
  // 块后间距（pt），保留合法的 0 值。
  const marginBottomPt = Number.isFinite(marginBottomPx) ? pxToPt(marginBottomPx) : DEFAULT_BLOCK_MARGIN_BOTTOM_PT;
  // 代码块横向内边距（pt）。
  const paddingXPt = tagName === "pre" ? pxToPt(parsePxValue(computedStyle.paddingLeft)) : undefined;
  // 代码块纵向内边距（pt）。
  const paddingYPt = tagName === "pre" ? pxToPt(parsePxValue(computedStyle.paddingTop)) : undefined;
  return {
    fontSizePt,
    lineHeightPt: fontSizePt * lineHeightFactor,
    marginTopPt,
    marginBottomPt,
    indentLeftPt,
    paddingXPt,
    paddingYPt,
    textAlign,
    fontStyle: "normal",
    color,
    backgroundColor,
    borderLeftColor,
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
