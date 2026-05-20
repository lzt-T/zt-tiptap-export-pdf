import { type ExportImageContent, type ExportTextBlockContent } from "../exportTypes";

// 图片加载等待超时时间。
const IMAGE_LOAD_TIMEOUT_MS = 5000;
// 图片说明选择器。
const IMAGE_CAPTION_SELECTOR = ".image-caption-text,.image-caption-input,figcaption";

/** 判断节点是否为图片导出节点。 */
export function isImageExportElement(element: HTMLElement): boolean {
  if (element instanceof HTMLImageElement) {
    return Boolean(element.getAttribute("src"));
  }
  return (
    element.classList.contains("image-node-wrapper") ||
    (element.tagName.toLowerCase() === "figure" && Boolean(element.querySelector("img[src]")))
  );
}

/** 从图片块中读取真实图片节点。 */
function getImageElement(element: HTMLElement): HTMLImageElement | null {
  if (element instanceof HTMLImageElement) {
    return element;
  }
  // 图片节点。
  const imageElement = element.querySelector("img[src]");
  return imageElement instanceof HTMLImageElement ? imageElement : null;
}

/** 从元素样式读取图片水平对齐方式。 */
function getImageAlignFromStyle(element: HTMLElement): ExportImageContent["align"] | null {
  // 元素左外边距。
  const marginLeft = element.style.marginLeft;
  // 元素右外边距。
  const marginRight = element.style.marginRight;
  if (marginLeft === "auto" && marginRight === "auto") {
    return "center";
  }
  if (marginLeft === "auto") {
    return "right";
  }
  return null;
}

/** 读取图片水平对齐方式。 */
function getImageAlign(element: HTMLElement, imageElement: HTMLImageElement): ExportImageContent["align"] {
  // 图片块语义对齐。
  const blockDataAlign = element.getAttribute("data-align");
  if (blockDataAlign === "center" || blockDataAlign === "right" || blockDataAlign === "left") {
    return blockDataAlign;
  }
  // 图片节点语义对齐。
  const imageDataAlign = imageElement.getAttribute("data-align");
  if (imageDataAlign === "center" || imageDataAlign === "right" || imageDataAlign === "left") {
    return imageDataAlign;
  }
  return getImageAlignFromStyle(element) || getImageAlignFromStyle(imageElement) || "left";
}

/** 等待图片加载完成。 */
async function waitForImageReady(imageElement: HTMLImageElement): Promise<boolean> {
  if (imageElement.complete && imageElement.naturalWidth > 0 && imageElement.naturalHeight > 0) {
    return true;
  }

  return new Promise((resolve) => {
    // 加载超时计时器。
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(false);
    }, IMAGE_LOAD_TIMEOUT_MS);

    /** 清理图片加载监听。 */
    function cleanup(): void {
      window.clearTimeout(timeoutId);
      imageElement.removeEventListener("load", handleLoad);
      imageElement.removeEventListener("error", handleError);
    }

    /** 处理图片加载成功。 */
    function handleLoad(): void {
      cleanup();
      resolve(imageElement.naturalWidth > 0 && imageElement.naturalHeight > 0);
    }

    /** 处理图片加载失败。 */
    function handleError(): void {
      cleanup();
      resolve(false);
    }

    imageElement.addEventListener("load", handleLoad);
    imageElement.addEventListener("error", handleError);
  });
}

/** 读取图片渲染尺寸。 */
function getImageRenderSizePx(imageElement: HTMLImageElement): Pick<ExportImageContent, "widthPx" | "heightPx"> | null {
  // 图片布局尺寸。
  const imageRect = imageElement.getBoundingClientRect();
  // 图片宽度。
  const widthPx = imageRect.width > 0 ? Math.ceil(imageRect.width) : imageElement.naturalWidth;
  // 图片高度。
  const heightPx = imageRect.height > 0 ? Math.ceil(imageRect.height) : imageElement.naturalHeight;
  if (widthPx <= 0 || heightPx <= 0) {
    return null;
  }

  return { widthPx, heightPx };
}

