import { type jsPDF as JsPdfInstance } from "jspdf";
import { CSS_PT_PER_PX, PDF_TOP_MARGIN_PT } from "../exportConstants";
import { splitTextToLines } from "../exportText";
import { type PdfWriteCursor } from "../exportTypes";
import { ensureLineSpace } from "./shared";
import { type WriteTextBlockParams } from "./types";

// 图片底部与说明文字顶部的可视间距（pt）。
const IMAGE_CAPTION_VISIBLE_TOP_GAP_PT = 8;
// 图片说明文本与后续内容的底部间距（pt）。
const IMAGE_CAPTION_BOTTOM_GAP_PT = 10;

/** 写入公式截图图片块。 */
export function writeImageTextBlock(
  pdf: JsPdfInstance,
  cursor: PdfWriteCursor,
  { imageContent, imageCaptionText, style, fontFamily }: WriteTextBlockParams,
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
  // 图片说明行。
  const captionLines = imageCaptionText ? splitTextToLines(pdf, imageCaptionText, imageWidthPt) : [];
  // 图片说明高度（pt）。
  const captionHeightPt = captionLines.length * style.lineHeightPt;
  // 图片说明首行基线间距（pt）。
  const captionBaselineGapPt = captionLines.length > 0 ? style.fontSizePt + IMAGE_CAPTION_VISIBLE_TOP_GAP_PT : 0;
  // 图片说明底部间距（pt）。
  const captionBottomGapPt = captionLines.length > 0 ? IMAGE_CAPTION_BOTTOM_GAP_PT : 0;
  // 图片块整体高度（pt）。
  const blockHeightPt = imageHeightPt + captionBaselineGapPt + captionHeightPt + captionBottomGapPt;

  if (cursor.yPt + blockHeightPt > cursor.bottomPt) {
    pdf.addPage();
    cursor.yPt = PDF_TOP_MARGIN_PT;
  }

  pdf.addImage(imageContent.dataUrl, "PNG", cursor.leftPt, cursor.yPt, imageWidthPt, imageHeightPt);
  cursor.yPt += imageHeightPt + captionBaselineGapPt;
  if (captionLines.length > 0) {
    pdf.setFont(fontFamily, style.fontStyle);
    pdf.setFontSize(style.fontSizePt);
  }
  captionLines.forEach((captionLine) => {
    ensureLineSpace(pdf, cursor, style.lineHeightPt);
    // 图片说明宽度（pt）。
    const captionLineWidthPt = pdf.getTextWidth(captionLine);
    // 图片说明 x 坐标。
    const captionLeftPt = cursor.leftPt + Math.max((imageWidthPt - captionLineWidthPt) / 2, 0);
    pdf.text(captionLine, captionLeftPt, cursor.yPt);
    cursor.yPt += style.lineHeightPt;
  });
  cursor.yPt += captionBottomGapPt + style.marginBottomPt;
}
