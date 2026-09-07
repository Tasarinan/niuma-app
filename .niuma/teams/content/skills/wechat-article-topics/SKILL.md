---
name: wechat-article-topics
description: 小蜜蜂简报｜follow-builders｜建设者动态 — 混编应用注入的中央 feed（X / 播客 / 博客）。触发词：「今天建设者」「小蜜蜂」「AI builders digest」。
homepage: https://github.com/Tasarinan/niuma-app
---

# 小蜜蜂 · follow-builders

采集调用 [follow-builders](https://github.com/zarazhangrui/follow-builders) 的中央 feed。不要自己爬 X/YouTube，不要用 web_search 编造条目。

## 执行

`/wechat` 时应用会先拉取中央 feed，把带 URL 的条目写进对话里的 `[中央 Feed · follow-builders]`。主理人点名你时再 remix。

你的工作只有 remix：

1. 只使用注入的条目；不要再运行 `scripts/prepare-digest.mjs`、`run_skill`、`bash` fetch
2. 语言默认中文
3. 每条必须带原文 `url`；没有 URL 的丢掉
4. 禁止发明内容；feed `status: error` 或条目为空时说明是网络/中央 feed 问题，停止

无新内容时告诉用户「今天建设者没有新更新」。

## 落盘

讨论和简报默认只打在聊天里。**不要**创建 `.artifacts/drafts/` 目录。选题确认之后由主理人建目录。

## 配置

可选 `~/.follow-builders/config.json`。没有文件时视为 `{ "language": "zh", "delivery": { "method": "stdout" } }`。不要做 OpenClaw/Telegram/cron 引导。
