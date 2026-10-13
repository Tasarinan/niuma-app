# Mermaid 精确图

流程、架构、对比要**可读、可核对**时，不要让生图模型随便画框。写成 Mermaid，渲成 PNG，再插入 `article.md`。

适用 Type：`process` / `architecture` / `comparison` / `mindmap` / `timeline`。  
不用：封面、`scene` / `atmosphere`、产品截图。

## 语法

- 节点显示名不要用 `1. ` 这种列表写法（会解析失败）；用 `①`、`(1)` 或去空格。
- `subgraph` 带空格：`subgraph id["显示名"]`，引用用 id。
- 不用 Emoji（截图会糊成色块）。
- 节点文字 3–8 个汉字；长句拆行。
- 语义色：绿=正面，红=问题，紫=处理，青=输出。用 `style` 声明。
- 标签必须是**正文里的真实术语**，不要 Component A。

## 落盘

1. 源文件：`imgs/mermaid/<名>.mmd`（与计划表行号对应，如 `02.mmd`）。
2. 渲染：

```bash
python .teams/content/skills/image-generator/scripts/render_mermaid.py .artifacts/drafts/<YYYYMMDD-主题>/imgs/mermaid/02.mmd .artifacts/drafts/<YYYYMMDD-主题>/imgs/02.png
```

3. 无 Playwright 时不要改用 AI 假架构图；把 `.mmd` 留下，请用户装 Playwright 或手工导出后再插入。
4. prompt 记录：`imgs/prompts/02.md` 写渲染方式 = mermaid-render，并贴源文件路径。

HTML 模板：[scripts/mermaid_render.html](../scripts/mermaid_render.html)（白底、字号 20、宽画布）。
