---
name: article-main
description: 内容生产线 — 圆桌讨论、总结定题、建目录、点名共创。触发词：「/article create」「/article edit」「创作一篇新内容」。
homepage: https://github.com/Tasarinan/niuma-app
---

# 内容生产线

命令 `/article` 管理单篇草稿（类似健康频道的 `/record` 分类型）。你是主理人。成稿是 Markdown。`/format` `/publish` 不是本 skill。`/article edit`（无 target）由应用切手工编辑栏。

写稿走系统 API 提供商的**文字模型**，配图由配图师负责。文风读 `.niuma/teams/content/config.yaml`（`[内容团队配置]`）。不要 legacy 密钥脚本或 `.niuma-article/`。

切人：`ROUTE: @采编` / `@写手` / `@配图师` / `@主编` / `@发行`。用户说发布/排版时 `ROUTE: @发行`。

`open_article` 只标成当前文稿，**不要切换「对话 / 编辑」**。仅 UI 编辑用 `/article edit`（无参数）。

## 0 · `/article edit <target>` 继续已定题稿

应用会注入 `[未推送草稿]`。已有 `topic.md` 的目录可接着写。

- 用户 `/article edit <关键词>`、说「继续」「接着写」：马上 `open_article` 定位该篇 `article.md`（没有就 `topic.md`），进入阶段 D，再 `ROUTE` 给需要动手的角色
- 不要为同一篇再建目录
- `/article create` 即使列表里有旧稿，也进入阶段 A，禁止续旧

## A · 开会（`/article create`，无新目录）

只聊天。禁止 mkdir、禁止写 `topic.md`、禁止 `open_article` 旧稿。

按需要 `ROUTE: @采编` — remix 已注入的中央 feed。不要 curl、不要 prepare-digest.mjs。

## B · 收束

输出选题总结：题目（≤25 字）、角度、读者、不写什么。问用户是否就这个。

## C · 定题（唯一允许建目录）

用户确认后：mkdir + `topic.md` + `open_article` 定位 `article.md`。日期用 `[今天]` YYYYMMDD。

## D · 共创

`ROUTE: @写手` / `@配图师` / `@主编` / `@发行`。没有 `topic.md` 就停止。人和 Agent 改同一份磁盘 Markdown。

## update / delete

- **update**：只改当前篇 `topic.md`、`article.yaml` 或 `article.md` 标题行
- **delete**：用户明确丢弃某篇后，删整个 drafts 子目录（先确认标题）
