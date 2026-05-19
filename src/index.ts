import { jsPDF } from "jspdf";
import {
  BUILTIN_FONT_FAMILY,
  buildHtmlFontFaces,
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

/** 默认 PDF 文件名。 */
const DEFAULT_PDF_FILENAME = "editor.pdf";
/** 离屏渲染容器的 left 值，避免导出时闪现。 */
const OFFSCREEN_LEFT_PX = "-100000px";
/** PDF 边距（pt）。 */
const PDF_MARGIN_PT = 24;
/** 默认导出字体族。 */
const DEFAULT_EXPORT_FONT_FAMILY = BUILTIN_FONT_FAMILY;

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
  // 渲染源宽度，确保 html2canvas 可以获得稳定布局尺寸。
  const renderWidthPx = Math.max(element.scrollWidth, element.clientWidth, element.offsetWidth, 1);

  /** 离屏容器，用于复制节点后渲染，避免影响当前页面。 */
  const offscreenContainer = document.createElement("div");
  offscreenContainer.style.position = "fixed";
  offscreenContainer.style.left = OFFSCREEN_LEFT_PX;
  offscreenContainer.style.top = "0";
  offscreenContainer.style.pointerEvents = "none";
  offscreenContainer.style.background = "#ffffff";
  offscreenContainer.style.width = `${renderWidthPx}px`;
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
  // ProseMirror 文字颜色可能继承主题变量，导出时强制使用打印色。
  const proseMirrorElement = clonedElement.querySelector(".ProseMirror");
  if (proseMirrorElement instanceof HTMLElement) {
    proseMirrorElement.style.color = "#111111";
    proseMirrorElement.style.background = "#ffffff";
    proseMirrorElement.style.fontFamily = resolvedFontFamily;
  }
  offscreenContainer.appendChild(clonedElement);
  document.body.appendChild(offscreenContainer);

  try {
    await waitForFontReady(resolvedFontFamily);
    /** PDF 实例，采用 A4 纵向。 */
    const pdf = new jsPDF({
      orientation: "p",
      unit: "pt",
      format: "a4",
    });
    ensureBuiltinChineseFontRegistered(pdf);
    pdf.setFont(resolvedFontFamily);
    // PDF 可用内容宽度，避免 html 渲染结果超出页面边距。
    const pdfContentWidthPt = pdf.internal.pageSize.getWidth() - PDF_MARGIN_PT * 2;

    await new Promise<void>((resolve) => {
      pdf.html(clonedElement, {
        x: PDF_MARGIN_PT,
        y: PDF_MARGIN_PT,
        margin: [PDF_MARGIN_PT, PDF_MARGIN_PT, PDF_MARGIN_PT, PDF_MARGIN_PT],
        width: pdfContentWidthPt,
        windowWidth: renderWidthPx,
        autoPaging: "text",
        fontFaces: buildHtmlFontFaces(resolvedFontFamily),
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        },
        callback: (doc) => {
          doc.save(resolvedFilename);
          resolve();
        },
      });
    });
  } finally {
    offscreenContainer.remove();
  }
}
