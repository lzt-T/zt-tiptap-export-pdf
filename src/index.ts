import { jsPDF } from "jspdf";

/** PDF 导出可选参数。 */
export interface ExportEditorToPdfOptions {
  /** 导出的文件名，默认 editor.pdf。 */
  filename?: string;
}

/** 默认 PDF 文件名。 */
const DEFAULT_PDF_FILENAME = "editor.pdf";
/** 离屏渲染容器的 left 值，避免闪烁。 */
const OFFSCREEN_LEFT_PX = "-100000px";
/** PDF 边距（pt）。 */
const PDF_MARGIN_PT = 24;

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

  /** 离屏容器，用于复制节点后渲染，避免影响当前页面。 */
  const offscreenContainer = document.createElement("div");
  offscreenContainer.style.position = "fixed";
  offscreenContainer.style.left = OFFSCREEN_LEFT_PX;
  offscreenContainer.style.top = "0";
  offscreenContainer.style.background = "#ffffff";
  offscreenContainer.style.zIndex = "-1";
  offscreenContainer.style.width = `${Math.max(element.scrollWidth, element.clientWidth)}px`;

  /** 克隆后的编辑区节点。 */
  const clonedElement = element.cloneNode(true) as HTMLElement;
  offscreenContainer.appendChild(clonedElement);
  document.body.appendChild(offscreenContainer);

  try {
    /** PDF 实例，采用 A4 纵向。 */
    const pdf = new jsPDF({
      orientation: "p",
      unit: "pt",
      format: "a4",
    });

    await new Promise<void>((resolve) => {
      pdf.html(clonedElement, {
        x: PDF_MARGIN_PT,
        y: PDF_MARGIN_PT,
        margin: [PDF_MARGIN_PT, PDF_MARGIN_PT, PDF_MARGIN_PT, PDF_MARGIN_PT],
        autoPaging: "text",
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
