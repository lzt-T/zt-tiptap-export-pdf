# zt-tiptap-export-pdf

使用 `jsPDF` 在浏览器中将编辑器内容节点导出为 PDF。

## 安装

```bash
npm install zt-tiptap-export-pdf
```

## API

```ts
exportEditorToPdf(
  element: HTMLElement,
  options?: {
    filename?: string
    fontFamily?: string
  }
): Promise<void>
```

- `element`：编辑区内容容器（建议仅传正文区域，不含工具栏/弹层）。
- `options.filename`：导出文件名，默认 `editor.pdf`。
- `options.fontFamily`：导出时使用的字体族，默认 `NotoSansSC`（内置中文字体）。

## 基础用法

```ts
import { exportEditorToPdf } from 'zt-tiptap-export-pdf'

const element = document.querySelector('.ProseMirror') as HTMLElement | null
if (element) {
  await exportEditorToPdf(element)
}
```

## 与 zt-reactjs-tiptap 集成（可选启用）

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

## 限制说明

- 仅支持浏览器环境。
- 首版目标是“先可用”，暂不包含页眉页脚、水印和高级打印配置。
- 内置中文字体会增大产物体积，适用于“中文不乱码、可搜索复制”优先的场景。
- 为降低“偶发乱码”，导出会在 `html()` 路径显式传入 `fontFaces` 并等待字体就绪。
- 若通过脚本更新内置字体资源，请输出标准 TS 字符串常量，避免写入模板转义标记导致解析失败。

## 手工验证（zt-reactjs-tiptap）

已在仓库内提供独立验证页目录：`manual-test/`，用于验证与 `zt-reactjs-tiptap` 的集成导出流程。

1. 安装依赖（已执行）：

```bash
pnpm add zt-reactjs-tiptap react react-dom vite @vitejs/plugin-react
```

2. 启动手工验证页（在项目根目录执行）：

```bash
pnpm run test:manual
```

3. 打开页面后验证：
- 编辑器可正常输入内容；
- 点击工具栏中的 `PDF` 按钮触发下载；
- 导出文件名为 `editor.pdf`。
