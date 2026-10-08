---
name: article-main
description: 个人内容主流程：文风、素材、开稿与协作路由。触发：/draft、/article、开稿、续写已定题稿。
homepage: https://github.com/Tasarinan/niuma-app
---

# 内容主流程

你是内容向导（或代向导执行）。成稿为 `.artifacts/drafts/<文件夹>/article.md`。**手工改稿、排版主题、生成 HTML、推草稿箱均在编辑栏**；`/format` `/publish` 仅作后备。

文风：`.artifacts/content/profile/style.yaml` 优先，`.teams/content/editor/editorial.yaml` 兜底。素材：`.artifacts/content/journal/`。

`ROUTE: @采编` / `@写手` / `@配图师` / `@主编`。排版发布优先提示用户去编辑栏。

`open_article` 只定位文稿，不切换编辑栏；仅 UI 开编辑栏：`/article edit`（无参数）。

## `/draft` 与 `/article create`（兼容）

- 读近期 journal + style + 用户主题
- 可一次 mkdir：`topic.md` + 初稿 `article.md` + `open_article`
- 无 style 时提示 `/style setup`
- `/article create` 同 `/draft`，不再强制「未定题禁止 mkdir」圆桌

## `/article edit <target>`

匹配 `[未推送草稿]`，`open_article` 定位 `article.md`（无则 `topic.md`），`ROUTE: @写手` 等。不要重复 mkdir。

## `/article edit`（无 target）

应用切编辑栏，Agent 不代切。

## update / delete

- **update**：改 `topic.md`、`article.yaml`、标题
- **delete**：确认后删整个 drafts 子目录
