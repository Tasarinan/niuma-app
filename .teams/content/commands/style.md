---
description: 个人写作文风档案（建立/查看/更新），供 AI 写稿对照
argument-hint: [setup|view|update] [field] [value]
---

# 文风档案（/style）

读写 `.artifacts/content/profile/style.yaml`。团队默认见 `.teams/content/editor/editorial.yaml`；**profile 优先，editorial 兜底**。排版主题在编辑栏选，不写进 style。

## setup

收集：语气、目标读者、代表范文（路径或摘录）、禁用词、常写栏目、段落习惯。可一次说完或逐步填。写入 profile（保留历史：追加带时间戳条目或 `style.history/`）。

## view

展示当前文风摘要。

## update

`/style update 字段 值` — 追加或 patch 字段，不静默抹掉历史。

## 示例

```
/style setup
/style view
/style update tone 更口语
```
