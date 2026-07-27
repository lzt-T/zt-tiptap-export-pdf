// 覆盖 PDF 导出能力的完整中文演示文档。
export const DEMO_CONTENT = String.raw`
  <h1 style="text-align: center">PDF 导出能力验收文档</h1>
  <p style="text-align: center"><span style="color: #475569">用于集中检查富文本结构、样式还原、复杂内容与自动分页</span></p>
  <blockquote><p>验收提示：请先浏览本文档在编辑器中的效果，再点击工具栏中的“导出 PDF”，逐项对照页面上方的覆盖清单。</p></blockquote>

  <h2>一、标题与段落排版</h2>
  <p>这份文档包含足够多的中文内容，用于验证 A4 页面中的自动换行、段落间距与跨页衔接。导出结果应保持清晰的阅读层级，不应出现文字截断、内容重叠或页面底部溢出。</p>
  <h3>三级标题示例</h3>
  <p style="text-align: left">左对齐适合普通正文，是长篇内容最常用的排版方式。</p>
  <p style="text-align: center">居中段落用于验证标题、提示语等短内容的水平位置。</p>
  <p style="text-align: right">右对齐段落用于验证文本写入起点与行宽计算。</p>
  <p style="text-align: justify">两端对齐段落包含一段较长的中文说明，用于观察浏览器计算样式传递到 PDF 后的行宽、字距与换行结果是否稳定。即使内容延伸到多行，也应在页面可用宽度内完整展示。</p>
  <p data-indent="1" style="margin-left: 2em">这是一段带一级缩进的正文，用于检查段落左侧缩进是否保留。</p>

  <h2>二、行内文本样式</h2>
  <p>同一段落中包含 <strong>粗体文字</strong>、<em>斜体文字</em>、<u>下划线文字</u>、<s>删除线文字</s>、<code>inlineCode()</code>，以及 <a href="https://tiptap.dev/" target="_blank" rel="noopener noreferrer">可点击链接</a>。</p>
  <p>颜色与高亮示例：<span style="color: #dc2626">红色强调文字</span>、<span style="color: #2563eb">蓝色说明文字</span>、<mark style="background-color: #fef08a">黄色高亮内容</mark>。上下标示例：H<sub>2</sub>O 与 E = mc<sup>2</sup>。</p>

  <h2>三、列表与任务</h2>
  <h3>无序嵌套列表</h3>
  <ul>
    <li><p>一级项目：检查圆点标记和正文间距</p></li>
    <li>
      <p>一级项目：检查嵌套层级</p>
      <ul>
        <li><p>二级项目：内容应保持清晰缩进</p></li>
        <li><p>二级项目：长文本换行后应与正文起点对齐，而不是回到标记左侧</p></li>
      </ul>
    </li>
  </ul>
  <h3>有序列表</h3>
  <ol>
    <li><p>确认编号顺序连续</p></li>
    <li><p>确认编号与正文间距稳定</p></li>
    <li><p>确认长列表项能够正常换行并参与分页</p></li>
  </ol>
  <h3>任务列表</h3>
  <ul data-type="taskList">
    <li data-type="taskItem" data-checked="true"><p>已完成：验证标题、段落与行内格式</p></li>
    <li data-type="taskItem" data-checked="false"><p>待完成：检查表格、图片和公式导出结果</p></li>
  </ul>

  <h2>四、引用与代码块</h2>
  <blockquote><p>稳定的 PDF 导出不仅要保留文字，还要正确表达内容层级、强调关系和结构边界。</p></blockquote>
  <p>下面的 TypeScript 代码块用于检查等宽内容、背景、内边距和换行：</p>
  <pre><code class="language-typescript">type ExportStatus = "idle" | "running" | "completed";

interface ExportTask {
  filename: string;
  status: ExportStatus;
}

// 当前导出任务示例。
const exportTask: ExportTask = {
  filename: "editor.pdf",
  status: "completed",
};</code></pre>

  <h2>五、复杂表格</h2>
  <p>表格同时包含表头、背景色、水平与垂直对齐，以及横向和纵向合并单元格。</p>
  <table>
    <tbody>
      <tr>
        <th style="background-color: #e2e8f0; text-align: center"><p>验收模块</p></th>
        <th style="background-color: #e2e8f0; text-align: center"><p>检查内容</p></th>
        <th style="background-color: #e2e8f0; text-align: center"><p>预期结果</p></th>
      </tr>
      <tr>
        <td rowspan="2" style="background-color: #f8fafc; vertical-align: middle"><p>文本排版</p></td>
        <td><p><strong>行内样式</strong>与多行正文</p></td>
        <td style="text-align: center"><p>完整保留</p></td>
      </tr>
      <tr>
        <td><p>对齐、缩进与自动换行</p></td>
        <td style="text-align: right"><p>边界正确</p></td>
      </tr>
      <tr>
        <td><p>结构内容</p></td>
        <td colspan="2" style="background-color: #eff6ff; text-align: center"><p>列表、引用、代码、图片和公式均可写入 PDF</p></td>
      </tr>
    </tbody>
  </table>

  <h2>六、本地图片</h2>
  <p>下图来自 demo 自带的静态资源，不依赖网络连接；导出时应保持宽高比例、居中位置和图片说明。</p>
  <figure data-align="center" style="width: 72%; display: block; margin-left: auto; margin-right: auto">
    <img src="/export-demo.svg" alt="从富文本编辑器导出到 PDF 的流程示意图" />
    <figcaption>图 1：富文本内容经过 DOM 解析和分页写入后生成 PDF</figcaption>
  </figure>

  <h2>七、数学公式</h2>
  <p>行内公式应与前后文字保持同一阅读行，例如质能方程 <span data-type="inline-math" data-latex="E = mc^2"></span>，并继续显示后续说明。</p>
  <p>下面的高斯积分用于检查块级公式的截图、缩放与居中效果：</p>
  <div data-type="block-math" data-latex="\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}"></div>

  <h2>八、长文与自动分页</h2>
  <p>分页验证需要同时观察页面顶部、页面底部和跨页后的首段位置。每个内容块都应该先判断剩余空间，再决定继续写入当前页或创建新页面。标题不应挤压正文，列表标记不应与文字分离，图片和表格也不应超出页面可用区域。</p>
  <p>中文内容的换行还需要兼顾标点符号和连续长文本。导出器会根据字体测量结果逐步收集字符，并优先在适合的位置断行。这一段故意使用较长的句子，用来检查在不同内容宽度下是否仍能得到稳定、易读且没有裁剪的结果。</p>
  <p>当内容进入下一页时，新的写入位置应回到统一的顶部边距。引用块、代码块和普通段落之间的间距需要保持一致，不能因为换页而叠加或丢失。若本节出现在新页面开头，说明前面的示例已经提供了足够的分页验证内容。</p>
  <p>最后，请检查生成文件中的中文字体是否完整，英文、数字、标点和数学公式是否清晰。确认所有内容后，本次手工验收即可完成。</p>

  <h3 style="text-align: center">验收结束</h3>
  <p style="text-align: center"><strong>请返回页面顶部，对照覆盖清单逐项确认。</strong></p>
`;
