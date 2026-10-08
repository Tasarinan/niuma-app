---
description: 草稿兼容命令 — 推荐用 /draft；edit 打开编辑栏或继续已定题稿
argument-hint: [create|edit|update|delete] [target]
---

# 文章草稿（/article · 兼容）

**主路径请用 `/draft`**。本命令保留以免旧 starter 失效。

管理 `.artifacts/drafts/<YYYYMMDD-主题>/`：`article.md` 为正文源；`topic.md` 为选题；`article.yaml` 为元数据与**编辑栏选的排版主题**。

## create

**兼容 `/draft`**。加载 `article-main`，可从 journal + style 直接 mkdir，不必先开圆桌。定题后 `open_article`，请用户到**编辑栏**改稿。

```
/article create
/article create 乾坤AI路书 Cursor 多窗口
/draft 同上
```

## edit

**A. 无 target** — 应用切到「编辑」栏（Agent 不代切）。

```
/article edit
```

**B. 有 target** — 匹配未推送草稿，`open_article`，`ROUTE` 写手/主编等。

```
/article edit 20250920-cursor
```

## update / delete

同前：只改当前目录元数据或删除整目录。

## 排版与发布

**首选编辑栏**「排版与发布」。`/format` `/publish` 为聊天后备。
