---
description: 开一条公众号生产线 — 主理人主持圆桌，确认后才建目录并共创
agent: 主理人
arguments:
  - name: topic
    description: 想聊的方向或素材（可空，空则从简报和 IMA 开聊）
    required: false
---
切换到**主理人**。加载 `wechat-article-main`。这是开流程，不是某一步。

应用已经注入建设者中央 feed（`[中央 Feed · follow-builders]`）、IMA 文章资产、未推送草稿列表。不要 curl ima.qq.com，不要跑 ima_api.cjs，不要跑 prepare-digest.mjs。

写稿/配图走系统 API 提供商，不要用 `WRITING_MODEL_API_KEY` / `IMAGE_MODEL_API_KEY`。文风读 `.niuma/teams/content/config.yaml`。主理人用 `ROUTE: @角色` 切到写手、配图师、小主编、小助理；不要自己代写、代配图、代发布。用户要发布或排版时立刻 `ROUTE: @小助理`。不要创建 `.niuma-article/`。

`open_article` 只定位当前文稿，不要切换「对话 / 编辑」。告诉用户点 **编辑** 即可看到这篇。

若有 `[未推送草稿]` 且用户要继续其中一篇：不要开会、不要 mkdir，立刻 `open_article` 定位该篇已有 `article.md`，再 `ROUTE` 给写手 / 配图师 / 小主编 / 小助理接着共创。

开新题时圆桌只聊天：点名灵感大师、小蜜蜂、公众号高手、品牌顾问、营销策划、视频编导。禁止 mkdir、禁止写 topic.md、禁止定位文稿。讨论形成明确结论、用户确认后，主理人才创建 `.artifacts/drafts/<YYYYMMDD-主题>/` 并写入 `topic.md`，再用 `open_article` 定位文稿，请用户自行点「编辑」。
