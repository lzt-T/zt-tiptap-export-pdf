import { type jsPDF } from "jspdf";
import { BUILTIN_CHINESE_BOLD_FONT_BASE64 } from "./fonts/builtinChineseBoldFontBase64";
import { BUILTIN_CHINESE_BOLD_ITALIC_FONT_BASE64 } from "./fonts/builtinChineseBoldItalicFontBase64";
import { BUILTIN_CHINESE_FONT_BASE64 } from "./fonts/builtinChineseFontBase64";
import { BUILTIN_CHINESE_ITALIC_FONT_BASE64 } from "./fonts/builtinChineseItalicFontBase64";

/** 内置常规字体在 VFS 中的文件名。 */
const BUILTIN_REGULAR_FONT_FILE_NAME = "NotoSansSC-VF.ttf";
/** 内置粗体字体在 VFS 中的文件名。 */
const BUILTIN_BOLD_FONT_FILE_NAME = "NotoSansSC-Bold.ttf";
/** 内置斜体字体在 VFS 中的文件名。 */
const BUILTIN_ITALIC_FONT_FILE_NAME = "NotoSansSC-Italic.ttf";
/** 内置粗斜体字体在 VFS 中的文件名。 */
const BUILTIN_BOLD_ITALIC_FONT_FILE_NAME = "NotoSansSC-BoldItalic.ttf";
/** 内置字体的 PDF 字体族名称。 */
export const BUILTIN_FONT_FAMILY = "NotoSansSC";
/** 内置字体注册到 jsPDF 的样式映射。 */
const BUILTIN_PDF_FONT_FILE_MAP = {
  bold: BUILTIN_BOLD_FONT_FILE_NAME,
  bolditalic: BUILTIN_BOLD_ITALIC_FONT_FILE_NAME,
  italic: BUILTIN_ITALIC_FONT_FILE_NAME,
  normal: BUILTIN_REGULAR_FONT_FILE_NAME,
} as const;
/** 内置字体注册到 jsPDF 的 base64 映射。 */
const BUILTIN_PDF_FONT_BASE64_MAP = {
  [BUILTIN_BOLD_FONT_FILE_NAME]: BUILTIN_CHINESE_BOLD_FONT_BASE64,
  [BUILTIN_BOLD_ITALIC_FONT_FILE_NAME]: BUILTIN_CHINESE_BOLD_ITALIC_FONT_BASE64,
  [BUILTIN_ITALIC_FONT_FILE_NAME]: BUILTIN_CHINESE_ITALIC_FONT_BASE64,
  [BUILTIN_REGULAR_FONT_FILE_NAME]: BUILTIN_CHINESE_FONT_BASE64,
} as const;
/** 导出时字体加载参考字号（px）。 */
const EXPORT_FONT_LOAD_SIZE_PX = 16;
/** 内置字体 data URL 前缀。 */
const BUILTIN_FONT_DATA_URL_PREFIX = "data:font/ttf;base64,";

/** 浏览器内置字体注册任务，避免并发导出时重复加载。 */
let browserBuiltinFontRegisterTask: Promise<void> | null = null;

/**
 * 确保内置中文字体已注册到浏览器字体系统。
 */
async function ensureBrowserBuiltinFontRegistered(fontFamily: string): Promise<void> {
  if (fontFamily !== BUILTIN_FONT_FAMILY || typeof FontFace === "undefined") {
    return;
  }
  // 浏览器字体集合。
  const fontSet = document.fonts;
  if (!fontSet) {
    return;
  }
  if (!browserBuiltinFontRegisterTask) {
    browserBuiltinFontRegisterTask = (async () => {
      /** 可写字体集合，兼容当前 DOM 类型声明缺少 add 的情况。 */
      const writableFontSet = fontSet as FontFaceSet & { add(font: FontFace): void };
      /** 浏览器常规字体对象，用于让离屏 DOM 按内置字体排版。 */
      const regularFontFace = new FontFace(
        BUILTIN_FONT_FAMILY,
        `url(${BUILTIN_FONT_DATA_URL_PREFIX}${BUILTIN_CHINESE_FONT_BASE64}) format("truetype")`,
        { style: "normal", weight: "400" },
      );
      /** 浏览器粗体字体对象，用于让加粗文本按真实粗体排版。 */
      const boldFontFace = new FontFace(
        BUILTIN_FONT_FAMILY,
        `url(${BUILTIN_FONT_DATA_URL_PREFIX}${BUILTIN_CHINESE_BOLD_FONT_BASE64}) format("truetype")`,
        { style: "normal", weight: "700" },
      );
      /** 浏览器斜体字体对象，用于让斜体文本按真实斜体排版。 */
      const italicFontFace = new FontFace(
        BUILTIN_FONT_FAMILY,
        `url(${BUILTIN_FONT_DATA_URL_PREFIX}${BUILTIN_CHINESE_ITALIC_FONT_BASE64}) format("truetype")`,
        { style: "italic", weight: "400" },
      );
      /** 浏览器粗斜体字体对象，用于让粗斜体文本按真实粗斜体排版。 */
      const boldItalicFontFace = new FontFace(
        BUILTIN_FONT_FAMILY,
        `url(${BUILTIN_FONT_DATA_URL_PREFIX}${BUILTIN_CHINESE_BOLD_ITALIC_FONT_BASE64}) format("truetype")`,
        { style: "italic", weight: "700" },
      );
      /** 需要注册到浏览器的内置字体对象。 */
      const builtinFontFaces = [regularFontFace, boldFontFace, italicFontFace, boldItalicFontFace];
      await Promise.all(builtinFontFaces.map((fontFace) => fontFace.load()));
      builtinFontFaces.forEach((fontFace) => {
        writableFontSet.add(fontFace);
      });
    })();
  }
  await browserBuiltinFontRegisterTask;
}

/**
 * 确保内置中文字体已注册到当前 jsPDF 运行时。
 */
export function ensureBuiltinChineseFontRegistered(pdf: jsPDF): void {
  Object.entries(BUILTIN_PDF_FONT_BASE64_MAP).forEach(([fontFileName, fontBase64]) => {
    if (!pdf.existsFileInVFS(fontFileName)) {
      pdf.addFileToVFS(fontFileName, fontBase64);
    }
  });
  Object.entries(BUILTIN_PDF_FONT_FILE_MAP).forEach(([fontStyle, fontFileName]) => {
    pdf.addFont(fontFileName, BUILTIN_FONT_FAMILY, fontStyle);
  });
}

/**
 * 等待字体在浏览器字体系统中就绪，降低 html 渲染链路的字体回退概率。
 */
export async function waitForFontReady(fontFamily: string): Promise<void> {
  await ensureBrowserBuiltinFontRegistered(fontFamily);
  // 浏览器字体集合。
  const fontSet = document.fonts;
  if (!fontSet) {
    return;
  }
  await Promise.all([
    fontSet.load(`${EXPORT_FONT_LOAD_SIZE_PX}px "${fontFamily}"`),
    fontSet.load(`700 ${EXPORT_FONT_LOAD_SIZE_PX}px "${fontFamily}"`),
    fontSet.load(`italic ${EXPORT_FONT_LOAD_SIZE_PX}px "${fontFamily}"`),
    fontSet.load(`italic 700 ${EXPORT_FONT_LOAD_SIZE_PX}px "${fontFamily}"`),
    fontSet.ready,
  ]);
}
