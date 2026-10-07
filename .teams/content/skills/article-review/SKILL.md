---
name: article-review
description: 主编审稿｜合规｜定稿 — 始终审磁盘上最新的 article.md。触发词：「审稿」「合规」
homepage: https://github.com/Tasarinan/niuma-app
---

# 主编

## 审哪份

只审当前这篇 `.artifacts/drafts/<YYYYMMDD-主题>/article.md`。

- 开始前 `read` 该文件。禁止审聊天里粘贴的旧正文。人可能刚在编辑器里改过。
- 全局文风见 `.teams/content/editor/editorial.yaml`（应用也会注入 `[内容团队配置]`）。不要读 `.aws-article/config.yaml`。

## 流程

1. `read` 最新 `article.md`（全文，用于哈希与审稿）。
2. 按 [checklist.md](references/checklist.md) 检查：结构、事实、AI 腔、平台合规、标题摘要是否可发（对照 `config.yaml` 与写手个性）。
3. **审稿前快照**（见 [review-artifacts.md](references/review-artifacts.md)）：
   - 读已有 `review.meta.yaml` 的 `round`（无则 `0`），`nextRound = round + 1`。
   - 复制当前 `article.md` → `.history/article-r{nextRound}.md`。
   - 对当前 `article.md` 原文计算 SHA-256（hex 小写）→ `article_sha256`。
4. 写入同目录：
   - `review.md`（问题用 🔴/🟡/🟢，格式见 [output-format.md](references/output-format.md)）。
   - `review.meta.yaml`（`round`、`status`、`reviewed_at`、`article_sha256`、`blocker_count`、`reviewer: chief`）。
   - `review.suggestions.json`（结构化项，与 meta 同轮次、同哈希；规则见 [review-artifacts.md](references/review-artifacts.md)）。
   - 标题/作者/摘要只改同目录 `article.yaml`，不要写进 suggestions 的自动 patch（除非是纯错别字类正文 patch）。
5. 用 `open_article` **定位** `review.md`，并设置 `focus: review`（若工具支持），自动打开编辑栏 **审稿** 侧栏；不要切换对话/编辑。
6. 有 🔴：列出改法，等用户或写手改 `article.md` 后再 `read` 复审（新轮次重复步骤 3–5；重审可只盯上轮 🔴，见 output-format 重审模板）。
7. 通过：在 `review.md` 标明定稿，`review.meta.yaml` 的 `status: pass`；**不要**另存一份正文；继续改还是那份 `article.md`。

禁止创建 `.niuma-article/`，禁止 mkdir 新的 `.artifacts/drafts/` 目录。审稿产物必须和 `article.md` 在同一个已有 drafts 文件夹里。

不要生成 HTML。不要在未 `read` 最新稿时宣布通过。改稿请主理人 `ROUTE: @写手`，不要自己改正文。
