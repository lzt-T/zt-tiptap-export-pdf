import { ReactTiptapEditor, type ToolbarItemConfig } from "zt-reactjs-tiptap";
import "zt-reactjs-tiptap/style.css";
import { exportEditorToPdf } from "../../src/index";
import { DEMO_CONTENT } from "./demoContent";
import "./styles.css";

// 手工验证页面标题。
const PAGE_TITLE = "zt-reactjs-tiptap 导出 PDF 手工验证";
// 手工验证页面说明。
const PAGE_DESCRIPTION =
  "编辑下方文档后，点击编辑器工具栏中的“导出 PDF”，即可集中检查富文本内容、复杂块结构与分页效果。";
// 手工验证操作步骤。
const VALIDATION_STEPS = ["浏览或修改示例文档", "点击工具栏中的“导出 PDF”", "对照覆盖清单检查生成结果"];
// 当前示例覆盖的导出能力。
const COVERAGE_ITEMS = [
  "标题与长文分页",
  "行内文本样式",
  "段落对齐与缩进",
  "多级列表与任务项",
  "引用与代码块",
  "复杂表格",
  "本地图片与说明",
  "行内与块级公式",
];

// 导出按钮配置。
const EXPORT_TOOLBAR_ITEM: ToolbarItemConfig = {
  type: "custom",
  key: "export-pdf",
  title: "导出 PDF",
  group: "custom",
  icon: <span>PDF</span>,
  /** 导出当前编辑器内容。 */
  onClick: async ({ editor }) => {
    // 编辑区根节点。
    const editorRootElement = editor.view.dom as HTMLElement;
    await exportEditorToPdf(editorRootElement, { filename: "editor.pdf" });
  },
};

// 编辑器工具栏项。
const TOOLBAR_ITEMS: ToolbarItemConfig[] = [EXPORT_TOOLBAR_ITEM];

/** 渲染 PDF 导出手工验证页面。 */
export function App() {
  return (
    <main className="ManualTestPage">
      <header className="ManualTestPage__Header">
        <div className="ManualTestPage__HeadingGroup">
          <p className="ManualTestPage__Kicker">PDF export workspace</p>
          <h1 className="ManualTestPage__Title">{PAGE_TITLE}</h1>
          <p className="ManualTestPage__Description">{PAGE_DESCRIPTION}</p>
        </div>
        <span className="ManualTestPage__Status">本地手工验收</span>
      </header>

      <section className="ManualTestPage__Guide" aria-labelledby="validation-guide-title">
        <div className="ManualTestPage__GuideColumn">
          <h2 id="validation-guide-title" className="ManualTestPage__SectionTitle">
            验收步骤
          </h2>
          <ol className="ManualTestPage__Steps">
            {VALIDATION_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="ManualTestPage__GuideColumn">
          <h2 className="ManualTestPage__SectionTitle">覆盖能力</h2>
          <ul className="ManualTestPage__CoverageList">
            {COVERAGE_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ManualTestPage__Workspace" aria-labelledby="editor-workspace-title">
        <div className="ManualTestPage__WorkspaceHeading">
          <div>
            <h2 id="editor-workspace-title" className="ManualTestPage__SectionTitle">
              可编辑验证文档
            </h2>
            <p className="ManualTestPage__WorkspaceDescription">示例内容可直接修改，导出时会读取编辑器中的最新 DOM。</p>
          </div>
          <p className="ManualTestPage__ExportHint">导出入口位于编辑器工具栏右侧</p>
        </div>

        <div className="ManualTestPage__Editor">
          <ReactTiptapEditor editorMode="headless" value={DEMO_CONTENT} toolbarItems={TOOLBAR_ITEMS} />
        </div>
      </section>
    </main>
  );
}
