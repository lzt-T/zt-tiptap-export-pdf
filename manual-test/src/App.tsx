import { useCallback } from "react";
import { ReactTiptapEditor, type ToolbarItemConfig } from "zt-reactjs-tiptap";
import "zt-reactjs-tiptap/style.css";
import { exportEditorToPdf } from "../../src/index";
import "./styles.css";

/** 手工验证页面标题。 */
const PAGE_TITLE = "zt-reactjs-tiptap 导出 PDF 手工验证";

/** 导出按钮配置。 */
const EXPORT_TOOLBAR_ITEM: ToolbarItemConfig = {
  type: "custom",
  key: "export-pdf",
  title: "导出 PDF",
  group: "custom",
  icon: <span>PDF</span>,
  onClick: async ({ editor }) => {
    /** 编辑区根节点。 */
    const editorRootElement = editor.view.dom as HTMLElement;
    await exportEditorToPdf(editorRootElement, { filename: "editor.pdf" });
  },
};

/** 编辑器工具栏项。 */
const TOOLBAR_ITEMS: ToolbarItemConfig[] = [EXPORT_TOOLBAR_ITEM];

/** 手工验证页主组件。 */
export function App() {
  /** 返回默认内容，方便直接验证多段文本导出。 */
  const getInitialValue = useCallback(() => {
    return `
      <h2>导出验证标题</h2>
      <p>这是一段用于验证 PDF 导出的示例文本。</p>
      <p>你可以继续编辑内容后，再点击工具栏中的“导出 PDF”。</p>
    `;
  }, []);

  return (
    <main className="ManualTestPage">
      <h1 className="ManualTestPage__Title">{PAGE_TITLE}</h1>
      <ReactTiptapEditor 
      
      editorMode="headless"
      value={getInitialValue()}  toolbarItems={TOOLBAR_ITEMS} />
    </main>
  );
}