/** 将图片绘制为 PNG data URL。 */
function drawImageToDataUrl(imageElement: HTMLImageElement, widthPx: number, heightPx: number): string | null {
  try {
    // 图片绘制画布。
    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    // 画布上下文。
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    context.drawImage(imageElement, 0, 0, widthPx, heightPx);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/** 创建跨域友好的图片副本。 */
async function createCorsImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    // 跨域图片副本。
    const imageElement = new Image();
    // 加载超时计时器。
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, IMAGE_LOAD_TIMEOUT_MS);
    imageElement.crossOrigin = "anonymous";

    /** 处理跨域图片加载成功。 */
    function handleLoad(): void {
      cleanup();
      resolve(imageElement);
    }

    /** 处理跨域图片加载失败。 */
    function handleError(): void {
      cleanup();
      resolve(null);
    }

    /** 清理跨域图片监听。 */
    function cleanup(): void {
      window.clearTimeout(timeoutId);
      imageElement.removeEventListener("load", handleLoad);
      imageElement.removeEventListener("error", handleError);
    }

    imageElement.addEventListener("load", handleLoad);
    imageElement.addEventListener("error", handleError);
    imageElement.src = src;
  });
}

/** 将图片 Blob 读取为 data URL。 */
function readBlobAsDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    // Blob 读取器。
    const reader = new FileReader();

    /** 处理 Blob 读取完成。 */
    function handleLoad(): void {
      // 读取结果。
      const result = reader.result;
      resolve(typeof result === "string" ? result : null);
    }

    /** 处理 Blob 读取失败。 */
    function handleError(): void {
      resolve(null);
    }

    reader.addEventListener("load", handleLoad);
    reader.addEventListener("error", handleError);
    reader.readAsDataURL(blob);
  });
}

/** 通过 fetch 下载可跨域读取的图片 data URL。 */
async function fetchImageDataUrl(src: string): Promise<string | null> {
  try {
    // 图片响应。
    const response = await fetch(src, { mode: "cors" });
    if (!response.ok) {
      return null;
    }

    // 响应内容类型。
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return null;
    }

    // 图片二进制内容。
    const imageBlob = await response.blob();
    return readBlobAsDataUrl(imageBlob);
  } catch {
    return null;
  }
}

/** 将图片节点转为 PNG data URL。 */
async function getImageDataUrl(imageElement: HTMLImageElement, widthPx: number, heightPx: number): Promise<string | null> {
  // 图片地址。
  const imageSrc = imageElement.currentSrc || imageElement.src;
  if (imageSrc.startsWith("data:")) {
    return imageSrc;
  }

  // 当前图片的 data URL。
  const currentImageDataUrl = drawImageToDataUrl(imageElement, widthPx, heightPx);
  if (currentImageDataUrl) {
    return currentImageDataUrl;
  }
  // 跨域图片副本。
  const corsImageElement = await createCorsImageElement(imageSrc);
  // 跨域副本 data URL。
  const corsImageDataUrl = corsImageElement ? drawImageToDataUrl(corsImageElement, widthPx, heightPx) : null;
  if (corsImageDataUrl) {
    return corsImageDataUrl;
  }

  return fetchImageDataUrl(imageSrc);
}

/** 读取图片说明文本。 */
function getImageCaptionText(element: HTMLElement): string | undefined {
  // 图片说明节点。
  const captionElement = element.querySelector(IMAGE_CAPTION_SELECTOR);
  if (!(captionElement instanceof HTMLElement)) {
    return undefined;
  }

  return (captionElement.textContent || "").replace(/\s+/g, " ").trim() || undefined;
}

/** 读取图片块导出内容。 */
export async function getImageBlockExportContent(element: HTMLElement): Promise<ExportTextBlockContent> {
  // 图片节点。
  const imageElement = getImageElement(element);
  if (!imageElement) {
    return { text: "" };
  }
  // 图片是否可用。
  const isImageReady = await waitForImageReady(imageElement);
  if (!isImageReady) {
    return { text: "" };
  }
  // 图片渲染尺寸。
  const imageSize = getImageRenderSizePx(imageElement);
  if (!imageSize) {
    return { text: "" };
  }
  // 图片 data URL。
  const dataUrl = await getImageDataUrl(imageElement, imageSize.widthPx, imageSize.heightPx);
  if (!dataUrl) {
    return { text: "" };
  }

  return {
    text: "[image]",
    blockType: "image",
    imageContent: {
      dataUrl,
      align: getImageAlign(element, imageElement),
      ...imageSize,
    },
    imageCaptionText: getImageCaptionText(element),
  };
}
