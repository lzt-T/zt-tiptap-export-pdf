import { BUILTIN_FONT_FAMILY } from "./font";

// 默认 PDF 文件名。
export const DEFAULT_PDF_FILENAME = "editor.pdf";
// 离屏渲染容器的 left 值，避免导出时闪现。
export const OFFSCREEN_LEFT_PX = "-100000px";
// PDF 顶部边距（pt）。
export const PDF_TOP_MARGIN_PT = 48;
// PDF 横向边距（pt）。
export const PDF_HORIZONTAL_MARGIN_PT = 24;
// PDF 底部边距（pt）。
export const PDF_BOTTOM_MARGIN_PT = 24;
// PDF 文本宽度安全余量（pt），避免边界测量误差导致裁剪。
export const PDF_TEXT_WIDTH_SAFETY_PT = 2;
// 浏览器 CSS 像素与 pt 的换算比例（72pt / 96px）。
export const CSS_PT_PER_PX = 72 / 96;
// 浏览器 CSS pt 与像素的换算比例（96px / 72pt）。
export const CSS_PX_PER_PT = 96 / 72;
// 默认导出字体族。
export const DEFAULT_EXPORT_FONT_FAMILY = BUILTIN_FONT_FAMILY;
// 默认正文行高倍数。
export const DEFAULT_LINE_HEIGHT_FACTOR = 1.5;
// 默认块后间距（pt）。
export const DEFAULT_BLOCK_MARGIN_BOTTOM_PT = 8;
// 引用块默认左侧缩进（pt）。
export const DEFAULT_BLOCKQUOTE_INDENT_PT = 14;
// 引用块左侧竖线与文本的间隔（pt）。
export const BLOCKQUOTE_LINE_GAP_PT = 8;
// 引用块左侧竖线宽度（pt）。
export const BLOCKQUOTE_LINE_WIDTH_PT = 1;
// 列表项前缀。
export const LIST_ITEM_PREFIX = "• ";
// 优先作为行尾断点的字符。
export const PREFERRED_LINE_BREAK_CHARACTERS = " ,.;:!?，。、《》；：！？）】」』)]}";
// 固定导出标题样式（对齐 zt-reactjs-tiptap prose.css）。
export const EXPORT_HEADING_STYLE_MAP = {
  h1: { fontSizeEm: 2, fontWeight: "700", lineHeight: "1.3", marginBottomPt: 10 },
  h2: { fontSizeEm: 1.5, fontWeight: "700", lineHeight: "1.4", marginBottomPt: 9 },
  h3: { fontSizeEm: 1.25, fontWeight: "700", lineHeight: "1.5", marginBottomPt: 8 },
  h4: { fontSizeEm: 1.125, fontWeight: "600", lineHeight: "1.5", marginBottomPt: 7 },
  h5: { fontSizeEm: 1, fontWeight: "600", lineHeight: "1.55", marginBottomPt: 6 },
  h6: { fontSizeEm: 1, fontWeight: "500", lineHeight: "1.6", marginBottomPt: 6 },
} as const;
