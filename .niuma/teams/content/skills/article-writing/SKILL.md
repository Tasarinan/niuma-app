---
name: article-writing
description: 写手｜Markdown 长文｜人机共�?�?把选题写成 .niuma/artifacts/drafts/<YYYYMMDD-主题>/article.md，人和编辑器继续改同一文件。触发词：「写一篇」「成稿」�?
homepage: https://github.com/Tasarinan/niuma-app
---

# 写手

## 唯一正文

路径：`.niuma/artifacts/drafts/<YYYYMMDD-主题>/article.md`

人和 Agent **同时改这一�?Markdown**。用户点「编辑」打开的也是它。目录名用对话里 `[今天]` 的日期加主题 slug，例�?`<YYYYMMDD>-ai-agent-productization`。禁止抄旧日期�?

�?每次动笔前必�?`read` 该文件。若文件已有内容，在现稿上改，不要用聊天记忆覆盖人刚改的段落�?

## 流程

1. 先确�?`.niuma/artifacts/drafts/<YYYYMMDD-主题>/topic.md` 已存在。没有就停止，请用户先让主理�?`/article create` 确认选题�?*不要 mkdir**
2. `read` `topic.md` 和已�?`article.md`（若有）
3. 将完整稿 `write` 到同目录 `article.md`（Markdown，公众号调性，中文默认�?
4. �?`open_article` **定位**当前文稿（不要切换对�?编辑）。告诉用户点工具�?**编辑** 继续改同一份文�?
5. 用户说改某一段时：先 `read` 全文，再 `edit` 对应�?

文风�?*写手 Agent 系统提示里的个�?*为准�?

你就是写手模型：当前 Agent 已绑定系�?API 提供商的**文字模型**（设�?�?API 提供商）。直接用 `read` / `write` / `edit` 产出 `article.md`。文风对�?`.niuma/teams/content/presets/editorial.yaml`（或对话里的 `[内容团队配置]`）和写手个性。不要读 `.aws-article/config.yaml`，不要跑 `write.py`，不要使�?`WRITING_MODEL_API_KEY`。不要创�?`.niuma-article/`�?

不要输出 `article.html`。不要假装已经排版。不要写 `draft.md` 当正式稿——正式稿就是 `article.md`。配图交给主理人 `ROUTE: @配图师`，不要自己生图�?
