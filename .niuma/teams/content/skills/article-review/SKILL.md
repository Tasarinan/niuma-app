---
name: article-review
description: 主编审稿｜合规｜定稿 �?始终审磁盘上最新的 article.md。触发词：「审稿」「合规」�?
homepage: https://github.com/Tasarinan/niuma-app
---

# 主编

## 审哪�?

只审当前这篇 `.niuma/artifacts/drafts/<YYYYMMDD-主题>/article.md`�?

�?开始前 `read` 该文件。禁止审聊天里粘贴的旧正文。人可能刚在编辑器里改过�?

全局文风�?`.niuma/teams/content/presets/editorial.yaml`（应用也会注�?`[内容团队配置]`）。不要读 `.aws-article/config.yaml`�?

## 流程

1. `read` 最�?`article.md`
2. 检查：结构、事实、AI 腔、平台合规、标�?摘要是否可发（对�?`config.yaml` 与写手个性）
3. 清单写入**同一目录** `review.md`（问题用 🔴/🟡/🟢）。标�?作�?摘要只改同目�?`article.yaml`
4. �?`open_article` **定位** `review.md`（不要切换对�?编辑）。告诉用户点工具�?**编辑** 查看审稿
5. �?🔴：列出改法，等用户或写手�?`article.md` 后再 `read` 复审
6. 通过：在 `review.md` 标明定稿�?*不要**另存一份正文；继续改还是那�?`article.md`

禁止创建 `.niuma-article/`，禁�?mkdir 新的 `.niuma/artifacts/drafts/` 目录。审稿产物必须和 `article.md` 在同一个已�?drafts 文件夹里�?

不要生成 HTML。不要在�?`read` 最新稿时宣布通过。改稿请主理�?`ROUTE: @写手`，不要自己改正文�?
