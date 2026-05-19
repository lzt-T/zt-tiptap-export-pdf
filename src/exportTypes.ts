/** PDF 导出可选参数。 */
export interface ExportEditorToPdfOptions {
  /** 导出的文件名，默认 editor.pdf。 */
  filename?: string;
  /** 导出时使用的字体族，默认使用内置中文字体。 */
  fontFamily?: string;
}

/** 文本块导出样式。 */
export interface ExportTextBlockStyle {
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
export interface PdfWriteCursor {
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
