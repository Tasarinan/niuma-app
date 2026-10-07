# 乾坤AI容我懒 · 文案模板

署名一律 **乾坤AI容我懒**。模板是可粘进 `article.md` 的 Markdown（含现有 `:::hero` / `:::card` / `:::quote-card` 结构块）。

## 怎么用（现在）

1. 按栏目打开对应 kit：`lushu.md` / `fde.md` / `foreign.md`
2. 整段粘进稿件，替换 `{{...}}`
3. 只要其中一块时，打开同目录的 `manifesto.md`、`follow.md`、`divider-*.md`

## 怎么定制（以后插入）

1. 复制任意 `.md`，改文案
2. 在 `index.yaml` 加一条：`id`、`name`、`series`、`slot`、`file`
3. `id` 不要和现有的撞。用户条目优先于同名内置条目（插入功能接上后按此规则）

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
| `{{body}}` | 正文要写的位置 |
