import { type jsPDF as JsPdfInstance } from "jspdf";
import { CSS_PT_PER_PX, PDF_TOP_MARGIN_PT } from "../exportConstants";
import { type PdfWriteCursor } from "../exportTypes";
import { type WriteTextBlockParams } from "./types";

/** 写入公式截图图片块。 */
export function writeImageTextBlock(
  pdf: JsPdfInstance,
  cursor: PdfWriteCursor,
  { imageContent, style }: WriteTextBlockParams,
): void {
  if (!imageContent) {
    return;
  }

  // 图片原始宽度（pt）。
  const naturalWidthPt = imageContent.widthPx * CSS_PT_PER_PX;
  // 图片原始高度（pt）。
  const naturalHeightPt = imageContent.heightPx * CSS_PT_PER_PX;
  // 页面可用高度（pt）。
  const maxPageImageHeightPt = cursor.bottomPt - PDF_TOP_MARGIN_PT;
  // 按内容宽度计算的缩放比例。
  const widthScale = Math.min(cursor.contentWidthPt / naturalWidthPt, 1);
  // 按单页高度计算的缩放比例。
  const heightScale = Math.min(maxPageImageHeightPt / naturalHeightPt, 1);
  // 最终缩放比例。
  const imageScale = Math.min(widthScale, heightScale);
  // 最终图片宽度（pt）。
  const imageWidthPt = naturalWidthPt * imageScale;
  // 最终图片高度（pt）。
  const imageHeightPt = naturalHeightPt * imageScale;

  if (cursor.yPt + imageHeightPt > cursor.bottomPt) {
    pdf.addPage();
    cursor.yPt = PDF_TOP_MARGIN_PT;
  }

  pdf.addImage(imageContent.dataUrl, "PNG", cursor.leftPt, cursor.yPt, imageWidthPt, imageHeightPt);
  cursor.yPt += imageHeightPt + style.marginBottomPt;
}
