---
description: 基于磁盘最新 article.md，生成 WECHAT / XHS / ZHIHU 排版（不推草稿箱）
argument-hint: [WECHAT|XHS|ZHIHU]
---

# 多平台排版（/format）

平台：`$0`。全部参数：`$ARGUMENTS`。

切换到**发行**。这是**排版**，不是选题会，也不是推草稿箱。不要 `ROUTE` 给主理人，不要开会，不要 mkdir。

## 前置条件

- 必须先指定平台：`WECHAT` / `XHS` / `ZHIHU`
- 未指定时先问用户，**不要默认微信**
- 源文件始终是磁盘上**最新的** `.niuma/artifacts/drafts/<主题>/article.md`（同一篇 Markdown）

## 按平台执行

### WECHAT — 微信 HTML

- 加载 `article-formatting-wechat`
- 对当前草稿目录跑 `format.py`，生成 `article.html`
- **不要**跑 `publish.py`（发布用 `/publish`）
- 跑 `format.py` 时**不要加 `--theme`**，除非用户口头点名主题 id；主题以本篇 `article.yaml` 的 `default_format_preset` 为准

### XHS — 小红书

- 加载 `article-formatting-xhs`
- **尚未接通**：说明未接通；禁止 mkdir、禁止假装已生成可发笔记；不要跑微信 `format.py`

### ZHIHU — 知乎

- 加载 `article-formatting-zhihu`
- **尚未接通**：说明未接通；禁止 mkdir、禁止假装已生成可发正文；不要跑微信 `format.py`

## 边界

- 不要打印 APPSECRET
- 开新题用 `/article create`，继续稿用 `/article edit <target>`，推草稿箱用 `/publish`

## 示例

```
/format WECHAT
/format XHS
/format ZHIHU
```
