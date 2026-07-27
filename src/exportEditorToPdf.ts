import { jsPDF } from "jspdf";
import {
  CSS_PX_PER_PT,
  DEFAULT_EXPORT_FONT_FAMILY,
  DEFAULT_PDF_FILENAME,
  OFFSCREEN_LEFT_PX,
  PDF_BOTTOM_MARGIN_PT,
  PDF_HORIZONTAL_MARGIN_PT,
  PDF_TEXT_WIDTH_SAFETY_PT,
  PDF_TOP_MARGIN_PT,
} from "./exportConstants";
import {
  getBlockExportContent,
  getElementRenderWidthPx,
  getExportBlockElements,
  getFormulaImageBlockContent,
  getInlineContentBlockContent,
  getImageBlockExportContent,
  getInlineFormulaBlockContent,
  hasInlineFormulaRenderElement,
  isBlockFormulaRenderElement,
  isImageExportElement,
  isInlineContentExportElement,
  resolveProseMirrorElement,
} from "./domParser";
import { writeTextBlock } from "./pdfWriter";
import { getTextBlockStyle, parsePxValue } from "./exportText";
import { type ExportEditorToPdfOptions, type PdfWriteCursor } from "./exportTypes";
import { ensureBuiltinChineseFontRegistered, waitForFontReady } from "./font";

// 允许空内容占位的文本块标签。
const EMPTY_TEXT_PLACEHOLDER_TAG_NAMES = new Set(["p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre"]);
// 浅色 PDF 使用的编辑器主题变量。
const LIGHT_EXPORT_THEME_VARIABLE_MAP: Record<string, string> = {
  "--background": "#ffffff",
  "--border": "#e5e7eb",
  "--code-block-fg": "#151515",
  "--foreground": "#171717",
  "--muted-foreground": "#737373",
  "--primary": "#171717",
  "--ui-bg-muted": "#f8fafc",
  "--ui-bg-selected": "#eef2ff",
  "--ui-bg-subtle": "#f1f5f9",
  "--ui-border-muted": "#e2e8f0",
  "--ui-border-strong": "#cbd5e1",
  "--ui-text-inverse": "#ffffff",
  "--ui-text-link": "#1d4ed8",
  "--ui-text-muted": "#64748b",
  "--ui-text-strong": "#111827",
};
// 不应进入 PDF 的编辑临时状态类名。
const TRANSIENT_EDITOR_STATE_CLASS_NAMES = ["ProseMirror-selectednode", "selectedCell", "zt-selection-mirror"];
// 不应进入 PDF 的编辑控件选择器。
const TRANSIENT_EDITOR_ELEMENT_SELECTOR = ".block-math-delete-btn-wrapper";

/** 将离屏样式上下文固定为浅色导出主题。 */
function applyLightExportTheme(element: HTMLElement): void {
  Object.entries(LIGHT_EXPORT_THEME_VARIABLE_MAP).forEach(([propertyName, propertyValue]) => {
    element.style.setProperty(propertyName, propertyValue);
  });
}

/** 清除克隆内容中的编辑临时状态和控件。 */
function removeTransientEditorState(element: HTMLElement): void {
  // 克隆根节点及其全部后代。
  const exportElements = [element, ...Array.from(element.querySelectorAll("*"))];
  exportElements.forEach((exportElement) => {
    TRANSIENT_EDITOR_STATE_CLASS_NAMES.forEach((className) => {
      exportElement.classList.remove(className);
    });
  });
  element.querySelectorAll(TRANSIENT_EDITOR_ELEMENT_SELECTOR).forEach((transientElement) => {
    transientElement.remove();
  });
}

/** 覆盖宿主 html.dark 仍会命中的代码样式选择器。 */
function applyLightExportContentStyles(element: HTMLElement): void {
  element.querySelectorAll("pre").forEach((preElement) => {
    if (preElement instanceof HTMLElement && !preElement.style.background && !preElement.style.backgroundColor) {
      preElement.style.background = "#f0f4fb";
    }
  });
  element.querySelectorAll(":not(pre) > code").forEach((codeElement) => {
    if (!(codeElement instanceof HTMLElement) || codeElement.style.background || codeElement.style.backgroundColor) {
      return;
    }
    codeElement.style.background = "#f1f5f9";
    codeElement.style.borderColor = "transparent";
  });
}

