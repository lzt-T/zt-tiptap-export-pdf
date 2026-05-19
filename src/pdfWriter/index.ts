import { type jsPDF as JsPdfInstance } from "jspdf";
import { type ExportTextBlockType, type PdfWriteCursor } from "../exportTypes";
import { writeBlockquoteTextBlock } from "./blockquoteWriter";
import { writeCodeTextBlock } from "./codeWriter";
import { writeDefaultTextBlock } from "./defaultWriter";
import { writeTableTextBlock } from "./tableWriter";
import { type TextBlockWriter, type WriteTextBlockParams } from "./types";

/** 文本块写入策略。 */
const TEXT_BLOCK_WRITER_MAP: Record<ExportTextBlockType, TextBlockWriter> = {
  blockquote: writeBlockquoteTextBlock,
  code: writeCodeTextBlock,
  table: writeTableTextBlock,
};

/** 写入一个文本块。 */
export function writeTextBlock(pdf: JsPdfInstance, cursor: PdfWriteCursor, params: WriteTextBlockParams): void {
  // 文本块写入策略。
  const writer = params.blockType ? TEXT_BLOCK_WRITER_MAP[params.blockType] : undefined;
  if (writer) {
    writer(pdf, cursor, params);
    return;
  }
  writeDefaultTextBlock(pdf, cursor, params);
}
