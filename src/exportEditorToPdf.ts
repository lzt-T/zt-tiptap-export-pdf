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
  resolveProseMirrorElement,
} from "./exportDom";
import { writeTextBlock } from "./exportPdfWriter";
import { getTextBlockStyle, parsePxValue } from "./exportText";
import { type ExportEditorToPdfOptions, type PdfWriteCursor } from "./exportTypes";
import { ensureBuiltinChineseFontRegistered, waitForFontReady } from "./font";

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
  // 补齐编辑器样式祖先，确保 .editor-wrapper .ProseMirror 规则生效。
  const styleContextWrapper = document.createElement("div");
  styleContextWrapper.className = "editor-wrapper";
  styleContextWrapper.style.width = `${renderWidthPx}px`;
  styleContextWrapper.style.height = "auto";
  styleContextWrapper.style.maxHeight = "none";
  styleContextWrapper.style.overflow = "visible";

  // 克隆后的编辑区节点。
  const clonedElement = element.cloneNode(true) as HTMLElement;
  clonedElement.style.width = `${renderWidthPx}px`;
  clonedElement.style.color = "#111111";
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
    proseMirrorElement.style.color = "#111111";
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

    blockElements.forEach((blockElement) => {
      // 块级导出内容。
      const blockContent = getBlockExportContent(blockElement, exportRootElement);
      if (!blockContent.text) {
        return;
      }
      // 块级文本样式。
      const blockStyle = getTextBlockStyle(blockElement, bodyFontSizePx);
      writeTextBlock(pdf, cursor, {
        text: blockContent.text,
        style: blockStyle,
        fontFamily: resolvedFontFamily,
        taskListMarker: blockContent.taskListMarker,
        listMarker: blockContent.listMarker,
        listIndentPt: blockContent.listIndentPt,
        blockType: blockContent.blockType,
      });
    });

    pdf.save(resolvedFilename);
  } finally {
    offscreenContainer.remove();
  }
}
