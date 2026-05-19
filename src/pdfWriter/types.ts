import { type jsPDF as JsPdfInstance } from "jspdf";
import {
  type ExportImageContent,
  type ExportInlineContentRun,
  type ExportTableContent,
  type ExportTaskListMarker,
  type ExportTextBlockStyle,
  type ExportTextBlockType,
  type PdfWriteCursor,
} from "../exportTypes";

/** 文本块写入输入参数。 */
export interface WriteTextBlockParams {
  /** 文本内容。 */
  text: string;
  /** 文本块样式。 */
  style: ExportTextBlockStyle;
  /** 字体族。 */
  fontFamily: string;
  /** 任务列表标记。 */
  taskListMarker?: ExportTaskListMarker;
  /** 列表项前缀文本。 */
  listMarker?: string;
  /** 列表项左侧缩进（pt）。 */
  listIndentPt?: number;
  /** 文本块类型。 */
  blockType?: ExportTextBlockType;
  /** 表格内容。 */
  tableContent?: ExportTableContent;
  /** 图片内容。 */
  imageContent?: ExportImageContent;
  /** 行内混合内容。 */
  inlineContent?: ExportInlineContentRun[];
}

/** 文本块写入器。 */
export type TextBlockWriter = (pdf: JsPdfInstance, cursor: PdfWriteCursor, params: WriteTextBlockParams) => void;
