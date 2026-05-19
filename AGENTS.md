## 目录结构规范

### 1. 公共入口

- `src/index.ts` 只作为公共 API 入口。
- `src/index.ts` 仅允许导出明确对外暴露的能力，例如函数、类型或常量。
- 不要在 `src/index.ts` 中编写 DOM 处理、PDF 写入、字体注册、文本换行等具体实现。
- 内部工具函数不从 `src/index.ts` 导出，除非明确要成为包的公开 API。

### 2. 当前源码职责

- `src/exportEditorToPdf.ts`：PDF 导出主流程编排，负责串联字体准备、PDF 创建、离屏 DOM、块级节点遍历和保存。
- `src/exportTypes.ts`：导出相关类型定义，包括公开类型和内部协作类型。
- `src/exportConstants.ts`：导出流程使用的常量配置。
- `src/exportDom.ts`：DOM 节点解析、ProseMirror 根节点识别、块级节点收集和文本读取。
- `src/exportText.ts`：文本样式解析、字号换算、行高解析和 PDF 文本换行。
- `src/exportPdfWriter.ts`：PDF 分页空间判断和文本块写入。
- `src/font.ts`：字体注册、字体加载等待和 jsPDF 字体注入。
- `src/fonts/`：字体资源文件目录。

### 3. 新增文件放置规则

- 新增公共 API 时，先在对应职责模块中实现，再通过 `src/index.ts` 显式导出。
- 新增内部能力时，优先放入现有职责模块。
- 只有当新能力职责明显独立，或放入现有文件会让职责混杂时，才新增文件。
- 新增文件命名应直接表达职责，避免使用 `utils.ts`、`helpers.ts` 这类泛化命名。
- 不要为了单次使用的逻辑新增抽象或目录。

## 源码地址

富文本的源码地址在`D:\selfProjects\zt-reactjs-tiptap`，有什么不同，可以直接读取
