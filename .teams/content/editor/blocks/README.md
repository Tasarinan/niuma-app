# 乾坤AI容我懒 · 文案模板

署名一律 **乾坤AI容我懒**。

三层分开，不要混用：

| 层 | 决定什么 | 在哪 |
|----|----------|------|
| **框架** | 这篇按什么顺序讲（开篇、证据、结尾） | `framework-*.md`，改编自 [md2wechat-templates](https://github.com/md2wechat/md2wechat-templates) |
| **栏目** | 发在哪个账号栏目、用哪套开场收束 | `lushu.md` / `fde.md` / `foreign.md` |
| **组件** | 单块插入（宣言、关注、分割、寄语） | `manifesto.md`、`follow.md`、`greeting.md`、`divider-*.md` |
| **主题** | 视觉风格（颜色、字体） | `editor/themes/`，排版时再选 |

换栏目不会改章节顺序；换框架不会改路书/日记/外网的版式；换主题不会改事实和观点。

不接入 md2wechat Convert API / Publishing API。框架只保留章节骨架，不用他们的 `:::verdict` 等排版模块，也不写 `background:`。

## 怎么用（现在）

1. 先选 **框架**：观点、教程、清单、周报等，粘进 `article.md`，替换提示语。没有依据的小节整节删掉
2. 再套 **栏目**（可选）：把框架正文放进栏目套件的 `{{body}}`
3. 需要单块时再插 **组件**
4. 排版主题在编辑器里另选，不要写进框架文件

## 怎么定制（以后插入）

1. 复制任意 `.md`，改文案
2. 在 `index.yaml` 加一条：`id`、`name`、`series`、`slot`、`file`
3. `slot`：`framework` = 框架，`kit` = 栏目，其它 = 组件
4. `id` 不要和现有的撞

目录：`.teams/content/editor/blocks/`

## 占位符

| 占位 | 含义 |
|------|------|
| `{{title}}` | 本篇标题 |
| `{{one_liner}}` | 开场一句 |
| `{{minutes}}` | 预计阅读分钟 |
| `{{tool}}` | 工具名（路书） |
| `{{quote}}` | 本篇金句 |
| `{{next}}` | 下期预告 |
| `{{body}}` | 栏目套件里放框架正文的位置 |
