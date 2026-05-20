# zt-tiptap-export-pdf

使用 `jsPDF` 在浏览器中将 Tiptap / ProseMirror 编辑器正文节点导出为 PDF。
仓库地址：[https://github.com/lzt-T/zt-tiptap-export-pdf](https://github.com/lzt-T/zt-tiptap-export-pdf)
演示地址：[https://tiptap.xjoker.top/](https://tiptap.xjoker.top/)

## 安装

使用 `pnpm` 管理依赖：

```bash
pnpm add zt-tiptap-export-pdf
```

消费包时也可以按项目实际包管理工具选择：

```bash
npm install zt-tiptap-export-pdf
yarn add zt-tiptap-export-pdf
```

## API

```ts
exportEditorToPdf(element: HTMLElement, options?: ExportEditorToPdfOptions): Promise<void>
```

```ts
interface ExportEditorToPdfOptions {
  filename?: string
  fontFamily?: string
}
```

- `element`：编辑器正文容器，建议传入 `editor.view.dom` 或 `.ProseMirror` 节点，不要包含工具栏、弹层等非正文内容。
- `options.filename`：导出文件名，默认 `editor.pdf`。
- `options.fontFamily`：导出时使用的字体族，默认 `NotoSansSC`，包内置中文字体。

## 支持内容

- 段落、标题、空段落占位。
- 有序列表、无序列表、任务列表。
- 引用、代码块、表格。
- 图片与图片说明文本。
- 块级公式与行内公式。
- 基础行内样式，包括加粗、斜体、下划线、删除线、行内代码、上下标、链接、文字颜色和高亮背景色。

## 基础用法

```ts
import { exportEditorToPdf } from 'zt-tiptap-export-pdf'

const element = document.querySelector('.ProseMirror') as HTMLElement | null

if (element) {
  await exportEditorToPdf(element, { filename: 'editor.pdf' })
}
```

## 与 zt-reactjs-tiptap 集成

```tsx
import { Download } from 'lucide-react'
import { ReactTiptapEditor, type ToolbarItemConfig } from 'zt-reactjs-tiptap'
import { exportEditorToPdf } from 'zt-tiptap-export-pdf'
import 'zt-reactjs-tiptap/style.css'

const toolbarItems: ToolbarItemConfig[] = [
  {
    type: 'custom',
    key: 'export-pdf',
    title: '导出 PDF',
    group: 'custom',
    icon: <Download size={16} />,
    onClick: async ({ editor }) => {
      const root = editor.view.dom as HTMLElement
      await exportEditorToPdf(root, { filename: 'editor.pdf' })
    },
  },
]

export default function App() {
  return <ReactTiptapEditor toolbarItems={toolbarItems} />
}
```

如果你已经能直接拿到 `.ProseMirror` 节点，也可以把该节点作为 `element` 传入。传入内容应尽量只包含编辑器正文。

## 限制说明

- 仅支持浏览器环境。
- 当前固定按 A4 纵向导出。
- 暂不包含页眉页脚、水印和高级打印配置。
- 跨域图片需要满足浏览器 canvas / CORS 限制，否则可能无法导出到 PDF。
- 内置中文字体会增大产物体积，适用于“中文不乱码、可搜索复制”优先的场景。

## 手工验证

仓库内提供 `manual-test/` 作为集成验证页，用于本地确认与 `zt-reactjs-tiptap` 的导出流程。它不是使用本包的必要步骤。

1. 安装仓库依赖。

```bash
pnpm install
```

2. 启动手工验证页。

```bash
pnpm run test:manual
```

3. 打开页面后验证：

- 编辑器可正常输入内容。
- 点击工具栏中的 `PDF` 按钮触发下载。
- 导出文件名为 `editor.pdf`。
