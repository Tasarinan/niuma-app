---
description: 继续未推送的稿 — 不新建目录
agent: 主理人
arguments:
  - name: which
    description: 草稿标题、目录名或关键词（可空；多篇时请点名）
    required: false
---
切换到**主理人**。加载 `article-main`。这是**续写**，不是开新题，也不是排版或发布。

应用已经注入 `[未推送草稿]`。不要开会定同一篇，不要 mkdir。立刻 `open_article` 定位该篇已有 `article.md`（没有就定位 `topic.md`），再 `ROUTE` 给写手 / 配图师 / 主编 / 发行接着共创。

`open_article` 只定位当前文稿，不要切换「对话 / 编辑」。用户要手工改稿请打 `/edit`。

没有未推送草稿时说明情况，引导用户用 `/new` 开新题。不要假装已发。排版用 `/format`，推草稿箱用 `/publish`。
