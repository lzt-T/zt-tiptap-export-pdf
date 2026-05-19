/** 读取引用块文本，保留换行语义。 */
export function getBlockquoteText(element: HTMLElement): string {
  // 引用块子段落文本列表。
  const paragraphTexts: string[] = [];
  // 引用块中的块级子节点。
  const blockChildren = Array.from(element.children).filter((childElement): childElement is HTMLElement => {
    if (!(childElement instanceof HTMLElement)) {
      return false;
    }
    const tagName = childElement.tagName.toLowerCase();
    return ["p", "pre", "blockquote", "ul", "ol", "li"].includes(tagName);
  });

  if (blockChildren.length > 0) {
    blockChildren.forEach((blockChild) => {
      const tagName = blockChild.tagName.toLowerCase();
      if (tagName === "ul" || tagName === "ol") {
        // 列表中的每个项作为独立段落。
        const listItemElements = Array.from(blockChild.children).filter(
          (listItemElement): listItemElement is HTMLElement => listItemElement instanceof HTMLElement && listItemElement.tagName.toLowerCase() === "li",
        );
        listItemElements.forEach((listItemElement) => {
          // 列表项文本。
          const listItemText = listItemElement.innerText.replace(/\r?\n/g, "\n").trim();
          if (listItemText || listItemElement.querySelector("br")) {
            paragraphTexts.push(listItemText);
          }
        });
        return;
      }
      // 普通块子节点文本。
      const blockChildText = blockChild.innerText.replace(/\r?\n/g, "\n").trim();
      if (blockChildText || blockChild.querySelector("br")) {
        paragraphTexts.push(blockChildText);
      }
    });
  } else {
    // 无块级子节点时，退回文本行提取。
    const fallbackLines = element.innerText.replace(/\r?\n/g, "\n").split("\n");
    fallbackLines.forEach((lineText) => {
      paragraphTexts.push(lineText.trim());
    });
  }

  // 去掉首尾空段，保留中间空段。
  let startIndex = 0;
  while (startIndex < paragraphTexts.length && !paragraphTexts[startIndex]) {
    startIndex += 1;
  }
  let endIndex = paragraphTexts.length - 1;
  while (endIndex >= startIndex && !paragraphTexts[endIndex]) {
    endIndex -= 1;
  }
  if (endIndex < startIndex) {
    return "";
  }
  return paragraphTexts.slice(startIndex, endIndex + 1).join("\n");
}

/** 读取代码块文本，保留换行与前导空格。 */
export function getCodeBlockText(element: HTMLElement): string {
  // 代码块原始文本。
  const rawText = (element.textContent || "").replace(/\r\n?/g, "\n");
  // 代码行列表。
  const lines = rawText.split("\n");
  // 首个非空行索引。
  let startIndex = 0;
  while (startIndex < lines.length && !lines[startIndex].trim()) {
    startIndex += 1;
  }
  // 末个非空行索引。
  let endIndex = lines.length - 1;
  while (endIndex >= startIndex && !lines[endIndex].trim()) {
    endIndex -= 1;
  }
  if (endIndex < startIndex) {
    return "";
  }
  return lines.slice(startIndex, endIndex + 1).join("\n");
}
