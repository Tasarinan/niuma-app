---
description: 开一篇新稿 — 圆桌定题，确认后才建目录（不续旧稿）
agent: 主理人
arguments:
  - name: topic
    description: 想聊的方向或素材（可空，空则从简报和 IMA 开聊）
    required: false
---
切换到**主理人**。加载 `article-main`。这是**开新题**，不是续写，也不是排版或发布。

应用已经注入建设者中央 feed（`[中央 Feed · follow-builders]`）、IMA 文章资产。未推送草稿只作对照，**禁止** `open_article` 旧路径，**禁止**改旧 `article.md`。不要 curl ima.qq.com，不要跑 ima_api.cjs，不要跑 prepare-digest.mjs。

写稿/配图走系统 API 提供商，不要用 `WRITING_MODEL_API_KEY` / `IMAGE_MODEL_API_KEY`。文风读 `.niuma/teams/content/config.yaml`。主理人用 `ROUTE: @角色` 切到采编、写手、配图师、主编、发行；不要自己代写、代配图、代发布。用户要排版时请打 `/format`，要推草稿箱时请打 `/publish`，要手工改稿时请打 `/edit`。不要创建 `.niuma-article/`。

圆桌只聊天：需要素材和角度时点名采编。禁止 mkdir、禁止写 topic.md、禁止定位文稿。讨论形成明确结论、用户确认后，主理人才创建 `.artifacts/drafts/<YYYYMMDD-主题>/` 并写入 `topic.md`，再用 `open_article` 定位**这篇新**文稿。不要替用户切换「对话 / 编辑」。

续旧稿请用 `/resume`。
