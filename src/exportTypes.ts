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
  /** 左侧缩进（pt）。 */
  indentLeftPt?: number;
  /** 横向内边距（pt）。 */
  paddingXPt?: number;
  /** 纵向内边距（pt）。 */
  paddingYPt?: number;
  /** 文本水平对齐。 */
  textAlign: "left" | "center" | "right" | "justify";
  /** PDF 字体样式。 */
  fontStyle: "normal";
  /** 块级文本颜色。 */
  color?: ExportRgbColor;
  /** 块级背景颜色。 */
  backgroundColor?: ExportRgbColor;
  /** 块级左边框颜色。 */
  borderLeftColor?: ExportRgbColor;
}

/** 任务列表标记状态。 */
export type ExportTaskListMarker = "unchecked" | "checked";

/** 任务列表标记颜色样式。 */
export interface ExportTaskListMarkerStyle {
  /** 方框边框颜色。 */
  borderColor?: ExportRgbColor;
  /** 方框背景颜色。 */
  backgroundColor?: ExportRgbColor;
  /** 勾选符号颜色。 */
  checkColor?: ExportRgbColor;
}

/** 导出文本块类型。 */
export type ExportTextBlockType = "blockquote" | "table" | "code" | "image" | "inlineContent";

/** 导出 RGB 颜色。 */
export type ExportRgbColor = [number, number, number];

/** 表格单元格内的块级内容。 */
export interface ExportTableCellBlock {
  /** 块级内容。 */
  content: ExportTextBlockContent;
  /** 块级样式。 */
  style: ExportTextBlockStyle;
}

/** 表格单元格。 */
export interface ExportTableCell {
  /** 单元格文本。 */
  text: string;
  /** 单元格内块级内容。 */
  blocks: ExportTableCellBlock[];
  /** 横向合并列数。 */
  colSpan: number;
  /** 纵向合并行数。 */
  rowSpan: number;
  /** 水平对齐。 */
  textAlign: "left" | "center" | "right";
  /** 垂直对齐。 */
  verticalAlign: "top" | "middle" | "bottom";
  /** 单元格背景颜色。 */
  backgroundColor?: ExportRgbColor;
  /** 单元格边框颜色。 */
  borderColor?: ExportRgbColor;
}

/** 表格行。 */
export interface ExportTableRow {
  /** 当前行单元格列表。 */
  cells: ExportTableCell[];
  /** 是否为表头行。 */
  isHeaderRow: boolean;
}

/** 表格内容。 */
export interface ExportTableContent {
  /** 表格行列表。 */
  rows: ExportTableRow[];
}

/** 导出图片内容。 */
export interface ExportImageContent {
  /** 图片 data URL。 */
  dataUrl: string;
  /** 图片对应的 CSS 宽度（px）。 */
  widthPx: number;
  /** 图片对应的 CSS 高度（px）。 */
  heightPx: number;
  /** 图片水平对齐。 */
  align?: "left" | "center" | "right";
}

/** 导出行内文本样式。 */
export interface ExportInlineTextStyle {
  /** 是否加粗。 */
  bold?: boolean;
  /** 是否斜体。 */
  italic?: boolean;
  /** 是否下划线。 */
  underline?: boolean;
  /** 是否删除线。 */
  strike?: boolean;
  /** 是否行内代码。 */
  code?: boolean;
  /** 上标或下标。 */
  script?: "super" | "sub";
  /** 链接地址。 */
  linkHref?: string;
  /** 文本颜色。 */
  color?: ExportRgbColor;
  /** 文本高亮背景色。 */
  backgroundColor?: ExportRgbColor;
}

/** 导出行内内容片段。 */
export type ExportInlineContentRun =
  | {
      /** 片段类型。 */
      type: "text";
      /** 文本内容。 */
      text: string;
      /** 文本样式。 */
      style?: ExportInlineTextStyle;
    }
  | {
      /** 片段类型。 */
      type: "image";
      /** 图片内容。 */
      imageContent: ExportImageContent;
    };

/** 导出文本块内容。 */
export interface ExportTextBlockContent {
  /** 文本内容。 */
  text: string;
  /** 文本块类型。 */
  blockType?: ExportTextBlockType;
  /** 表格内容。 */
  tableContent?: ExportTableContent;
  /** 图片内容。 */
  imageContent?: ExportImageContent;
  /** 图片说明文本。 */
  imageCaptionText?: string;
  /** 行内混合内容。 */
  inlineContent?: ExportInlineContentRun[];
  /** 任务列表标记。 */
  taskListMarker?: ExportTaskListMarker;
  /** 任务列表标记颜色样式。 */
  taskListMarkerStyle?: ExportTaskListMarkerStyle;
  /** 列表项前缀文本（如 1. / a. / i. / •）。 */
  listMarker?: string;
  /** 列表项左侧缩进（pt）。 */
  listIndentPt?: number;
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
