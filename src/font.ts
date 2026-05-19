import { type HTMLFontFace, type jsPDF } from "jspdf";
import { BUILTIN_CHINESE_FONT_BASE64 } from "./fonts/builtinChineseFontBase64";

/** 内置字体在 VFS 中的文件名。 */
const BUILTIN_FONT_FILE_NAME = "NotoSansSC-VF.ttf";
/** 内置字体的 PDF 字体族名称。 */
export const BUILTIN_FONT_FAMILY = "NotoSansSC";
/** 导出时字体加载参考字号（px）。 */
const EXPORT_FONT_LOAD_SIZE_PX = 16;
/** 内置字体 data URL 前缀。 */
const BUILTIN_FONT_DATA_URL_PREFIX = "data:font/ttf;base64,";

/** 标记是否已完成字体注册，避免重复注入。 */
let hasRegisteredBuiltinFont = false;

/**
 * 确保内置中文字体已注册到当前 jsPDF 运行时。
 * 说明：
 * - addFileToVFS / addFont 注册在全局字体缓存，注册一次即可复用。
 */
export function ensureBuiltinChineseFontRegistered(pdf: jsPDF): void {
  if (hasRegisteredBuiltinFont) {
    return;
  }
  pdf.addFileToVFS(BUILTIN_FONT_FILE_NAME, BUILTIN_CHINESE_FONT_BASE64);
  pdf.addFont(BUILTIN_FONT_FILE_NAME, BUILTIN_FONT_FAMILY, "normal");
  hasRegisteredBuiltinFont = true;
}

/**
 * 构建供 jsPDF.html 使用的字体声明，确保 html 渲染链路稳定命中中文字体。
 */
export function buildHtmlFontFaces(fontFamily: string): HTMLFontFace[] {
  return [
    {
      family: fontFamily,
      style: "normal",
      weight: "400",
      src: [
        {
          url: `${BUILTIN_FONT_DATA_URL_PREFIX}${BUILTIN_CHINESE_FONT_BASE64}`,
          format: "truetype",
        },
      ],
    },
  ];
}

/**
 * 等待字体在浏览器字体系统中就绪，降低 html 渲染链路的字体回退概率。
 */
export async function waitForFontReady(fontFamily: string): Promise<void> {
  const fontSet = document.fonts;
  if (!fontSet) {
    return;
  }
  await Promise.all([
    fontSet.load(`${EXPORT_FONT_LOAD_SIZE_PX}px "${fontFamily}"`),
    fontSet.ready,
  ]);
}