/** 判断空内容节点是否应保留一行占位高度。 */
function shouldKeepEmptyTextPlaceholder(
  element: HTMLElement,
  isBlockFormulaElement: boolean,
  isImageElement: boolean,
  hasInlineFormulaElement: boolean,
): boolean {
  if (isBlockFormulaElement || isImageElement || hasInlineFormulaElement) {
    return false;
  }
  // 块级标签名。
  const tagName = element.tagName.toLowerCase();
  return EMPTY_TEXT_PLACEHOLDER_TAG_NAMES.has(tagName);
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
  // 最终导出文件名。
  const resolvedFilename = options?.filename?.trim() || DEFAULT_PDF_FILENAME;
  // 最终导出字体族。
  const resolvedFontFamily = options?.fontFamily?.trim() || DEFAULT_EXPORT_FONT_FAMILY;

  await waitForFontReady(resolvedFontFamily);
  // PDF 实例，采用 A4 纵向。
  const pdf = new jsPDF({
    orientation: "p",
    unit: "pt",
    format: "a4",
  });
  ensureBuiltinChineseFontRegistered(pdf);

  // PDF 可用内容宽度。
  const pdfContentWidthPt = pdf.internal.pageSize.getWidth() - PDF_HORIZONTAL_MARGIN_PT * 2 - PDF_TEXT_WIDTH_SAFETY_PT;
  // PDF 页面高度。
  const pdfPageHeightPt = pdf.internal.pageSize.getHeight();
  // PDF 可用宽度换算后的 CSS 宽度。
  const renderWidthPx = Math.max(Math.floor(pdfContentWidthPt * CSS_PX_PER_PT), 1);
  // 渲染源宽度。
  const sourceRenderWidthPx = Math.max(getElementRenderWidthPx(element), renderWidthPx);

  // 离屏容器，用于复制节点后读取稳定计算样式。
  const offscreenContainer = document.createElement("div");
  offscreenContainer.style.position = "fixed";
  offscreenContainer.style.left = OFFSCREEN_LEFT_PX;
  offscreenContainer.style.top = "0";
  offscreenContainer.style.pointerEvents = "none";
  offscreenContainer.style.background = "#ffffff";
  offscreenContainer.style.width = `${sourceRenderWidthPx}px`;
  offscreenContainer.style.height = "auto";
  offscreenContainer.style.overflow = "visible";
  offscreenContainer.className = "zt-tiptap-theme";
  applyLightExportTheme(offscreenContainer);
  // 补齐编辑器样式祖先，确保 .editor-wrapper .ProseMirror 规则生效。
  const styleContextWrapper = document.createElement("div");
  styleContextWrapper.className = "editor-wrapper";
  styleContextWrapper.style.width = `${renderWidthPx}px`;
  styleContextWrapper.style.height = "auto";
  styleContextWrapper.style.maxHeight = "none";
  styleContextWrapper.style.overflow = "visible";

  // 克隆后的编辑区节点。
  const clonedElement = element.cloneNode(true) as HTMLElement;
  removeTransientEditorState(clonedElement);
  applyLightExportContentStyles(clonedElement);
  clonedElement.style.width = `${renderWidthPx}px`;
  clonedElement.style.color = "var(--ui-text-strong)";
  clonedElement.style.background = "#ffffff";
  clonedElement.style.height = "auto";
  clonedElement.style.maxHeight = "none";
  clonedElement.style.overflow = "visible";
  clonedElement.style.fontFamily = resolvedFontFamily;

  // 克隆后的 ProseMirror 根节点。
  const proseMirrorElement = resolveProseMirrorElement(clonedElement);
  if (proseMirrorElement instanceof HTMLElement) {
    proseMirrorElement.style.width = `${renderWidthPx}px`;
    proseMirrorElement.style.maxWidth = `${renderWidthPx}px`;
    proseMirrorElement.style.boxSizing = "border-box";
    proseMirrorElement.style.color = "var(--ui-text-strong)";
    proseMirrorElement.style.background = "#ffffff";
    proseMirrorElement.style.fontFamily = resolvedFontFamily;
    proseMirrorElement.style.whiteSpace = "normal";
    proseMirrorElement.style.overflowWrap = "break-word";
    proseMirrorElement.style.wordBreak = "break-all";
  }

  styleContextWrapper.appendChild(clonedElement);
  offscreenContainer.appendChild(styleContextWrapper);
  document.body.appendChild(offscreenContainer);

  try {
    // 实际导出的内容根节点。
    const exportRootElement = proseMirrorElement || clonedElement;
    // 编辑器正文计算样式。
    const rootComputedStyle = window.getComputedStyle(exportRootElement);
    // 正文基准字号（px）。
    const bodyFontSizePx = parsePxValue(rootComputedStyle.fontSize) || 16;
    // PDF 写入游标。
    const cursor: PdfWriteCursor = {
      yPt: PDF_TOP_MARGIN_PT,
      leftPt: PDF_HORIZONTAL_MARGIN_PT,
      contentWidthPt: pdfContentWidthPt,
      pageHeightPt: pdfPageHeightPt,
      bottomPt: pdfPageHeightPt - PDF_BOTTOM_MARGIN_PT,
    };
    // 需要导出的块级节点。
    const blockElements = getExportBlockElements(exportRootElement);
    // 上一个已写入块的块后间距，用于模拟 CSS 相邻外边距折叠。
    let previousBlockMarginBottomPt: number | undefined;

    for (const blockElement of blockElements) {
      // 是否为块级公式。
      const isBlockFormulaElement = isBlockFormulaRenderElement(blockElement);
      // 是否为图片块。
      const isImageElement = isImageExportElement(blockElement);
      // 是否包含行内公式。
      const hasInlineFormulaElement = hasInlineFormulaRenderElement(blockElement);
      // 是否为行内混合内容块。
      const isInlineContentElement = isInlineContentExportElement(blockElement);
      // 块级导出内容。
      const blockContent = isBlockFormulaElement
        ? await getFormulaImageBlockContent(blockElement)
        : isImageElement
          ? await getImageBlockExportContent(blockElement)
          : hasInlineFormulaElement
            ? await getInlineFormulaBlockContent(blockElement)
            : isInlineContentElement
              ? await getInlineContentBlockContent(blockElement)
              : await getBlockExportContent(blockElement, exportRootElement, bodyFontSizePx);
      if (
        !blockContent.text &&
        !shouldKeepEmptyTextPlaceholder(blockElement, isBlockFormulaElement, isImageElement, hasInlineFormulaElement)
      ) {
        continue;
      }
      // 块级文本样式。
      const blockStyle = getTextBlockStyle(blockElement, bodyFontSizePx);
      if (previousBlockMarginBottomPt !== undefined) {
        // 当前块尚未由上一块块后间距覆盖的块前间距。
        const additionalMarginTopPt = Math.max(
          blockStyle.marginTopPt - previousBlockMarginBottomPt,
          0,
        );
        cursor.yPt += additionalMarginTopPt;
      }
      writeTextBlock(pdf, cursor, {
        text: blockContent.text,
        style: blockStyle,
        fontFamily: resolvedFontFamily,
        tableContent: blockContent.tableContent,
        taskListMarker: blockContent.taskListMarker,
        taskListMarkerStyle: blockContent.taskListMarkerStyle,
        listMarker: blockContent.listMarker,
        listIndentPt: blockContent.listIndentPt,
        blockType: blockContent.blockType,
        imageContent: blockContent.imageContent,
        imageCaptionText: blockContent.imageCaptionText,
        inlineContent: blockContent.inlineContent,
      });
      previousBlockMarginBottomPt = blockStyle.marginBottomPt;
    }

    pdf.save(resolvedFilename);
  } finally {
    offscreenContainer.remove();
  }
}
