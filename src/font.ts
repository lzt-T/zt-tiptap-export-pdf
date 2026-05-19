import { type jsPDF } from "jspdf";
import { BUILTIN_CHINESE_FONT_BASE64 } from "./fonts/builtinChineseFontBase64";

/** 内置字体在 VFS 中的文件名。 */
const BUILTIN_FONT_FILE_NAME = "NotoSansSC-VF.ttf";
/** 内置字体的 PDF 字体族名称。 */
export const BUILTIN_FONT_FAMILY = "NotoSansSC";
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
  const fontSet = document.fonts;
  if (!fontSet) {
    return;
  }
  if (!browserBuiltinFontRegisterTask) {
    browserBuiltinFontRegisterTask = (async () => {
      /** 可写字体集合，兼容当前 DOM 类型声明缺少 add 的情况。 */
      const writableFontSet = fontSet as FontFaceSet & { add(font: FontFace): void };
      /** 浏览器字体对象，用于让离屏 DOM 按内置字体排版。 */
      const browserFontFace = new FontFace(
        BUILTIN_FONT_FAMILY,
        `url(${BUILTIN_FONT_DATA_URL_PREFIX}${BUILTIN_CHINESE_FONT_BASE64}) format("truetype")`,
        { style: "normal", weight: "400" },
      );
      await browserFontFace.load();
      writableFontSet.add(browserFontFace);
    })();
  }
  await browserBuiltinFontRegisterTask;
}

/**
 * 确保内置中文字体已注册到当前 jsPDF 运行时。
 */
export function ensureBuiltinChineseFontRegistered(pdf: jsPDF): void {
  if (!pdf.existsFileInVFS(BUILTIN_FONT_FILE_NAME)) {
    pdf.addFileToVFS(BUILTIN_FONT_FILE_NAME, BUILTIN_CHINESE_FONT_BASE64);
  }
  pdf.addFont(BUILTIN_FONT_FILE_NAME, BUILTIN_FONT_FAMILY, "normal");
}

/**
 * 等待字体在浏览器字体系统中就绪，降低 html 渲染链路的字体回退概率。
 */
export async function waitForFontReady(fontFamily: string): Promise<void> {
  await ensureBrowserBuiltinFontRegistered(fontFamily);
  const fontSet = document.fonts;
  if (!fontSet) {
    return;
  }
  await Promise.all([
    fontSet.load(`${EXPORT_FONT_LOAD_SIZE_PX}px "${fontFamily}"`),
    fontSet.ready,
  ]);
}
